"""
Load: menyimpan data ke Postgres (lapis panas dan ingestion_log), ke Parquet bulanan di Supabase Storage (lapis dingin), dan ke ringkasan_arsip.

Alur file: ingest.py / backfill.py / stasiun.py / compact.py / read.py → load.py → transform.py
Alur fungsi: connect() → prepare() → log_start() → upsert() / stage_monthly_frame() → SupabaseStorageClient.upsert_monthly_parquet() → simpan_ringkasan() → log_finish()
"""
import hashlib
import io
import logging
import math
import os
import sys
import time
from datetime import date, datetime, time as dtime
from pathlib import Path

import pandas as pd
import psycopg
import pyarrow as pa
import pyarrow.parquet as pq
import requests
from psycopg import sql

from . import config, params, transform
from .params import TableSpec

logger = logging.getLogger(__name__)

# Nama tabel dan kolom selalu lewat sql.Identifier karena nama kolom berisi spasi dan simbol.
I, S = sql.Identifier, sql.SQL


# Membuka koneksi Postgres dengan zona waktu Asia/Jakarta
def connect() -> psycopg.Connection:
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL belum di-set (etl/.env atau GitHub Secret)")
    # prepare_threshold=None karena connection pooler Supabase tidak mendukung prepared statement.
    conn = psycopg.connect(config.DATABASE_URL, prepare_threshold=None, application_name="weather_etl")
    conn.execute(f"SET TIME ZONE '{config.LOCAL_TZ}'")
    conn.commit()
    return conn


# Membaca dan memvalidasi CSV kelurahan; kelurahan_id = nomor baris CSV (mulai 1)
def load_kelurahan(ids: list[int] | None = None) -> pd.DataFrame:
    df = pd.read_csv(config.KELURAHAN_CSV, dtype={"kode_kel": str})
    expected = ["kode_kel", "kecamatan", "desa", "latitude", "longitude", "metode_titik"]
    if list(df.columns) != expected:
        raise ValueError(f"Kolom CSV harus {expected}, dapat {list(df.columns)}")
    # Karena id diambil dari nomor baris, urutan baris CSV tidak boleh diubah.
    df.insert(0, "kelurahan_id", range(1, len(df) + 1))
    if df.duplicated(["kecamatan", "desa"]).any() or df["kode_kel"].duplicated().any():
        raise ValueError("Pasangan (kecamatan, desa) dan kode_kel harus unik")
    if df[["kode_kel", "latitude", "longitude", "metode_titik"]].isna().any().any():
        raise ValueError("kode_kel, koordinat, dan metode_titik tidak boleh kosong")
    if ids:
        df = df[df["kelurahan_id"].isin(ids)].reset_index(drop=True)
        if df.empty:
            raise ValueError(f"Tidak ada kelurahan dengan id {ids}")
    return df


