"""
Pengendali: job mingguan yang memindahkan baris hourly lebih tua dari 130 hari (WIB) dari Postgres ke Parquet bulanan di Supabase Storage.

Alur file: compact.yml → compact.py → load.py
Alur fungsi: main() → compact_table() → _fetch_cold_rows_from_pg() → load.upsert_monthly_parquet() → load.simpan_ringkasan() → _delete_compacted_month_from_pg()
"""
import logging
import sys
from datetime import date, datetime, time as dtime, timedelta

import pandas as pd
from psycopg import sql

from . import config, load, params
from .params import TableSpec

logger = logging.getLogger(__name__)
I, L, S = sql.Identifier, sql.Literal, sql.SQL


# Mengembalikan awal bulan ym dan awal bulan berikutnya, 00:00 WIB
def _month_bounds(ym: str) -> tuple[datetime, datetime]:
    start = datetime.strptime(ym, "%Y-%m").replace(tzinfo=config.WIB)
    return start, (start + timedelta(days=32)).replace(day=1)


# Membaca baris Postgres yang lebih tua dari cutoff_date 00:00 WIB
def _fetch_cold_rows_from_pg(conn, spec: TableSpec, cutoff_date: date) -> pd.DataFrame:
    cutoff = datetime.combine(cutoff_date, dtime.min, tzinfo=config.WIB)
    where = S("{tc} < {cutoff}").format(tc=I(spec.time_col), cutoff=L(cutoff))
    return load.read_frame(conn, spec, where)


# Menghapus baris bulan ym yang sudah dipindahkan, dibatasi sampai cutoff_date
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


# Per bulan: gabung ke Parquet, verifikasi jumlah baris, simpan ringkasan, baru hapus dari Postgres
def compact_table(conn, storage_client: load.SupabaseStorageClient, spec: TableSpec,
                  cutoff_date: date) -> dict[str, int]:
    cold_df = _fetch_cold_rows_from_pg(conn, spec, cutoff_date)
    if cold_df.empty:
        logger.info("[compact] %s: tidak ada baris lebih tua dari %s", spec.name, cutoff_date)
        return {"months": 0, "compacted_rows": 0, "deleted_rows": 0}

    months = compacted = deleted_total = 0
    for ym, grp in cold_df.groupby(load.month_key(cold_df, spec)):
        ym = str(ym)
        m_start, m_end = _month_bounds(ym)
        log_id = load.log_start(conn, "compact", spec.source, spec.granularity, None, m_start, m_end, f"storage:{ym}")
        try:
            grp = grp.reset_index(drop=True)
            info = storage_client.upsert_monthly_parquet(spec, ym, grp)
            if info["after_rows"] < len(grp):
                raise RuntimeError(f"Verifikasi gagal pada {spec.name} {ym}: "
                                   f"after_rows={info['after_rows']} < batch={len(grp)}")
            load.simpan_ringkasan(conn, spec, ym, info["frame"])
            deleted = _delete_compacted_month_from_pg(conn, spec, ym, cutoff_date)
            load.log_finish(conn, log_id, "success", jumlah_baris=deleted)
        except Exception as exc:
            load.log_finish(conn, log_id, "failed", pesan_error=str(exc))
            logger.exception("[compact] Gagal pada %s %s: %s", spec.name, ym, exc)
            raise
        months += 1
        compacted += len(grp)
        deleted_total += deleted
        logger.info("[compact] %s %s: %d baris digabung ke Parquet (total %d), %d dihapus dari Postgres",
                    spec.name, ym, len(grp), info["after_rows"], deleted)
    return {"months": months, "compacted_rows": compacted, "deleted_rows": deleted_total}


# Menghitung cutoff 130 hari lalu memanggil compact_table() untuk nasa_hourly dan openmeteo_hourly
def main() -> int:
    config.setup_logging()
    config.acquire_run_lock("compact")
    cutoff_date = datetime.now(config.WIB).date() - timedelta(days=config.HOT_DAYS)
    storage_client = load.SupabaseStorageClient()
    storage_client.ensure_bucket()

    ok = True
    with load.connect() as conn:
        load.prepare(conn)
        for spec in params.TABLES.values():
            try:
                compact_table(conn, storage_client, spec, cutoff_date)
            except Exception:
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
