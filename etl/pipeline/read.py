"""Membaca data gabungan lapis dingin (Parquet) dan lapis panas (Postgres) untuk pemodelan.

    from pipeline import load_dataset
    df = load_dataset("nasa", "hourly", "2022-01-01", "2026-11-01", mature_only=True)
"""
from datetime import date, datetime, time as dtime, timedelta, timezone

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


def _filter_frame_range(df: pd.DataFrame, spec: TableSpec, start_bound, end_bound,
                        kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    if df.empty:
        return df
    if kelurahan_ids:
        df = df[df["kelurahan_id"].isin(kelurahan_ids)]
    if spec.granularity == "hourly":
        t = pd.to_datetime(df["waktu_utc"], utc=True)
    else:
        t = pd.to_datetime(df["tanggal"]).dt.date
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
    lo = start_bound.to_pydatetime() if isinstance(start_bound, pd.Timestamp) else start_bound
    hi = end_bound.to_pydatetime() if isinstance(end_bound, pd.Timestamp) else end_bound
    where = S("{tc} >= {lo} AND {tc} <= {hi}").format(tc=I(spec.time_col), lo=L(lo), hi=L(hi))
    if kelurahan_ids:
        where = where + S(" AND kelurahan_id IN ({ids})").format(ids=S(", ").join(L(int(x)) for x in kelurahan_ids))
    with db.connect() as conn:
        return db.read_frame(conn, spec, where)


def load_dataset(sumber: str, granularitas: str, mulai: str | date | datetime, akhir: str | date | datetime,
                 mature_only: bool = False, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    """Gabungkan Parquet bulanan dan Postgres dengan aturan COALESCE (nilai Postgres menang jika non-NULL).

    mature_only=True hanya mengembalikan data yang lebih tua dari MATURE_DAYS (120 hari), yaitu data yang
    tidak akan direvisi lagi oleh sumber.
    """
    spec = params.get_spec(sumber.lower().strip(), granularitas.lower().strip())
    mature_cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=config.MATURE_DAYS)

    if spec.granularity == "hourly":
        start_bound, end_bound = _to_utc_ts(mulai, end_of_day=False), _to_utc_ts(akhir, end_of_day=True)
        if mature_only:
            end_bound = min(end_bound, mature_cutoff)
        start_d, end_d = start_bound.date(), end_bound.date()
    else:
        start_bound, end_bound = pd.Timestamp(mulai).date(), pd.Timestamp(akhir).date()
        if mature_only:
            end_bound = min(end_bound, mature_cutoff.date() - timedelta(days=1))
        start_d, end_d = start_bound, end_bound
    if start_bound > end_bound:
        return storage.normalize_for_parquet(pd.DataFrame(columns=[*spec.key_cols, *spec.value_cols]), spec)

    cold_df = _filter_frame_range(_read_cold_parquet(spec, start_d, end_d), spec, start_bound, end_bound, kelurahan_ids)
    hot_df = _filter_frame_range(_read_hot_postgres(spec, start_bound, end_bound, kelurahan_ids),
                                 spec, start_bound, end_bound, kelurahan_ids)
    return storage.merge_coalesce_frames(cold_df, hot_df, spec)
