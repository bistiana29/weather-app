"""Membaca data untuk pemodelan dan validasi.

    from pipeline import load_dataset, load_stasiun
    df = load_dataset("nasa", "2022-01-01", "2026-11-01", mature_only=True)   # hourly 153 kelurahan
    st = load_stasiun("openmeteo", "2022-01-01")                              # daily titik stasiun BMKG
"""
from datetime import date, datetime, time as dtime, timezone

import pandas as pd
from psycopg import sql

from . import config, db, params, storage
from .params import TableSpec

I, L, S = sql.Identifier, sql.Literal, sql.SQL


def _to_utc_ts(val: str | date | datetime, end_of_day: bool) -> pd.Timestamp:
    if isinstance(val, date) and not isinstance(val, datetime):
        return pd.Timestamp(datetime.combine(val, dtime.max if end_of_day else dtime.min, tzinfo=timezone.utc))
    ts = pd.Timestamp(val)
    if ts.tzinfo is not None:
        return ts.tz_convert("UTC")
    if end_of_day and len(str(val).strip()) <= 10:
        ts += pd.Timedelta(hours=23, minutes=59, seconds=59)
    return ts.tz_localize("UTC")


def _filter_frame_range(df: pd.DataFrame, start_bound, end_bound, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    if df.empty:
        return df
    if kelurahan_ids:
        df = df[df["kelurahan_id"].isin(kelurahan_ids)]
    t = pd.to_datetime(df["waktu_utc"], utc=True)
    return df[(t >= start_bound) & (t <= end_bound)].reset_index(drop=True)


def _read_cold_parquet(spec: TableSpec, start_d: date, end_d: date) -> pd.DataFrame:
    client = storage.SupabaseStorageClient()
    frames = []
    for ym in pd.period_range(start_d, end_d, freq="M").strftime("%Y-%m"):
        raw = client.download_bytes(storage.remote_object_path(spec.source, spec.granularity, ym))
        if raw:
            frames.append(storage.parquet_bytes_to_dataframe(raw, spec))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=[*spec.key_cols, *spec.value_cols])


def _read_hot_postgres(spec: TableSpec, start_bound, end_bound, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    where = S("{tc} >= {lo} AND {tc} <= {hi}").format(
        tc=I(spec.time_col), lo=L(start_bound.to_pydatetime()), hi=L(end_bound.to_pydatetime()))
    if kelurahan_ids:
        where = where + S(" AND kelurahan_id IN ({ids})").format(ids=S(", ").join(L(int(x)) for x in kelurahan_ids))
    with db.connect() as conn:
        return db.read_frame(conn, spec, where)


def load_dataset(sumber: str, mulai: str | date | datetime, akhir: str | date | datetime,
                 mature_only: bool = False, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    """Data hourly 153 kelurahan: gabungan Parquet bulanan dan Postgres dengan aturan COALESCE
    (nilai Postgres menang jika non-NULL).

    mature_only=True hanya mengembalikan data yang lebih tua dari MATURE_DAYS (120 hari), yaitu data yang
    tidak akan direvisi lagi oleh sumber.
    """
    spec = params.get_spec(sumber.lower().strip())
    start_bound, end_bound = _to_utc_ts(mulai, end_of_day=False), _to_utc_ts(akhir, end_of_day=True)
    if mature_only:
        end_bound = min(end_bound, pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=config.MATURE_DAYS))
    if start_bound > end_bound:
        return storage.normalize_for_parquet(pd.DataFrame(columns=[*spec.key_cols, *spec.value_cols]), spec)

    cold_df = _filter_frame_range(_read_cold_parquet(spec, start_bound.date(), end_bound.date()),
                                  start_bound, end_bound, kelurahan_ids)
    hot_df = _filter_frame_range(_read_hot_postgres(spec, start_bound, end_bound, kelurahan_ids),
                                 start_bound, end_bound, kelurahan_ids)
    return storage.merge_coalesce_frames(cold_df, hot_df, spec)


def load_stasiun(sumber: str, mulai: str | date | None = None, akhir: str | date | None = None) -> pd.DataFrame:
    """Data daily titik stasiun BMKG dari Postgres, dengan kolom id_wmo, nama_stasiun, tanggal, lalu nilai parameter."""
    spec = params.get_spec(sumber.lower().strip(), "daily")
    # Tanggal lewat sql.Literal, bukan parameter %s, karena nama kolom seperti "RH2M (%)" mengandung tanda %.
    where = S("TRUE")
    if mulai:
        where = where + S(" AND t.tanggal >= {d}").format(d=L(pd.Timestamp(mulai).date()))
    if akhir:
        where = where + S(" AND t.tanggal <= {d}").format(d=L(pd.Timestamp(akhir).date()))
    q = S("""SELECT t.id_wmo, s.nama AS nama_stasiun, t.tanggal, {cols}
FROM {t} t JOIN stasiun_bmkg s USING (id_wmo)
WHERE {where}
ORDER BY t.id_wmo, t.tanggal""").format(cols=S(", ").join(S("t.{c}").format(c=I(c)) for c in spec.value_cols),
                                         t=I(spec.name), where=where)
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute(q)
        rows = cur.fetchall()
        columns = [d.name for d in cur.description]
    return pd.DataFrame(rows, columns=columns)