# Menjalankan schema.sql (idempoten) lalu memanggil sync_kelurahan()
def prepare(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(config.SCHEMA_SQL.read_text(encoding="utf-8"))
    conn.commit()
    sync_kelurahan(conn)


# Menyamakan tabel kelurahan dengan isi CSV
def sync_kelurahan(conn: psycopg.Connection) -> int:
    df = load_kelurahan()
    q = S("""INSERT INTO {t} (kelurahan_id, kode_kel, kecamatan, desa, latitude, longitude, metode_titik)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (kelurahan_id) DO UPDATE SET kode_kel = EXCLUDED.kode_kel, kecamatan = EXCLUDED.kecamatan,
    desa = EXCLUDED.desa, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    metode_titik = EXCLUDED.metode_titik""").format(t=I("kelurahan"))
    with conn.cursor() as cur:
        cur.executemany(q, [(int(r.kelurahan_id), r.kode_kel, r.kecamatan, r.desa, float(r.latitude),
                             float(r.longitude), r.metode_titik) for r in df.itertuples()])
    conn.commit()
    return len(df)


# Mengubah NaN/NaT menjadi None dan Timestamp menjadi datetime untuk COPY
def _clean(v):
    if v is None or v is pd.NaT or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.to_pydatetime()
    return v


# Menyusun SQL upsert COALESCE per kolom dari tabel staging; fetched_at hanya berubah bila ada nilai baru
def build_upsert_sql(spec: TableSpec, staging: str) -> sql.Composed:
    tgt = I(spec.name)
    k, tc = (I(c) for c in spec.key_cols)
    vals = [I(c) for c in spec.value_cols]
    col_list = S(", ").join([k, tc, *vals])
    sets = S(", ").join(S("{c} = COALESCE(EXCLUDED.{c}, t.{c})").format(c=c) for c in vals)
    changed = S(" OR ").join(S("(EXCLUDED.{c} IS NOT NULL AND EXCLUDED.{c} IS DISTINCT FROM t.{c})").format(c=c)
                             for c in vals)
    return S("""INSERT INTO {tgt} AS t ({cols}, fetched_at)
SELECT {cols}, clock_timestamp() FROM {stg}
ON CONFLICT ({k}, {tc}) DO UPDATE SET {sets}, fetched_at = clock_timestamp()
WHERE {changed}
RETURNING (xmax = 0) AS inserted""").format(tgt=tgt, cols=col_list, stg=I(staging), k=k, tc=tc,
                                           sets=sets, changed=changed)


# Upsert COALESCE ke Postgres lewat tabel TEMP dan COPY; NULL baru tidak menimpa nilai lama
def upsert(conn: psycopg.Connection, spec: TableSpec, df: pd.DataFrame) -> dict[str, int]:
    cols = [*spec.key_cols, *spec.value_cols]
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"Kolom hilang untuk {spec.name}: {missing}")
    df = transform.coalesce_dupes(transform.drop_all_null(df[cols], spec), spec)
    if df.empty:
        return {"inserted": 0, "updated": 0, "unchanged": 0}
    staging = f"stg_{spec.name}"
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(S("DROP TABLE IF EXISTS pg_temp.{stg}").format(stg=I(staging)))
        cur.execute(S("CREATE TEMP TABLE {stg} (LIKE {tgt} INCLUDING DEFAULTS) ON COMMIT DROP").format(
            stg=I(staging), tgt=I(spec.name)))
        with cur.copy(S("COPY {stg} ({cols}) FROM STDIN").format(
                stg=I(staging), cols=S(", ").join(I(c) for c in cols))) as cp:
            for row in df.itertuples(index=False, name=None):
                cp.write_row([_clean(v) for v in row])
        cur.execute(build_upsert_sql(spec, staging))
        flags = [r[0] for r in cur.fetchall()]
        cur.execute(S("DROP TABLE IF EXISTS pg_temp.{stg}").format(stg=I(staging)))
    conn.commit()
    inserted = sum(flags)
    return {"inserted": inserted, "updated": len(flags) - inserted, "unchanged": len(df) - len(flags)}


# Membaca baris tabel hourly/daily dengan filter WHERE; waktu hourly dikembalikan dalam WIB
def read_frame(conn: psycopg.Connection, spec: TableSpec, where: sql.Composable) -> pd.DataFrame:
    cols = [*spec.key_cols, *spec.value_cols]
    q = S("SELECT {cols} FROM {t} WHERE {where} ORDER BY {loc}, {tc}").format(
        cols=S(", ").join(I(c) for c in cols), t=I(spec.name), where=where, loc=I(spec.location_col), tc=I(spec.time_col))
    with conn.cursor() as cur:
        cur.execute(q)
        rows = cur.fetchall()
    conn.commit()
    if not rows:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(rows, columns=cols)
    if spec.granularity == "hourly":
        df["waktu"] = pd.to_datetime(df["waktu"], utc=True).dt.tz_convert(config.LOCAL_TZ)
    return df


# Mengembalikan awal hari start dan akhir hari end dalam WIB
def day_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (datetime.combine(start, dtime.min, tzinfo=config.WIB),
            datetime.combine(end, dtime.max, tzinfo=config.WIB))


