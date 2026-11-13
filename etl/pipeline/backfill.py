"""Backfill lokal data hourly 153 kelurahan, dari 2022-01-01 00:00 WIB sampai config.BACKFILL_END (2026-11-11 23:00 WIB).
Bisa dihentikan dan dilanjutkan kapan saja: setiap potongan (sumber, tahun WIB, kelurahan) dicatat success di
ingestion_log setelah datanya terunggah dan terverifikasi, lalu dilewati pada run berikutnya.

    python -m pipeline.backfill --estimate-only
    python -m pipeline.backfill [--start-date 2022-01-01] [--kelurahan-ids 1,2]
"""
import argparse
import itertools
import logging
import sys
from datetime import date, datetime, time as dtime, timedelta

import pandas as pd

from . import api, config, db, params, ringkasan, storage
from .params import TableSpec

logger = logging.getLogger(__name__)

FLUSH_EVERY_CHUNKS = 10


def yearly_slices(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """Potongan per tahun WIB: 1 Jan 00:00 sampai 31 Des 23:00 WIB, dipangkas ke start..end."""
    slices = [(max(start, datetime(y, 1, 1, 0, tzinfo=config.WIB)), min(end, datetime(y, 12, 31, 23, tzinfo=config.WIB)))
              for y in range(start.year, end.year + 1)]
    return [(s, e) for s, e in slices if s <= e]


def split_hot_cold(df: pd.DataFrame, spec: TableSpec, cutoff_date: date) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Baris sejak cutoff_date 00:00 WIB masuk Postgres (lapis panas); baris lebih tua langsung ke Parquet (lapis dingin)."""
    if df.empty:
        return df.copy(), df.copy()
    cutoff = pd.Timestamp(datetime.combine(cutoff_date, dtime.min, tzinfo=config.WIB))
    is_hot = pd.to_datetime(df["waktu"], utc=True) >= cutoff
    return df[is_hot].reset_index(drop=True), df[~is_hot].reset_index(drop=True)


def completed_chunks(conn) -> set[tuple[str, int, datetime, datetime]]:
    with conn.cursor() as cur:
        cur.execute("SELECT sumber, kelurahan_id, rentang_mulai, rentang_akhir FROM ingestion_log WHERE job = 'backfill' "
                    "AND status = 'success' AND granularitas = 'hourly' AND tujuan = 'backfill_chunk'")
        done = set(cur.fetchall())
    conn.commit()
    return done


def estimate_backfill(kel_ids: list[int], slices: list[tuple[datetime, datetime]], done: set) -> dict:
    """Jumlah panggilan dan bobot Open-Meteo untuk semua potongan dan untuk potongan yang belum selesai."""
    n_vars = [len(params.OPENMETEO_HOURLY.params_for("default")), len(params.OPENMETEO_HOURLY.params_for("historical_forecast"))]
    est = {"potongan": 0, "selesai": 0, "nasa_request": 0, "nasa_request_sisa": 0, "om_panggilan": 0,
           "om_panggilan_sisa": 0, "om_bobot": 0.0, "om_bobot_sisa": 0.0}
    for source, (s, e), kel_id in itertools.product(params.SOURCES, slices, kel_ids):
        d0, d1 = api.utc_dates(s, e)
        is_done = (source, kel_id, s, e) in done
        est["potongan"] += 1
        est["selesai"] += is_done
        if source == "nasa":
            n = len(api._date_chunks(d0, d1, api.NASA_MAX_DAYS_PER_HOURLY_REQUEST))
            est["nasa_request"] += n
            est["nasa_request_sisa"] += 0 if is_done else n
        else:
            w = sum(api.call_weight(1, (d1 - d0).days + 1, v) for v in n_vars)
            est["om_panggilan"] += len(n_vars)
            est["om_bobot"] += w
            if not is_done:
                est["om_panggilan_sisa"] += len(n_vars)
                est["om_bobot_sisa"] += w
    est["om_hari_kuota_sisa"] = est["om_bobot_sisa"] / config.OPENMETEO_LIMIT_DAY
    return est


def unflushed_months() -> set[tuple[str, str, str]]:
    """File pending yang belum terunggah, misalnya karena run sebelumnya terhenti saat mengunggah."""
    return {(path.parts[-4], path.parts[-3], path.stem)
            for path in (config.WORK_DIR / "parquet_pending").glob("*/hourly/*/*.parquet")}


def flush_dirty_months(conn, storage_client: storage.SupabaseStorageClient, dirty_months: set[tuple[str, str, str]]) -> None:
    """Unggah file pending bulan yang berubah ke Supabase Storage. File pending dihapus setelah unggahan terverifikasi."""
    for source, granularity, ym in sorted(dirty_months):
        spec = params.get_spec(source)
        pending_path = storage.local_pending_path(source, granularity, ym)
        if pending_path.exists():
            log_id = db.log_start(conn, "backfill_flush", source, granularity, None, None, None, f"storage:{ym}")
            try:
                pending = storage.parquet_bytes_to_dataframe(pending_path.read_bytes(), spec)
                info = storage_client.upsert_monthly_parquet(spec, ym, pending)
                ringkasan.simpan(conn, spec, ym, info["frame"])
                db.log_finish(conn, log_id, "success", jumlah_baris=info["after_rows"])
            except KeyboardInterrupt:
                db.log_finish(conn, log_id, "aborted", pesan_error="dihentikan manual saat mengunggah; file pending "
                                                                   "tetap ada dan diunggah ulang pada run berikutnya")
                raise
            except Exception as exc:
                db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
                raise
            pending_path.unlink()
        dirty_months.discard((source, granularity, ym))


def main(argv: list[str] | None = None) -> int:
    config.setup_logging()
    p = argparse.ArgumentParser(description="Backfill data hourly 2022-01-01 00:00 WIB sampai 2026-11-11 23:00 WIB (bisa dilanjutkan)")
    p.add_argument("--start-date", type=str, default=config.START_DATE.isoformat(), help="Tanggal mulai (WIB)")
    p.add_argument("--kelurahan-ids", type=str, default=None, help="Daftar kelurahan_id dipisah koma, mis. 1,2")
    p.add_argument("--estimate-only", action="store_true", help="Hanya tampilkan perkiraan kuota dan durasi")
    args = p.parse_args(argv)

    cutoff_date = datetime.now(config.WIB).date() - timedelta(days=config.HOT_DAYS)
    kel_ids = [int(x) for x in args.kelurahan_ids.split(",") if x.strip()] if args.kelurahan_ids else None
    kel_df = db.load_kelurahan(kel_ids)
    start = datetime.combine(date.fromisoformat(args.start_date), dtime.min, tzinfo=config.WIB)
    slices = yearly_slices(start, config.BACKFILL_END)

    if args.estimate_only:
        with db.connect() as conn:
            done = completed_chunks(conn)
        est = estimate_backfill(kel_df["kelurahan_id"].tolist(), slices, done)
        logger.info("Rentang %s s.d. %s WIB, %d kelurahan x %d potongan tahun x 2 sumber, cutoff lapis panas %s 00:00 WIB",
                    start.strftime("%Y-%m-%d %H:%M"), config.BACKFILL_END.strftime("%Y-%m-%d %H:%M"), len(kel_df),
                    len(slices), cutoff_date)
        logger.info("Potongan: %d total, %d sudah selesai, %d tersisa", est["potongan"], est["selesai"],
                    est["potongan"] - est["selesai"])
        logger.info("NASA POWER: %d request (sisa %d)", est["nasa_request"], est["nasa_request_sisa"])
        logger.info("Open-Meteo: %d panggilan, bobot %.1f (sisa %d panggilan, bobot %.1f = %.2f hari kuota %d/hari, "
                    "minimal %.1f jam pada batas %d/jam)", est["om_panggilan"], est["om_bobot"], est["om_panggilan_sisa"],
                    est["om_bobot_sisa"], est["om_hari_kuota_sisa"], config.OPENMETEO_LIMIT_DAY,
                    est["om_bobot_sisa"] / config.OPENMETEO_LIMIT_HOUR, config.OPENMETEO_LIMIT_HOUR)
        return 0

    config.acquire_run_lock("backfill")
    storage_client = storage.SupabaseStorageClient()
    storage_client.ensure_bucket()
    dirty_months: set[tuple[str, str, str]] = set()
    awaiting_flush: list[tuple[int, int]] = []
    processed = 0
    stopped_by: Exception | None = None

    def commit_chunks(final: bool = False) -> None:
        """Unggah data pending, lalu tandai success potongan yang datanya ikut terunggah. Jika unggahan terakhir
        (final) gagal, potongan itu dicatat failed/aborted sehingga diambil ulang pada run berikutnya."""
        try:
            flush_dirty_months(conn, storage_client, dirty_months)
        except BaseException as exc:
            if final:
                status = "aborted" if isinstance(exc, KeyboardInterrupt) else "failed"
                for log_id, _ in awaiting_flush:
                    db.log_finish(conn, log_id, status, pesan_error=f"data belum terunggah ke Storage: {exc!r}")
                awaiting_flush.clear()
            raise
        for log_id, n_rows in awaiting_flush:
            db.log_finish(conn, log_id, "success", jumlah_baris=n_rows)
        awaiting_flush.clear()

    logger.info("========== Run backfill mulai ==========")
    with db.connect() as conn:
        db.prepare(conn)
        leftover = unflushed_months()
        if leftover:
            logger.info("Mengunggah %d file pending yang belum terunggah dari run sebelumnya", len(leftover))
            flush_dirty_months(conn, storage_client, leftover)
        try:
            for source, (s, e) in itertools.product(params.SOURCES, slices):
                spec = params.get_spec(source)
                granularity = spec.granularity
                for r in kel_df.itertuples(index=False):
                    kel_id = int(r.kelurahan_id)
                    if db.checkpoint_done(conn, source, granularity, kel_id, s, e, "backfill_chunk"):
                        continue
                    log_id = db.log_start(conn, "backfill", source, granularity, kel_id, s, e, "backfill_chunk")
                    try:
                        df = api.fetch_hourly(source, kel_id, float(r.latitude), float(r.longitude), s, e)
                        hot_df, cold_df = split_hot_cold(df, spec, cutoff_date)
                        if not hot_df.empty:
                            db.upsert(conn, spec, hot_df)
                        if not cold_df.empty:
                            for ym, grp in cold_df.groupby(storage.month_key(cold_df, spec)):
                                storage.stage_monthly_frame(grp, spec, str(ym))
                                dirty_months.add((source, granularity, str(ym)))
                        awaiting_flush.append((log_id, len(df)))
                    except api.BudgetExceededError as exc:
                        db.log_finish(conn, log_id, "skipped", pesan_error=str(exc))
                        logger.warning("Kuota harian/per jam Open-Meteo habis, backfill berhenti. Lanjutkan besok: %s", exc)
                        stopped_by = exc
                        break
                    except api.RateLimitError as exc:
                        db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
                        logger.error("API menolak karena batas kuota (HTTP 429), backfill berhenti: %s", exc)
                        stopped_by = exc
                        break
                    except KeyboardInterrupt:
                        db.log_finish(conn, log_id, "aborted", pesan_error="dihentikan manual sebelum potongan selesai")
                        raise
                    except Exception as exc:
                        db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
                        raise
                    processed += 1
                    logger.info("[backfill] %s/%s kel=%d (%s..%s WIB): total=%d (hot=%d, cold=%d)",
                                source, granularity, kel_id, s.strftime("%Y-%m-%d %H:%M"), e.strftime("%Y-%m-%d %H:%M"),
                                len(df), len(hot_df), len(cold_df))
                    if len(awaiting_flush) >= FLUSH_EVERY_CHUNKS:
                        commit_chunks()
                commit_chunks()
                if stopped_by:
                    break
        except KeyboardInterrupt:
            logger.warning("Dihentikan manual; menyelesaikan unggahan %d potongan yang sudah diambil. "
                           "Kirim SIGINT sekali lagi untuk berhenti tanpa menunggu.", len(awaiting_flush))
            raise
        finally:
            commit_chunks(final=True)

    logger.info("Backfill selesai untuk run ini. Potongan baru diproses: %d", processed)
    return 1 if isinstance(stopped_by, api.RateLimitError) else 0


if __name__ == "__main__":
    sys.exit(main())
