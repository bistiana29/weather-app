"""Lapis dingin data hourly 153 kelurahan: Parquet bulanan di Supabase Storage, dengan salinan staging di _work/parquet_staging/.

Path objek {sumber}/{granularitas}/{YYYY}/{YYYY-MM}.parquet (bulan WIB), kolom waktu bertipe timestamp Asia/Jakarta,
kompresi zstd, nilai float32,
baris terurut (kelurahan_id, waktu). Batas 50 MB per file mengikuti batas unggah Supabase gratis."""
import io
import logging
import time
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests

from . import config, transform
from .params import TableSpec

logger = logging.getLogger(__name__)

MAX_PARQUET_BYTES = 50 * 1024 * 1024


def remote_object_path(source: str, granularity: str, ym: str) -> str:
    return f"{source}/{granularity}/{ym[:4]}/{ym}.parquet"


def local_staging_path(source: str, granularity: str, ym: str) -> Path:
    return config.WORK_DIR / "parquet_staging" / remote_object_path(source, granularity, ym)


def month_key(df: pd.DataFrame, spec: TableSpec) -> pd.Series:
    return pd.to_datetime(df["waktu"], utc=True).dt.tz_convert(config.LOCAL_TZ).dt.strftime("%Y-%m")


def normalize_for_parquet(df: pd.DataFrame, spec: TableSpec) -> pd.DataFrame:
    cols = [*spec.key_cols, *spec.value_cols]
    if df.empty:
        out = pd.DataFrame(columns=cols)
    else:
        out = transform.coalesce_dupes(transform.drop_all_null(df[cols].copy(), spec), spec)
    out["kelurahan_id"] = out["kelurahan_id"].astype("int32")
    out["waktu"] = pd.to_datetime(out["waktu"], utc=True).dt.tz_convert(config.LOCAL_TZ).dt.floor("us")
    for c in spec.value_cols:
        out[c] = pd.to_numeric(out[c], errors="coerce").astype("float32")
    return out.sort_values(list(spec.key_cols), kind="mergesort").reset_index(drop=True)


def merge_coalesce_frames(existing_df: pd.DataFrame | None, new_df: pd.DataFrame, spec: TableSpec) -> pd.DataFrame:
    """Gabungkan dua frame dengan aturan COALESCE: nilai non-NULL di new_df menang, NULL di new_df tidak menimpa."""
    frames = [f for f in (existing_df, new_df) if f is not None and not f.empty]
    return normalize_for_parquet(pd.concat(frames, ignore_index=True) if frames else new_df, spec)


def dataframe_to_parquet_bytes(df: pd.DataFrame, spec: TableSpec) -> tuple[bytes, pd.DataFrame]:
    norm = normalize_for_parquet(df, spec)
    schema = pa.schema([pa.field("kelurahan_id", pa.int32(), nullable=False),
                        pa.field("waktu", pa.timestamp("us", tz=config.LOCAL_TZ), nullable=False),
                        *[pa.field(c, pa.float32()) for c in spec.value_cols]])
    buf = io.BytesIO()
    pq.write_table(pa.Table.from_pandas(norm, schema=schema, preserve_index=False), buf, compression="zstd")
    data = buf.getvalue()
    if len(data) >= MAX_PARQUET_BYTES:
        raise ValueError(f"Ukuran Parquet ({len(data)} B) melebihi batas 50 MB")
    return data, norm


def parquet_bytes_to_dataframe(data: bytes, spec: TableSpec) -> pd.DataFrame:
    df = pq.read_table(io.BytesIO(data)).to_pandas()
    df["waktu"] = pd.to_datetime(df["waktu"], utc=True).dt.tz_convert(config.LOCAL_TZ)
    return df


def stage_monthly_frame(df: pd.DataFrame, spec: TableSpec, ym: str) -> None:
    """Gabungkan df (COALESCE) ke file staging lokal bulan ym; diunggah nanti oleh backfill."""
    path = local_staging_path(spec.source, spec.granularity, ym)
    existing = parquet_bytes_to_dataframe(path.read_bytes(), spec) if path.exists() else None
    raw_bytes, _ = dataframe_to_parquet_bytes(merge_coalesce_frames(existing, df, spec), spec)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw_bytes)