# Mencatat run baru berstatus running di ingestion_log dan mengembalikan id-nya
def log_start(conn: psycopg.Connection, job: str, sumber: str, granularitas: str, kelurahan_id: int | None,
              mulai: datetime | None, akhir: datetime | None, tujuan: str | None = None) -> int:
    with conn.cursor() as cur:
        cur.execute(S("""INSERT INTO {t} (job, sumber, granularitas, kelurahan_id, rentang_mulai, rentang_akhir,
tujuan, status) VALUES (%s, %s, %s, %s, %s, %s, %s, 'running') RETURNING id""").format(t=I("ingestion_log")),
                    (job, sumber, granularitas, kelurahan_id, mulai, akhir, tujuan))
        log_id = cur.fetchone()[0]
    conn.commit()
    return log_id


# Mengisi status akhir, jumlah baris, dan pesan error sebuah run di ingestion_log
def log_finish(conn: psycopg.Connection, log_id: int, status: str, jumlah_baris: int | None = None,
               pesan_error: str | None = None) -> None:
    if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
        conn.rollback()
    with conn.cursor() as cur:
        cur.execute(S("""UPDATE {t} SET status = %s, jumlah_baris = %s, pesan_error = %s, selesai_at = now()
WHERE id = %s""").format(t=I("ingestion_log")),
                    (status, jumlah_baris, pesan_error[:4000] if pesan_error else None, log_id))
    conn.commit()


