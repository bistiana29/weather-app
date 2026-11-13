"""
Pendukung: membaca data untuk pemodelan dan validasi, yaitu hourly 153 kelurahan (Parquet + Postgres) dan daily stasiun BMKG.

Alur file: __init__.py → read.py → load.py
Alur fungsi: load_dataset() → _read_cold_parquet() + _read_hot_postgres() → load.merge_coalesce_frames(); load_stasiun() → Postgres
"""
from datetime import date, datetime, time as dtime

import pandas as pd
from psycopg import sql

from . import config, load, params
from .params import TableSpec

I, L, S = sql.Identifier, sql.Literal, sql.SQL


# Mengubah tanggal/waktu masukan menjadi Timestamp WIB; nilai tanpa zona dianggap WIB
def _to_wib_ts(val: str | date | datetime, end_of_day: bool) -> pd.Timestamp:
    if isinstance(val, date) and not isinstance(val, datetime):
        return pd.Timestamp(datetime.combine(val, dtime.max if end_of_day else dtime.min, tzinfo=config.WIB))
    ts = pd.Timestamp(val)
    if ts.tzinfo is not None:
        return ts.tz_convert(config.LOCAL_TZ)
    if end_of_day and len(str(val).strip()) <= 10:
        ts += pd.Timedelta(hours=23, minutes=59, seconds=59)
    return ts.tz_localize(config.LOCAL_TZ)


# Memangkas frame ke rentang waktu dan, bila diberikan, ke daftar kelurahan
def _filter_frame_range(df: pd.DataFrame, start_bound, end_bound, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    if df.empty:
        return df
    if kelurahan_ids:
        df = df[df["kelurahan_id"].isin(kelurahan_ids)]
    t = pd.to_datetime(df["waktu"], utc=True)
    return df[(t >= start_bound) & (t <= end_bound)].reset_index(drop=True)


# Mengunduh file Parquet bulanan dari Storage untuk rentang start_d..end_d
def _read_cold_parquet(spec: TableSpec, start_d: date, end_d: date) -> pd.DataFrame:
    client = load.SupabaseStorageClient()
    frames = []
    for ym in pd.period_range(start_d, end_d, freq="M").strftime("%Y-%m"):
        raw = client.download_bytes(load.remote_object_path(spec.source, spec.granularity, ym))
        if raw:
            frames.append(load.parquet_bytes_to_dataframe(raw, spec))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=[*spec.key_cols, *spec.value_cols])


# Membaca baris Postgres untuk rentang waktu dan daftar kelurahan
def _read_hot_postgres(spec: TableSpec, start_bound, end_bound, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    where = S("{tc} >= {lo} AND {tc} <= {hi}").format(
        tc=I(spec.time_col), lo=L(start_bound.to_pydatetime()), hi=L(end_bound.to_pydatetime()))
    if kelurahan_ids:
        where = where + S(" AND kelurahan_id IN ({ids})").format(ids=S(", ").join(L(int(x)) for x in kelurahan_ids))
    with load.connect() as conn:
        return load.read_frame(conn, spec, where)


# Menggabungkan Parquet dan Postgres (COALESCE, nilai Postgres menang); mature_only membatasi ke data > 120 hari
def load_dataset(sumber: str, mulai: str | date | datetime, akhir: str | date | datetime,
                 mature_only: bool = False, kelurahan_ids: list[int] | None = None) -> pd.DataFrame:
    spec = params.get_spec(sumber.lower().strip())
    start_bound, end_bound = _to_wib_ts(mulai, end_of_day=False), _to_wib_ts(akhir, end_of_day=True)
    if mature_only:
        # Data lebih tua dari MATURE_DAYS tidak akan direvisi lagi oleh sumber.
        end_bound = min(end_bound, pd.Timestamp.now(tz=config.LOCAL_TZ) - pd.Timedelta(days=config.MATURE_DAYS))
    if start_bound > end_bound:
        return load.normalize_for_parquet(pd.DataFrame(columns=[*spec.key_cols, *spec.value_cols]), spec)

    cold_df = _filter_frame_range(_read_cold_parquet(spec, start_bound.date(), end_bound.date()),
                                  start_bound, end_bound, kelurahan_ids)
    hot_df = _filter_frame_range(_read_hot_postgres(spec, start_bound, end_bound, kelurahan_ids),
                                 start_bound, end_bound, kelurahan_ids)
    return load.merge_coalesce_frames(cold_df, hot_df, spec)


# Membaca data daily stasiun BMKG dari Postgres beserta nama stasiun; tanggal mengikuti tanggal lokal sumber
def load_stasiun(sumber: str, mulai: str | date | None = None, akhir: str | date | None = None) -> pd.DataFrame:
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
    with load.connect() as conn, conn.cursor() as cur:
        cur.execute(q)
        rows = cur.fetchall()
        columns = [d.name for d in cur.description]
    return pd.DataFrame(rows, columns=columns)