class SupabaseStorageClient:
    def __init__(self) -> None:
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib di-set (etl/.env atau GitHub Secret)")
        self.base_url = config.SUPABASE_URL.rstrip("/")
        self.bucket = config.STORAGE_BUCKET
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
                                      "apikey": config.SUPABASE_SERVICE_ROLE_KEY})

    def ensure_bucket(self) -> None:
        r = self._session.get(f"{self.base_url}/storage/v1/bucket/{self.bucket}", timeout=30)
        if r.status_code == 200:
            return
        r = self._session.post(f"{self.base_url}/storage/v1/bucket",
                               json={"id": self.bucket, "name": self.bucket, "public": False}, timeout=30)
        if r.status_code not in (200, 201, 409) and "already exists" not in r.text.lower():
            r.raise_for_status()

    def download_bytes(self, object_path: str) -> bytes | None:
        r = self._session.get(f"{self.base_url}/storage/v1/object/{self.bucket}/{object_path}", timeout=120)
        # Supabase menjawab objek yang tidak ada dengan 400 + "not_found", bukan hanya 404.
        text = r.text.lower()
        if r.status_code == 404 or (r.status_code == 400 and ("not_found" in text or "not found" in text)):
            return None
        r.raise_for_status()
        return r.content

    def upload_bytes(self, object_path: str, data: bytes) -> None:
        r = self._session.post(f"{self.base_url}/storage/v1/object/{self.bucket}/{object_path}", data=data,
                               headers={"Content-Type": "application/octet-stream", "x-upsert": "true"}, timeout=120)
        r.raise_for_status()

    def upsert_monthly_parquet(self, spec: TableSpec, ym: str, new_df: pd.DataFrame) -> dict:
        """Gabungkan new_df ke Parquet bulan ym di Storage, unggah, lalu unduh ulang untuk memastikan jumlah barisnya.
        "frame" berisi isi lengkap file setelah digabung, untuk ringkasan_arsip."""
        obj_path = remote_object_path(spec.source, spec.granularity, ym)
        existing_bytes = self.download_bytes(obj_path)
        existing_df = parquet_bytes_to_dataframe(existing_bytes, spec) if existing_bytes else None
        before_rows = 0 if existing_df is None else len(existing_df)

        raw_bytes, norm_df = dataframe_to_parquet_bytes(merge_coalesce_frames(existing_df, new_df, spec), spec)
        if len(norm_df) < before_rows:
            raise RuntimeError(f"Jumlah baris {obj_path} menyusut ({len(norm_df)} < {before_rows}); batal unggah")
        self.upload_bytes(obj_path, raw_bytes)

        # Supabase Storage bisa menyajikan versi lama beberapa detik setelah file ditimpa, jadi coba beberapa kali.
        for attempt in range(1, 6):
            verify_bytes = self.download_bytes(obj_path)
            remote_rows = pq.read_metadata(io.BytesIO(verify_bytes)).num_rows if verify_bytes else 0
            if remote_rows == len(norm_df):
                break
            logger.info("Verifikasi %s belum cocok (remote=%d, expected=%d), cek lagi dalam %ds",
                        obj_path, remote_rows, len(norm_df), 3 * attempt)
            time.sleep(3 * attempt)
        else:
            raise RuntimeError(f"Verifikasi {obj_path} gagal: remote={remote_rows} != expected={len(norm_df)}")

        local_path = local_staging_path(spec.source, spec.granularity, ym)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(raw_bytes)
        logger.info("Parquet %s terverifikasi: %d baris (sebelumnya %d), %.1f KB",
                    obj_path, len(norm_df), before_rows, len(raw_bytes) / 1024)
        return {"before_rows": before_rows, "after_rows": len(norm_df), "bytes": len(raw_bytes), "frame": norm_df}