# Mengecek apakah potongan dengan rentang dan tujuan yang sama sudah tercatat success
def checkpoint_done(conn: psycopg.Connection, sumber: str, granularitas: str, kelurahan_id: int,
                    mulai: datetime, akhir: datetime, tujuan: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(S("""SELECT 1 FROM {t} WHERE status = 'success' AND sumber = %s AND granularitas = %s
AND kelurahan_id = %s AND rentang_mulai = %s AND rentang_akhir = %s
AND tujuan IS NOT DISTINCT FROM %s LIMIT 1""").format(t=I("ingestion_log")),
                    (sumber, granularitas, kelurahan_id, mulai, akhir, tujuan))
        found = cur.fetchone() is not None
    conn.commit()
    return found


# File Parquet: {sumber}/{granularitas}/{YYYY}/{YYYY-MM}.parquet per bulan WIB, zstd, nilai float32, terurut
# (kelurahan_id, waktu). Batas 50 MB mengikuti batas unggah Supabase gratis.
MAX_PARQUET_BYTES = 50 * 1024 * 1024


# Menyusun path objek Parquet bulan ym di Storage
def remote_object_path(source: str, granularity: str, ym: str) -> str:
    return f"{source}/{granularity}/{ym[:4]}/{ym}.parquet"


# Path salinan lokal file Storage sesudah unggahan terverifikasi terakhir (_work/parquet_staging/)
def local_staging_path(source: str, granularity: str, ym: str) -> Path:
    return config.WORK_DIR / "parquet_staging" / remote_object_path(source, granularity, ym)


# Path file data backfill yang belum diunggah (_work/parquet_pending/)
def local_pending_path(source: str, granularity: str, ym: str) -> Path:
    return config.WORK_DIR / "parquet_pending" / remote_object_path(source, granularity, ym)


# Menulis ke file .tmp lalu mengganti, supaya file tidak setengah tertulis bila proses terhenti
def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


# Mengembalikan etag bila berupa MD5 polos, None bila tidak
def _plain_md5_etag(meta: dict) -> str | None:
    # etag Supabase adalah MD5 isi file untuk unggahan biasa; unggahan multipart berformat lain (mengandung "-").
    etag = meta["etag"].strip('"').lower()
    return etag if len(etag) == 32 and all(ch in "0123456789abcdef" for ch in etag) else None


# Mengembalikan kunci bulan WIB (YYYY-MM) untuk setiap baris
def month_key(df: pd.DataFrame, spec: TableSpec) -> pd.Series:
    return pd.to_datetime(df["waktu"], utc=True).dt.tz_convert(config.LOCAL_TZ).dt.strftime("%Y-%m")


# Merapikan frame untuk Parquet: buang baris NULL semua, gabung duplikat, tipe int32/float32, urutkan
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


# Menggabungkan dua frame dengan aturan COALESCE: nilai non-NULL di new_df menang, NULL di new_df tidak menimpa
def merge_coalesce_frames(existing_df: pd.DataFrame | None, new_df: pd.DataFrame, spec: TableSpec) -> pd.DataFrame:
    frames = [f for f in (existing_df, new_df) if f is not None and not f.empty]
    return normalize_for_parquet(pd.concat(frames, ignore_index=True) if frames else new_df, spec)


# Mengubah frame menjadi bytes Parquet berskema tetap dan menolak file 50 MB ke atas
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


# Membaca bytes Parquet menjadi DataFrame dengan waktu WIB
def parquet_bytes_to_dataframe(data: bytes, spec: TableSpec) -> pd.DataFrame:
    df = pq.read_table(io.BytesIO(data)).to_pandas()
    df["waktu"] = pd.to_datetime(df["waktu"], utc=True).dt.tz_convert(config.LOCAL_TZ)
    return df


# Menggabungkan df (COALESCE) ke file pending bulan ym; diunggah nanti oleh backfill
def stage_monthly_frame(df: pd.DataFrame, spec: TableSpec, ym: str) -> None:
    path = local_pending_path(spec.source, spec.granularity, ym)
    existing = parquet_bytes_to_dataframe(path.read_bytes(), spec) if path.exists() else None
    raw_bytes, _ = dataframe_to_parquet_bytes(merge_coalesce_frames(existing, df, spec), spec)
    write_atomic(path, raw_bytes)


# Klien REST Supabase Storage untuk bucket weather-archive
class SupabaseStorageClient:
    # Menyiapkan sesi HTTP dengan service role key
    def __init__(self) -> None:
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib di-set (etl/.env atau GitHub Secret)")
        self.base_url = config.SUPABASE_URL.rstrip("/")
        self.bucket = config.STORAGE_BUCKET
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
                                      "apikey": config.SUPABASE_SERVICE_ROLE_KEY})

    # Membuat bucket privat bila belum ada
    def ensure_bucket(self) -> None:
        r = self._session.get(f"{self.base_url}/storage/v1/bucket/{self.bucket}", timeout=30)
        if r.status_code == 200:
            return
        r = self._session.post(f"{self.base_url}/storage/v1/bucket",
                               json={"id": self.bucket, "name": self.bucket, "public": False}, timeout=30)
        if r.status_code not in (200, 201, 409) and "already exists" not in r.text.lower():
            r.raise_for_status()

    # Menyusun URL endpoint Storage untuk sebuah objek
    def _object_url(self, kind: str, object_path: str) -> str:
        return f"{self.base_url}/storage/v1/{kind}/{self.bucket}/{object_path}"

    # Mengecek apakah respons berarti objek tidak ada
    @staticmethod
    def _is_not_found(r: requests.Response) -> bool:
        # Supabase menjawab objek yang tidak ada dengan 400 + "not_found", bukan hanya 404.
        text = r.text.lower()
        return r.status_code == 404 or (r.status_code == 400 and ("not_found" in text or "not found" in text))

    # Mengambil metadata objek (size, etag, last_modified) lewat /object/info, yang tidak lewat cache CDN
    def object_info(self, object_path: str) -> dict | None:
        r = self._session.get(self._object_url("object/info", object_path), timeout=60)
        if self._is_not_found(r):
            return None
        r.raise_for_status()
        return r.json()

    # Mengunduh isi objek apa adanya, tanpa pencocokan etag
    def _get_raw(self, object_path: str) -> bytes | None:
        r = self._session.get(self._object_url("object", object_path), timeout=120)
        if self._is_not_found(r):
            return None
        r.raise_for_status()
        return r.content

    # Mengunduh objek dan mengulang sampai isinya cocok dengan etag dari object_info()
    def download_bytes(self, object_path: str) -> bytes | None:
        # Unduhan lewat cache CDN Cloudflare yang bisa menyajikan versi lama lebih dari 45 detik setelah file ditimpa.
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

    # Mengunggah objek lalu memverifikasi lewat object_info(): ukuran sama dan etag = MD5 data
    def upload_bytes(self, object_path: str, data: bytes) -> None:
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
                # etag multipart tidak bisa dibandingkan dengan MD5, jadi isi unduhan harus identik byte per byte.
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

    # Mengambil isi file Storage saat ini: salinan lokal bila MD5-nya sama dengan etag, selain itu download_bytes()
    def _current_bytes(self, object_path: str, local_copy: Path) -> tuple[bytes | None, str]:
        meta = self.object_info(object_path)
        if meta is None:
            return None, "belum ada"
        if local_copy.exists() and _plain_md5_etag(meta) is not None:
            local = local_copy.read_bytes()
            if hashlib.md5(local).hexdigest() == _plain_md5_etag(meta):
                return local, "salinan lokal"
        return self.download_bytes(object_path), "unduhan"

    # Menggabungkan new_df ke Parquet bulan ym (COALESCE), upload_bytes(), lalu memperbarui salinan lokal
    def upsert_monthly_parquet(self, spec: TableSpec, ym: str, new_df: pd.DataFrame) -> dict:
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
        # "frame" berisi isi lengkap file setelah digabung, untuk simpan_ringkasan().
        return {"before_rows": before_rows, "after_rows": len(norm_df), "bytes": len(raw_bytes), "frame": norm_df}


