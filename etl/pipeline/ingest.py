"""Job pengambilan rutin data hourly 153 kelurahan ke Postgres (lapis panas).

    python -m pipeline.ingest hourly|deep_refresh [--lookback-days N] [--kelurahan-ids 1,2]
"""
import argparse
import logging
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, time as dtime, timedelta, timezone

import pandas as pd

from . import api, config, db, params

logger = logging.getLogger(__name__)

DEFAULT_LOOKBACK_DAYS = {"hourly": 7, "deep_refresh": config.MATURE_DAYS}
QUOTA_ERRORS = (api.RateLimitError, api.BudgetExceededError)


def rotation_ids(all_ids: list[int], day: date) -> list[int]:
    """deep_refresh hanya mengambil kelurahan dengan kelurahan_id % 7 == day.toordinal() % 7, sehingga
    semua kelurahan tersegarkan dalam 7 hari. toordinal() dipakai karena terus bertambah melewati
    pergantian tahun, tidak seperti hari_dalam_tahun yang kembali ke 1 dan merusak rotasi."""
    return [k for k in all_ids if k % 7 == day.toordinal() % 7]


def _fetch_all(source: str, kel_df: pd.DataFrame, start: datetime, end: datetime) -> list[pd.DataFrame]:
    def one(r):
        return api.fetch_hourly(source, int(r.kelurahan_id), float(r.latitude), float(r.longitude), start, end)

    rows = list(kel_df.itertuples(index=False))
    if source == "openmeteo":
        return [one(r) for r in rows]
    with ThreadPoolExecutor(max_workers=config.NASA_CONCURRENCY) as pool:
        futures = [pool.submit(one, r) for r in rows]
        try:
            return [f.result() for f in as_completed(futures)]
        except BaseException:
            for f in futures:
                f.cancel()
            raise


def run(conn, job: str, source: str, kel_df: pd.DataFrame, start: datetime, end: datetime) -> bool:
    """Ambil semua kelurahan dulu, baru tulis sekali. Jika satu panggilan gagal, tidak ada data yang ditulis."""
    spec = params.get_spec(source)
    log_id = db.log_start(conn, job, source, spec.granularity, None, start, end, "postgres")
    try:
        frames = [df for df in _fetch_all(source, kel_df, start, end) if not df.empty]
        combined = pd.concat(frames, ignore_index=True) if frames else None
        stats = db.upsert(conn, spec, combined) if combined is not None else {"inserted": 0, "updated": 0, "unchanged": 0}
        total = 0 if combined is None else len(combined)
        db.log_finish(conn, log_id, "success", jumlah_baris=total)
        logger.info("[%s] %s/%s (%d kelurahan, %s..%s): rows=%d, inserted=%d, updated=%d, unchanged=%d",
                    job, source, spec.granularity, len(kel_df), start, end, total,
                    stats["inserted"], stats["updated"], stats["unchanged"])
        return True
    except QUOTA_ERRORS as exc:
        db.log_finish(conn, log_id, "failed", pesan_error=f"Dihentikan karena batas kuota: {exc}")
        logger.error("[%s] %s/hourly dihentikan karena batas kuota, tidak ada data yang ditulis: %s", job, source, exc)
        raise
    except Exception as exc:
        db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
        logger.exception("[%s] Gagal pada %s/hourly: %s", job, source, exc)
        return False


def main(argv: list[str] | None = None) -> int:
    config.setup_logging()
    p = argparse.ArgumentParser(description="Job pengambilan data cuaca hourly ke Postgres")
    p.add_argument("job", choices=list(DEFAULT_LOOKBACK_DAYS))
    p.add_argument("--lookback-days", type=int, default=None, help="Default: 7 untuk hourly, 120 untuk deep_refresh")
    p.add_argument("--kelurahan-ids", type=str, default=None, help="Daftar kelurahan_id dipisah koma, mis. 1,2")
    args = p.parse_args(argv)

    now = datetime.now(config.WIB)
    lookback = args.lookback_days or DEFAULT_LOOKBACK_DAYS[args.job]
    today = now.date()
    start = datetime.combine(today - timedelta(days=lookback - 1), dtime.min, tzinfo=config.WIB)
    end = now.replace(minute=0, second=0, microsecond=0)
    kel_ids = [int(x) for x in args.kelurahan_ids.split(",") if x.strip()] if args.kelurahan_ids else None

    if args.job == "deep_refresh" and not kel_ids:
        all_df = db.load_kelurahan()
        kel_df = all_df[all_df["kelurahan_id"].isin(rotation_ids(all_df["kelurahan_id"].tolist(), today))]
        kel_df = kel_df.reset_index(drop=True)
        logger.info("Deep refresh: %d kelurahan terpilih (%s..%s): %s",
                    len(kel_df), start, end, kel_df["kelurahan_id"].tolist())
    else:
        kel_df = db.load_kelurahan(kel_ids)

    ok = True
    with db.connect() as conn:
        db.prepare(conn)
        try:
            for source in params.SOURCES:
                # Open-Meteo hourly cukup tiap N jam untuk menghemat kuota; lookback 7 hari menutup jam yang terlewat.
                if (args.job == "hourly" and source == "openmeteo" and not kel_ids
                        and now.astimezone(timezone.utc).hour % config.OPENMETEO_HOURLY_EVERY_N_HOURS != 0):
                    logger.info("Melewati openmeteo/hourly pada %s WIB (jadwal tiap %d jam: jam UTC kelipatan %d)",
                                now.strftime("%H:%M"), config.OPENMETEO_HOURLY_EVERY_N_HOURS,
                                config.OPENMETEO_HOURLY_EVERY_N_HOURS)
                    continue
                ok = run(conn, args.job, source, kel_df, start, end) and ok
        except QUOTA_ERRORS:
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
