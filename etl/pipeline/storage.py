"""Lapis dingin data hourly 153 kelurahan: Parquet bulanan di Supabase Storage.

Di laptop ada dua folder lokal: _work/parquet_staging/ berisi salinan persis file di Storage sesudah unggahan terakhir,
dan _work/parquet_pending/ berisi data backfill yang belum diunggah.

Path objek {sumber}/{granularitas}/{YYYY}/{YYYY-MM}.parquet (bulan WIB), kolom waktu bertipe timestamp Asia/Jakarta,
kompresi zstd, nilai float32,
baris terurut (kelurahan_id, waktu). Batas 50 MB per file mengikuti batas unggah Supabase gratis."""
import hashlib
import io
import logging
import os
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


def local_pending_path(source: str, granularity: str, ym: str) -> Path:
    return config.WORK_DIR / "parquet_pending" / remote_object_path(source, granularity, ym)


def write_atomic(path: Path, data: bytes) -> None:
    """Tulis ke file sementara lalu ganti, supaya file tidak setengah tertulis bila proses terhenti."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _plain_md5_etag(meta: dict) -> str | None:
    """etag Supabase adalah MD5 isi file untuk unggahan biasa; unggahan multipart berformat lain (mengandung "-")."""
    etag = meta["etag"].strip('"').lower()
    return etag if len(etag) == 32 and all(ch in "0123456789abcdef" for ch in etag) else None


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
    """Gabungkan df (COALESCE) ke file pending bulan ym; diunggah nanti oleh backfill."""
    path = local_pending_path(spec.source, spec.granularity, ym)
    existing = parquet_bytes_to_dataframe(path.read_bytes(), spec) if path.exists() else None
    raw_bytes, _ = dataframe_to_parquet_bytes(merge_coalesce_frames(existing, df, spec), spec)
    write_atomic(path, raw_bytes)


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

    def _object_url(self, kind: str, object_path: str) -> str:
        return f"{self.base_url}/storage/v1/{kind}/{self.bucket}/{object_path}"

    @staticmethod
    def _is_not_found(r: requests.Response) -> bool:
        # Supabase menjawab objek yang tidak ada dengan 400 + "not_found", bukan hanya 404.
        text = r.text.lower()
        return r.status_code == 404 or (r.status_code == 400 and ("not_found" in text or "not found" in text))

    def object_info(self, object_path: str) -> dict | None:
        """Metadata objek (size, etag, last_modified). Endpoint ini tidak lewat cache CDN, beda dengan unduhan."""
        r = self._session.get(self._object_url("object/info", object_path), timeout=60)
        if self._is_not_found(r):
            return None
        r.raise_for_status()
        return r.json()

    def _get_raw(self, object_path: str) -> bytes | None:
        r = self._session.get(self._object_url("object", object_path), timeout=120)
        if self._is_not_found(r):
            return None
        r.raise_for_status()
        return r.content

    def download_bytes(self, object_path: str) -> bytes | None:
        """Unduhan Storage lewat cache CDN Cloudflare yang bisa menyajikan versi lama lebih dari 45 detik setelah
        file ditimpa. Karena itu isi unduhan dicocokkan dengan etag dari object_info dan diulang sampai cocok."""
        for attempt in range(1, 9):
            meta = self.object_info(object_path)
            if meta is None:
                return None
            data = self._get_raw(object_path)
            if data is not None:
                md5 = _plain_md5_etag(meta)
                if md5 is None:
                    logger.warning("etag %s untuk %s bukan MD5 polos; unduhan hanya dicocokkan ukurannya",
                                   meta["etag"], object_path)
                    if len(data) == meta["size"]:
                        return data
                elif hashlib.md5(data).hexdigest() == md5:
                    return data
            logger.info("Unduhan %s belum versi terbaru (cache), cek lagi dalam %ds", object_path, 3 * attempt)
            time.sleep(3 * attempt)
        raise RuntimeError(f"Unduhan {object_path} tidak pernah cocok dengan etag terbaru")

    def upload_bytes(self, object_path: str, data: bytes) -> None:
        """Unggah lalu verifikasi lewat object_info: etag harus sama dengan MD5 data dan ukurannya sama. Jika etag
        bukan MD5 polos, verifikasi memakai ukuran ditambah unduhan yang isinya harus identik byte per byte."""
        r = self._session.post(self._object_url("object", object_path), data=data,
                               headers={"Content-Type": "application/octet-stream", "x-upsert": "true"}, timeout=120)
        r.raise_for_status()
        expected = hashlib.md5(data).hexdigest()
        meta = None
        for attempt in range(1, 9):
            meta = self.object_info(object_path)
            if meta is not None and meta["size"] == len(data):
                md5 = _plain_md5_etag(meta)
                if md5 == expected:
                    return
                if md5 is None:
                    logger.warning("etag %s untuk %s bukan MD5 polos; verifikasi memakai ukuran dan unduhan",
                                   meta["etag"], object_path)
                    if self._get_raw(object_path) == data:
                        return
            logger.info("Verifikasi %s belum cocok (etag=%s, size=%s; diharapkan %s, %d), cek lagi dalam %ds",
                        object_path, meta and meta["etag"], meta and meta["size"], expected, len(data), 3 * attempt)
            time.sleep(3 * attempt)
        raise RuntimeError(f"Verifikasi {object_path} gagal: etag={meta and meta['etag']}, size={meta and meta['size']}, "
                           f"diharapkan MD5 {expected} dan {len(data)} B")

    def _current_bytes(self, object_path: str, local_copy: Path) -> tuple[bytes | None, str]:
        """Isi file di Storage saat ini. Salinan lokal dipakai jika MD5-nya sama dengan etag, sehingga tidak perlu
        mengunduh lewat cache; jika berbeda, tidak ada, atau etag bukan MD5 polos, unduh dengan pencocokan etag."""
        meta = self.object_info(object_path)
        if meta is None:
            return None, "belum ada"
        if local_copy.exists() and _plain_md5_etag(meta) is not None:
            local = local_copy.read_bytes()
            if hashlib.md5(local).hexdigest() == _plain_md5_etag(meta):
                return local, "salinan lokal"
        return self.download_bytes(object_path), "unduhan"

    def upsert_monthly_parquet(self, spec: TableSpec, ym: str, new_df: pd.DataFrame) -> dict:
        """Gabungkan new_df ke Parquet bulan ym di Storage, unggah dan verifikasi, lalu perbarui salinan lokal.
        "frame" berisi isi lengkap file setelah digabung, untuk ringkasan_arsip."""
        obj_path = remote_object_path(spec.source, spec.granularity, ym)
        local_path = local_staging_path(spec.source, spec.granularity, ym)
        existing_bytes, base = self._current_bytes(obj_path, local_path)
        existing_df = parquet_bytes_to_dataframe(existing_bytes, spec) if existing_bytes else None
        before_rows = 0 if existing_df is None else len(existing_df)

        raw_bytes, norm_df = dataframe_to_parquet_bytes(merge_coalesce_frames(existing_df, new_df, spec), spec)
        if len(norm_df) < before_rows:
            raise RuntimeError(f"Jumlah baris {obj_path} menyusut ({len(norm_df)} < {before_rows}); batal unggah")
        self.upload_bytes(obj_path, raw_bytes)
        write_atomic(local_path, raw_bytes)
        logger.info("Parquet %s terverifikasi: %d baris (sebelumnya %d, basis %s), %.1f KB",
                    obj_path, len(norm_df), before_rows, base, len(raw_bytes) / 1024)
        return {"before_rows": before_rows, "after_rows": len(norm_df), "bytes": len(raw_bytes), "frame": norm_df}