# ringkasan_arsip: statistik per parameter untuk setiap file Parquet bulanan, dibaca oleh view status_data_parameter.
RINGKASAN_UPSERT_SQL = """INSERT INTO ringkasan_arsip (sumber, granularitas, bulan, parameter, jumlah_baris, jumlah_terisi,
    waktu_awal_terisi, waktu_akhir_terisi, diperbarui_pada)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (sumber, granularitas, bulan, parameter) DO UPDATE SET jumlah_baris = EXCLUDED.jumlah_baris,
    jumlah_terisi = EXCLUDED.jumlah_terisi, waktu_awal_terisi = EXCLUDED.waktu_awal_terisi,
    waktu_akhir_terisi = EXCLUDED.waktu_akhir_terisi, diperbarui_pada = now()"""


# Menyimpan ringkasan satu file bulan ym ke ringkasan_arsip; df harus isi lengkap file sesudah digabung
def simpan_ringkasan(conn, spec: TableSpec, ym: str, df: pd.DataFrame) -> None:
    waktu = pd.to_datetime(df["waktu"], utc=True)
    rows = []
    for col in spec.value_cols:
        terisi = waktu[df[col].notna()]
        rows.append((spec.source, spec.granularity, ym, col, len(df), len(terisi),
                     terisi.min().to_pydatetime() if len(terisi) else None,
                     terisi.max().to_pydatetime() if len(terisi) else None))
    with conn.cursor() as cur:
        cur.executemany(RINGKASAN_UPSERT_SQL, rows)
    conn.commit()


# Mengisi ulang ringkasan_arsip dari semua file Parquet di Storage (tidak memanggil API cuaca)
def main() -> int:
    config.setup_logging()
    config.acquire_run_lock("ringkasan")
    client = SupabaseStorageClient()
    months = pd.period_range(config.START_DATE, datetime.now(config.WIB).date(), freq="M").strftime("%Y-%m")
    files = 0
    with connect() as conn:
        prepare(conn)
        for spec in params.TABLES.values():
            for ym in months:
                data = client.download_bytes(remote_object_path(spec.source, spec.granularity, ym))
                if data:
                    simpan_ringkasan(conn, spec, ym, parquet_bytes_to_dataframe(data, spec))
                    files += 1
            logger.info("Ringkasan %s selesai", spec.name)
    logger.info("Ringkasan diperbarui dari %d file Parquet", files)
    return 0


if __name__ == "__main__":
    sys.exit(main())
