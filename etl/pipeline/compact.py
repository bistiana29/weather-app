"""Job pemadatan: pindahkan baris hourly yang lebih tua dari 130 hari (dihitung dalam WIB) dari Postgres ke Parquet bulanan di Supabase Storage.

Urutannya demi keamanan data: per bulan, gabungkan dengan Parquet yang sudah ada (COALESCE), unggah,
unduh ulang untuk memastikan jumlah baris, dan BARU SETELAH itu hapus baris bulan tersebut dari Postgres.

    python -m pipeline.compact
"""
import logging
import sys
from datetime import date, datetime, time as dtime, timedelta

import pandas as pd
from psycopg import sql

from . import config, db, params, ringkasan, storage
from .params import TableSpec

logger = logging.getLogger(__name__)
I, L, S = sql.Identifier, sql.Literal, sql.SQL


def _month_bounds(ym: str) -> tuple[datetime, datetime]:
    """Awal bulan ym dan awal bulan berikutnya, 00:00 WIB (file Parquet dikelompokkan per bulan WIB)."""
    start = datetime.strptime(ym, "%Y-%m").replace(tzinfo=config.WIB)
    return start, (start + timedelta(days=32)).replace(day=1)


def _fetch_cold_rows_from_pg(conn, spec: TableSpec, cutoff_date: date) -> pd.DataFrame:
    cutoff = datetime.combine(cutoff_date, dtime.min, tzinfo=config.WIB)
    where = S("{tc} < {cutoff}").format(tc=I(spec.time_col), cutoff=L(cutoff))
    return db.read_frame(conn, spec, where)


def _delete_compacted_month_from_pg(conn, spec: TableSpec, ym: str, cutoff_date: date) -> int:
    lo, hi = _month_bounds(ym)
    hi = min(hi, datetime.combine(cutoff_date, dtime.min, tzinfo=config.WIB))
    q = S("DELETE FROM {t} WHERE {tc} >= {lo} AND {tc} < {hi}").format(
        t=I(spec.name), tc=I(spec.time_col), lo=L(lo), hi=L(hi))
    with conn.cursor() as cur:
        cur.execute(q)
        deleted = cur.rowcount
    conn.commit()
    return deleted


def compact_table(conn, storage_client: storage.SupabaseStorageClient, spec: TableSpec,
                  cutoff_date: date) -> dict[str, int]:
    cold_df = _fetch_cold_rows_from_pg(conn, spec, cutoff_date)
    if cold_df.empty:
        logger.info("[compact] %s: tidak ada baris lebih tua dari %s", spec.name, cutoff_date)
        return {"months": 0, "compacted_rows": 0, "deleted_rows": 0}

    months = compacted = deleted_total = 0
    for ym, grp in cold_df.groupby(storage.month_key(cold_df, spec)):
        ym = str(ym)
        m_start, m_end = _month_bounds(ym)
        log_id = db.log_start(conn, "compact", spec.source, spec.granularity, None, m_start, m_end, f"storage:{ym}")
        try:
            grp = grp.reset_index(drop=True)
            info = storage_client.upsert_monthly_parquet(spec, ym, grp)
            if info["after_rows"] < len(grp):
                raise RuntimeError(f"Verifikasi gagal pada {spec.name} {ym}: "
                                   f"after_rows={info['after_rows']} < batch={len(grp)}")
            ringkasan.simpan(conn, spec, ym, info["frame"])
            deleted = _delete_compacted_month_from_pg(conn, spec, ym, cutoff_date)
            db.log_finish(conn, log_id, "success", jumlah_baris=deleted)
        except Exception as exc:
            db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
            logger.exception("[compact] Gagal pada %s %s: %s", spec.name, ym, exc)
            raise
        months += 1
        compacted += len(grp)
        deleted_total += deleted
        logger.info("[compact] %s %s: %d baris digabung ke Parquet (total %d), %d dihapus dari Postgres",
                    spec.name, ym, len(grp), info["after_rows"], deleted)
    return {"months": months, "compacted_rows": compacted, "deleted_rows": deleted_total}


def main() -> int:
    config.setup_logging()
    cutoff_date = datetime.now(config.WIB).date() - timedelta(days=config.HOT_DAYS)
    storage_client = storage.SupabaseStorageClient()
    storage_client.ensure_bucket()

    ok = True
    with db.connect() as conn:
        db.prepare(conn)
        for spec in params.TABLES.values():
            try:
                compact_table(conn, storage_client, spec, cutoff_date)
            except Exception:
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
