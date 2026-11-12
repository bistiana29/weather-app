"""Mengubah respons API menjadi DataFrame berkolom bersatuan. Tidak ada akses jaringan di sini."""
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from . import config
from .params import OPENMETEO_HOURLY, TableSpec

NASA_FILL = -999.0


class SourceFormatError(ValueError):
    pass


def empty_frame(spec: TableSpec) -> pd.DataFrame:
    return pd.DataFrame(columns=[*spec.key_cols, *spec.value_cols])


def nasa_to_frame(payload: dict, spec: TableSpec, location_id: int) -> pd.DataFrame:
    expected_ts = config.NASA_TIME_STANDARD[spec.granularity]
    header = payload.get("header", {})
    if header.get("time_standard") != expected_ts:
        raise SourceFormatError(f"NASA time_standard {header.get('time_standard')!r} != {expected_ts!r}")
    fill = float(header.get("fill_value", NASA_FILL))
    raw = payload["properties"]["parameter"]
    data = {}
    for p in spec.params:
        if p.api_code not in raw:
            raise SourceFormatError(f"Parameter NASA hilang di respons: {p.api_code}")
        data[p.column] = pd.Series(raw[p.api_code], dtype="float64")
    df = pd.DataFrame(data)
    if df.empty:
        return empty_frame(spec)
    df = df.mask(np.isclose(df.to_numpy(dtype="float64"), fill) | (df <= NASA_FILL))
    keys = df.index.astype(str)
    if spec.granularity == "hourly":
        t = pd.to_datetime(keys, format="%Y%m%d%H", utc=True)
    else:
        t = pd.to_datetime(keys, format="%Y%m%d").date
    df.insert(0, spec.time_col, t)
    df.insert(0, spec.location_col, int(location_id))
    return df.reset_index(drop=True)


def openmeteo_to_frame(payload: dict, spec: TableSpec, location_id: int, endpoint: str = "default") -> pd.DataFrame:
    params = spec.params_for(endpoint)
    block = spec.granularity
    if block not in payload:
        raise SourceFormatError(f"Blok {block!r} tidak ada di respons Open-Meteo")
    units = payload.get(f"{block}_units", {})
    for p in params:
        if units.get(p.api_code) not in (None, p.unit):
            raise SourceFormatError(f"Satuan {p.api_code} berubah: {units.get(p.api_code)!r} != {p.unit!r}")
    times = payload[block]["time"]
    if spec.granularity == "hourly":
        if "utc_offset_seconds" not in payload:
            raise SourceFormatError("utc_offset_seconds wajib ada pada respons Open-Meteo hourly")
        naive = pd.to_datetime(times)
        offset = pd.Timedelta(seconds=int(payload["utc_offset_seconds"]))
        t = (naive - offset).tz_localize("UTC") if naive.tz is None else naive.tz_convert("UTC")
    else:
        if payload.get("timezone") != config.LOCAL_TZ:
            raise SourceFormatError(f"Open-Meteo daily harus memakai timezone {config.LOCAL_TZ}")
        t = pd.to_datetime(times).date
    data = {spec.location_col: int(location_id), spec.time_col: t}
    for p in params:
        vals = payload[block].get(p.api_code)
        if vals is None:
            raise SourceFormatError(f"Variabel Open-Meteo hilang di respons: {p.api_code}")
        data[p.column] = pd.to_numeric(pd.Series(vals, dtype="object"), errors="coerce").astype("float64")
    return pd.DataFrame(data)


def merge_openmeteo_hourly(archive_df: pd.DataFrame, visibility_df: pd.DataFrame | None) -> pd.DataFrame:
    vis_col = "visibility (m)"
    df = archive_df.copy()
    if visibility_df is None or visibility_df.empty:
        df[vis_col] = np.nan
    else:
        df = df.merge(visibility_df[["kelurahan_id", "waktu_utc", vis_col]], on=["kelurahan_id", "waktu_utc"], how="left")
    return df[[*OPENMETEO_HOURLY.key_cols, *OPENMETEO_HOURLY.value_cols]]


def drop_future(df: pd.DataFrame, spec: TableSpec, now: datetime | None = None) -> pd.DataFrame:
    """Hourly: buang jam setelah jam UTC yang sedang berjalan. Daily: buang hari ini (WIB) dan sesudahnya karena belum selesai."""
    if df.empty:
        return df
    now_ts = pd.Timestamp(now or datetime.now(timezone.utc))
    now_ts = now_ts.tz_convert("UTC") if now_ts.tzinfo else now_ts.tz_localize("UTC")
    if spec.granularity == "hourly":
        keep = pd.to_datetime(df[spec.time_col], utc=True) <= now_ts.floor("h")
    else:
        today_local = now_ts.tz_convert(config.LOCAL_TZ).date()
        keep = pd.Series(df[spec.time_col]).map(lambda d: d < today_local).to_numpy()
    return df[keep].reset_index(drop=True)


def drop_all_null(df: pd.DataFrame, spec: TableSpec) -> pd.DataFrame:
    cols = [c for c in spec.value_cols if c in df.columns]
    return df.dropna(subset=cols, how="all").reset_index(drop=True) if cols else df.iloc[0:0]


def coalesce_dupes(df: pd.DataFrame, spec: TableSpec) -> pd.DataFrame:
    """Gabungkan baris berkunci sama; per kolom, nilai non-NULL terakhir yang menang (semantik COALESCE)."""
    if df.empty or not df.duplicated(list(spec.key_cols)).any():
        return df
    return df.groupby(list(spec.key_cols), as_index=False, sort=False).last()
