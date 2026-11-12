"""Backfill lokal data hourly 153 kelurahan dari 2022-01-01 sampai hari ini. Bisa dihentikan dan dilanjutkan kapan
saja: setiap potongan (sumber, tahun, kelurahan) yang sukses dicatat di ingestion_log dan dilewati pada run berikutnya.

    python -m pipeline.backfill --estimate-only
    python -m pipeline.backfill [--start-date 2022-01-01] [--kelurahan-ids 1,2]
"""
import argparse
import itertools
import logging
import sys
from datetime import date, datetime, time as dtime, timedelta, timezone

import pandas as pd

from . import api, config, db, params, ringkasan, storage
from .params import TableSpec

logger = logging.getLogger(__name__)

def yearly_slices(start: date, end: date) -> list[tuple[date, date]]:
    slices = [(max(start, date(y, 1, 1)), min(end, date(y, 12, 31))) for y in range(start.year, end.year + 1)]
    return [(s, e) for s, e in slices if s <= e]


def split_hot_cold(df: pd.DataFrame, spec: TableSpec, cutoff_date: date) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Baris sejak cutoff masuk Postgres (lapis panas); baris lebih tua langsung ke Parquet (lapis dingin)."""
    if df.empty:
        return df.copy(), df.copy()
    is_hot = pd.to_datetime(df["waktu_utc"], utc=True) >= pd.Timestamp(
        datetime.combine(cutoff_date, dtime.min, tzinfo=timezone.utc))
    return df[is_hot].reset_index(drop=True), df[~is_hot].reset_index(drop=True)


def estimate_backfill(kel_count: int, slices: list[tuple[date, date]]) -> dict[str, float]:
    variable_counts = [len(params.OPENMETEO_HOURLY.params_for("default")),
                       len(params.OPENMETEO_HOURLY.params_for("historical_forecast"))]
    weight_per_kel = sum(api.call_weight(1, (e - s).days + 1, n) for s, e in slices for n in variable_counts)
    total_weight = weight_per_kel * kel_count
    return {
        "kelurahan_count": kel_count,
        "year_slices": len(slices),
        "om_calls": kel_count * len(slices) * len(variable_counts),
        "om_total_weight": total_weight,
        "om_daily_budget": config.OPENMETEO_LIMIT_DAY,
        "om_estimated_days": total_weight / config.OPENMETEO_LIMIT_DAY,
        "nasa_total_requests": kel_count * len(slices),
    }


def unflushed_months(conn) -> set[tuple[str, str, str]]:
    """File staging yang lebih baru dari unggahan sukses terakhirnya, misalnya karena run sebelumnya
    terhenti saat mengunggah. Tanpa ini, bulan tersebut tidak pernah diunggah karena checkpoint-nya sudah sukses."""
    with conn.cursor() as cur:
        cur.execute("SELECT sumber, granularitas, tujuan, max(selesai_at) FROM ingestion_log "
                    "WHERE status = 'success' AND tujuan LIKE 'storage:%' GROUP BY 1, 2, 3")
        flushed = {(s, g, t.removeprefix("storage:")): ts for s, g, t, ts in cur.fetchall()}
    conn.commit()
    pending = set()
    for path in (config.WORK_DIR / "parquet_staging").glob("*/hourly/*/*.parquet"):
        key = (path.parts[-4], path.parts[-3], path.stem)
        if key not in flushed or path.stat().st_mtime > flushed[key].timestamp():
            pending.add(key)
    return pending


def flush_dirty_months(conn, storage_client: storage.SupabaseStorageClient, dirty_months: set[tuple[str, str, str]]) -> None:
    """Unggah file staging bulan yang berubah ke Supabase Storage."""
    for source, granularity, ym in sorted(dirty_months):
        spec = params.get_spec(source)
        local_path = storage.local_staging_path(source, granularity, ym)
        if not local_path.exists():
            continue
        log_id = db.log_start(conn, "backfill_flush", source, granularity, None, None, None, f"storage:{ym}")
        try:
            staged = storage.parquet_bytes_to_dataframe(local_path.read_bytes(), spec)
            info = storage_client.upsert_monthly_parquet(spec, ym, staged)
            ringkasan.simpan(conn, spec, ym, info["frame"])
            db.log_finish(conn, log_id, "success", jumlah_baris=info["after_rows"])
        except Exception as exc:
            db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
            raise
    dirty_months.clear()


def main(argv: list[str] | None = None) -> int:
    config.setup_logging()
    p = argparse.ArgumentParser(description="Backfill data hourly dari 2022-01-01 sampai hari ini (bisa dilanjutkan)")
    p.add_argument("--start-date", type=str, default=config.START_DATE.isoformat())
    p.add_argument("--kelurahan-ids", type=str, default=None, help="Daftar kelurahan_id dipisah koma, mis. 1,2")
    p.add_argument("--estimate-only", action="store_true", help="Hanya tampilkan perkiraan kuota dan durasi")
    args = p.parse_args(argv)

    today = datetime.now(timezone.utc).date()
    cutoff_date = today - timedelta(days=config.HOT_DAYS)
    kel_ids = [int(x) for x in args.kelurahan_ids.split(",") if x.strip()] if args.kelurahan_ids else None
    kel_df = db.load_kelurahan(kel_ids)
    slices = yearly_slices(date.fromisoformat(args.start_date), today)

    est = estimate_backfill(len(kel_df), slices)
    logger.info("Estimasi backfill (%d kelurahan x %d potongan tahun, cutoff lapis panas=%s): "
                "Open-Meteo %d panggilan, total bobot=%.1f (~%.2f hari pada batas %d/hari), NASA %d request",
                est["kelurahan_count"], est["year_slices"], cutoff_date, est["om_calls"], est["om_total_weight"],
                est["om_estimated_days"], est["om_daily_budget"], est["nasa_total_requests"])
    if args.estimate_only:
        return 0

    storage_client = storage.SupabaseStorageClient()
    storage_client.ensure_bucket()
    dirty_months: set[tuple[str, str, str]] = set()
    processed = 0
    stopped_by: Exception | None = None

    with db.connect() as conn:
        db.prepare(conn)
        leftover = unflushed_months(conn)
        if leftover:
            logger.info("Mengunggah %d file staging yang belum terunggah dari run sebelumnya", len(leftover))
            flush_dirty_months(conn, storage_client, leftover)
        try:
            for source, (s, e) in itertools.product(params.SOURCES, slices):
                spec = params.get_spec(source)
                granularity = spec.granularity
                t_start, t_end = db.day_bounds(s, e)
                for r in kel_df.itertuples(index=False):
                    kel_id = int(r.kelurahan_id)
                    if db.checkpoint_done(conn, source, granularity, kel_id, t_start, t_end, "backfill_chunk"):
                        continue
                    log_id = db.log_start(conn, "backfill", source, granularity, kel_id, t_start, t_end, "backfill_chunk")
                    try:
                        df = api.fetch_hourly(source, kel_id, float(r.latitude), float(r.longitude), s, e)
                        hot_df, cold_df = split_hot_cold(df, spec, cutoff_date)
                        if not hot_df.empty:
                            db.upsert(conn, spec, hot_df)
                        if not cold_df.empty:
                            for ym, grp in cold_df.groupby(storage.month_key(cold_df, spec)):
                                storage.stage_monthly_frame(grp, spec, str(ym))
                                dirty_months.add((source, granularity, str(ym)))
                        db.log_finish(conn, log_id, "success", jumlah_baris=len(df))
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
                    except Exception as exc:
                        db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
                        raise
                    processed += 1
                    logger.info("[backfill] %s/%s kel=%d (%s..%s): total=%d (hot=%d, cold=%d)",
                                source, granularity, kel_id, s, e, len(df), len(hot_df), len(cold_df))
                flush_dirty_months(conn, storage_client, dirty_months)
                if stopped_by:
                    break
        finally:
            flush_dirty_months(conn, storage_client, dirty_months)

    logger.info("Backfill selesai untuk run ini. Potongan baru diproses: %d", processed)
    return 1 if isinstance(stopped_by, api.RateLimitError) else 0


if __name__ == "__main__":
    sys.exit(main())
