"""Ringkasan per parameter untuk setiap file Parquet bulanan, disimpan di tabel ringkasan_arsip.

Backfill dan compact memanggil simpan() setiap selesai menulis satu file. Untuk mengisi ulang ringkasan dari
semua file yang sudah ada di Storage (hanya membaca Storage, tidak memanggil API cuaca):

    python -m pipeline.ringkasan
"""
import logging
import sys
from datetime import datetime

import pandas as pd

from . import config, db, params, storage
from .params import TableSpec

logger = logging.getLogger(__name__)

UPSERT_SQL = """INSERT INTO ringkasan_arsip (sumber, granularitas, bulan, parameter, jumlah_baris, jumlah_terisi,
    waktu_awal_terisi, waktu_akhir_terisi, diperbarui_pada)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (sumber, granularitas, bulan, parameter) DO UPDATE SET jumlah_baris = EXCLUDED.jumlah_baris,
    jumlah_terisi = EXCLUDED.jumlah_terisi, waktu_awal_terisi = EXCLUDED.waktu_awal_terisi,
    waktu_akhir_terisi = EXCLUDED.waktu_akhir_terisi, diperbarui_pada = now()"""


def simpan(conn, spec: TableSpec, ym: str, df: pd.DataFrame) -> None:
    """df harus isi lengkap file bulan ym (sesudah digabung), bukan hanya data yang baru ditambahkan."""
    waktu = pd.to_datetime(df["waktu"], utc=True)
    rows = []
    for col in spec.value_cols:
        terisi = waktu[df[col].notna()]
        rows.append((spec.source, spec.granularity, ym, col, len(df), len(terisi),
                     terisi.min().to_pydatetime() if len(terisi) else None,
                     terisi.max().to_pydatetime() if len(terisi) else None))
    with conn.cursor() as cur:
        cur.executemany(UPSERT_SQL, rows)
    conn.commit()


def main() -> int:
    config.setup_logging()
    client = storage.SupabaseStorageClient()
    months = pd.period_range(config.START_DATE, datetime.now(config.WIB).date(), freq="M").strftime("%Y-%m")
    files = 0
    with db.connect() as conn:
        db.prepare(conn)
        for spec in params.TABLES.values():
            for ym in months:
                data = client.download_bytes(storage.remote_object_path(spec.source, spec.granularity, ym))
                if data:
                    simpan(conn, spec, ym, storage.parquet_bytes_to_dataframe(data, spec))
                    files += 1
            logger.info("Ringkasan %s selesai", spec.name)
    logger.info("Ringkasan diperbarui dari %d file Parquet", files)
    return 0


if __name__ == "__main__":
    sys.exit(main())
