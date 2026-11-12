"""Parameter tiap tabel. Nama kolom = "<kode API> (<satuan>)"; satuan sesuai metadata API (Open-Meteo memakai wind_speed_unit=kn).
Hourly diambil untuk 153 kelurahan; daily hanya untuk titik stasiun BMKG."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Param:
    api_code: str
    unit: str
    endpoint: str = "default"

    @property
    def column(self) -> str:
        return f"{self.api_code} ({self.unit})"


@dataclass(frozen=True)
class TableSpec:
    name: str
    source: str
    granularity: str
    params: tuple[Param, ...]
    location_col: str = "kelurahan_id"

    @property
    def time_col(self) -> str:
        return "waktu_utc" if self.granularity == "hourly" else "tanggal"

    @property
    def key_cols(self) -> tuple[str, str]:
        return (self.location_col, self.time_col)

    @property
    def value_cols(self) -> list[str]:
        return [p.column for p in self.params]

    def params_for(self, endpoint: str) -> list[Param]:
        return [p for p in self.params if p.endpoint == endpoint]


NASA_HOURLY = TableSpec("nasa_hourly", "nasa", "hourly", (
    Param("T2M", "°C"),
    Param("WS2M", "m/s"),
    Param("WD2M", "°"),
    Param("PRECTOTCORR", "mm/jam"),
    Param("RH2M", "%"),
    Param("PS", "kPa"),
))

NASA_DAILY_STASIUN = TableSpec("nasa_daily_stasiun", "nasa", "daily", (
    Param("T2M", "°C"),
    Param("T2M_MAX", "°C"),
    Param("T2M_MIN", "°C"),
    Param("WS2M", "m/s"),
    Param("WS2M_MAX", "m/s"),
    Param("WD2M", "°"),
    Param("PRECTOTCORR", "mm/hari"),
    Param("RH2M", "%"),
), location_col="id_wmo")

# Archive API tidak menyediakan visibility, jadi kolom itu diambil dari Historical Forecast API.
OPENMETEO_HOURLY = TableSpec("openmeteo_hourly", "openmeteo", "hourly", (
    Param("temperature_2m", "°C"),
    Param("wind_speed_10m", "kn"),
    Param("wind_direction_10m", "°"),
    Param("relative_humidity_2m", "%"),
    Param("precipitation", "mm"),
    Param("sunshine_duration", "s"),
    Param("surface_pressure", "hPa"),
    Param("visibility", "m", endpoint="historical_forecast"),
))

OPENMETEO_DAILY_STASIUN = TableSpec("openmeteo_daily_stasiun", "openmeteo", "daily", (
    Param("temperature_2m_mean", "°C"),
    Param("temperature_2m_max", "°C"),
    Param("temperature_2m_min", "°C"),
    Param("wind_speed_10m_mean", "kn"),
    Param("wind_speed_10m_max", "kn"),
    Param("wind_direction_10m_dominant", "°"),
    Param("precipitation_sum", "mm"),
    Param("relative_humidity_2m_mean", "%"),
    Param("sunshine_duration", "s"),
), location_col="id_wmo")

TABLES = {t.source: t for t in (NASA_HOURLY, OPENMETEO_HOURLY)}
STASIUN_TABLES = {t.source: t for t in (NASA_DAILY_STASIUN, OPENMETEO_DAILY_STASIUN)}
SOURCES = ("nasa", "openmeteo")


def get_spec(source: str, granularity: str = "hourly") -> TableSpec:
    tables = TABLES if granularity == "hourly" else STASIUN_TABLES if granularity == "daily" else {}
    try:
        return tables[source]
    except KeyError:
        raise ValueError(f"Kombinasi tidak dikenal: {source}/{granularity}") from None
