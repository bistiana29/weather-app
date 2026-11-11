"""Akses Postgres: koneksi, skema, daftar kelurahan, upsert COALESCE, dan ingestion_log.
Nama tabel dan kolom selalu lewat psycopg.sql.Identifier karena nama kolom berisi spasi dan simbol."""
import math
from datetime import date, datetime, time as dtime, timezone

import pandas as pd
import psycopg
from psycopg import sql

from . import config, transform
from .params import TableSpec

I, S = sql.Identifier, sql.SQL


def connect() -> psycopg.Connection:
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL belum di-set (etl/.env atau GitHub Secret)")
    # prepare_threshold=None karena connection pooler Supabase tidak mendukung prepared statement.
    return psycopg.connect(config.DATABASE_URL, prepare_threshold=None, application_name="weather_etl")


def load_kelurahan(ids: list[int] | None = None) -> pd.DataFrame:
    """kelurahan_id = nomor baris CSV (mulai 1), jadi urutan baris CSV tidak boleh diubah."""
    raw = pd.read_csv(config.KELURAHAN_CSV)
    expected = ["KECAMATAN", "DESA", "latitude", "longitude"]
    if list(raw.columns) != expected:
        raise ValueError(f"Kolom CSV harus {expected}, dapat {list(raw.columns)}")
    df = raw.rename(columns={"KECAMATAN": "kecamatan", "DESA": "desa"})
    df.insert(0, "kelurahan_id", range(1, len(df) + 1))
    if df.duplicated(["kecamatan", "desa"]).any():
        raise ValueError("Pasangan (kecamatan, desa) harus unik")
    if df[["latitude", "longitude"]].isna().any().any():
        raise ValueError("Koordinat tidak boleh kosong")
    if ids:
        df = df[df["kelurahan_id"].isin(ids)].reset_index(drop=True)
        if df.empty:
            raise ValueError(f"Tidak ada kelurahan dengan id {ids}")
    return df


def prepare(conn: psycopg.Connection) -> None:
    """Jalankan schema.sql (semua perintahnya idempoten) lalu samakan tabel kelurahan dengan CSV."""
    with conn.cursor() as cur:
        cur.execute(config.SCHEMA_SQL.read_text(encoding="utf-8"))
    conn.commit()
    sync_kelurahan(conn)


def sync_kelurahan(conn: psycopg.Connection) -> int:
    df = load_kelurahan()
    q = S("""INSERT INTO {t} (kelurahan_id, kecamatan, desa, latitude, longitude)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (kelurahan_id) DO UPDATE SET kecamatan = EXCLUDED.kecamatan, desa = EXCLUDED.desa,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude""").format(t=I("kelurahan"))
    with conn.cursor() as cur:
        cur.executemany(q, [(int(r.kelurahan_id), r.kecamatan, r.desa, float(r.latitude), float(r.longitude))
                            for r in df.itertuples()])
    conn.commit()
    return len(df)


def _clean(v):
    if v is None or v is pd.NaT or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.to_pydatetime()
    return v


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


def upsert(conn: psycopg.Connection, spec: TableSpec, df: pd.DataFrame) -> dict[str, int]:
    """Upsert COALESCE per kolom: NULL baru tidak menimpa nilai lama, dan fetched_at hanya berubah
    jika ada nilai non-NULL baru yang berbeda. Aman dijalankan berulang."""
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


def read_frame(conn: psycopg.Connection, spec: TableSpec, where: sql.Composable) -> pd.DataFrame:
    cols = [*spec.key_cols, *spec.value_cols]
    q = S("SELECT {cols} FROM {t} WHERE {where} ORDER BY kelurahan_id, {tc}").format(
        cols=S(", ").join(I(c) for c in cols), t=I(spec.name), where=where, tc=I(spec.time_col))
    with conn.cursor() as cur:
        cur.execute(q)
        rows = cur.fetchall()
    conn.commit()
    if not rows:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(rows, columns=cols)
    if spec.granularity == "hourly":
        df["waktu_utc"] = pd.to_datetime(df["waktu_utc"], utc=True)
    else:
        df["tanggal"] = pd.to_datetime(df["tanggal"]).dt.date
    return df


def day_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (datetime.combine(start, dtime.min, tzinfo=timezone.utc),
            datetime.combine(end, dtime.max, tzinfo=timezone.utc))


def log_start(conn: psycopg.Connection, job: str, sumber: str, granularitas: str, kelurahan_id: int | None,
              mulai: datetime | None, akhir: datetime | None, tujuan: str | None = None) -> int:
    with conn.cursor() as cur:
        cur.execute(S("""INSERT INTO {t} (job, sumber, granularitas, kelurahan_id, rentang_mulai, rentang_akhir,
tujuan, status) VALUES (%s, %s, %s, %s, %s, %s, %s, 'running') RETURNING id""").format(t=I("ingestion_log")),
                    (job, sumber, granularitas, kelurahan_id, mulai, akhir, tujuan))
        log_id = cur.fetchone()[0]
    conn.commit()
    return log_id


def log_finish(conn: psycopg.Connection, log_id: int, status: str, jumlah_baris: int | None = None,
               pesan_error: str | None = None) -> None:
    if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
        conn.rollback()
    with conn.cursor() as cur:
        cur.execute(S("""UPDATE {t} SET status = %s, jumlah_baris = %s, pesan_error = %s, selesai_at = now()
WHERE id = %s""").format(t=I("ingestion_log")),
                    (status, jumlah_baris, pesan_error[:4000] if pesan_error else None, log_id))
    conn.commit()


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
