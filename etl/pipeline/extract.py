"""
Extract: mengambil data cuaca mentah dari NASA POWER dan Open-Meteo (Archive, Historical Forecast, Air Quality), dengan retry, jeda, dan penghitung kuota Open-Meteo.

Alur file: ingest.py / backfill.py / stasiun.py / elevasi.py → extract.py → transform.py
Alur fungsi: fetch_hourly() / fetch_daily_stasiun() / fetch_elevation() → _nasa_get() / _openmeteo_get() (acquire_budget()) → _get_json() → transform.nasa_to_frame() / openmeteo_to_frame()
"""
import json
import logging
import threading
import time
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import requests

from . import config, params, transform

logger = logging.getLogger(__name__)

NASA_URL = "https://power.larc.nasa.gov/api/temporal"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORICAL_FORECAST_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
NASA_MAX_DAYS_PER_HOURLY_REQUEST = 366
OPENMETEO_MIN_INTERVAL_S = 0.15
OPENMETEO_MAX_RETRY_AFTER_S = 300
BUDGET_FILE = config.WORK_DIR / "openmeteo_budget.json"

# URL dan parameter tambahan per endpoint Open-Meteo hourly; semua memakai timezone GMT agar kolom waktu sejajar.
OPENMETEO_HOURLY_ENDPOINTS = {
    "default": (ARCHIVE_URL, {"wind_speed_unit": config.OPENMETEO_WIND_UNIT, "timezone": "GMT"}),
    "historical_forecast": (HISTORICAL_FORECAST_URL, {"timezone": "GMT"}),
    "air_quality": (AIR_QUALITY_URL, {"timezone": "GMT"}),
}
ENDPOINT_LABEL = {"default": "archive", "historical_forecast": "historical_forecast", "air_quality": "air_quality"}


class RateLimitError(RuntimeError):
    """API menolak permintaan karena batas kuota (HTTP 429). Job harus berhenti."""


class BudgetExceededError(RuntimeError):
    """Penghitung kuota lokal memperkirakan panggilan berikutnya melewati batas Open-Meteo gratis."""


_session = requests.Session()
_session.headers["User-Agent"] = "surabaya-weather-pipeline/0.1"
_nasa_lock = threading.Lock()
_nasa_last_call = 0.0
_openmeteo_last_call = 0.0


# Menunggu sampai jeda minimal antar-request NASA terpenuhi (aman dipakai banyak thread)
def _wait_nasa_turn() -> None:
    global _nasa_last_call
    with _nasa_lock:
        wait = config.NASA_MIN_INTERVAL_S - (time.monotonic() - _nasa_last_call)
        if wait > 0:
            time.sleep(wait)
        _nasa_last_call = time.monotonic()


# Membaca header Retry-After (detik) dari respons, None bila tidak ada
def _retry_after(resp: requests.Response | None) -> float | None:
    try:
        return float(resp.headers["Retry-After"])
    except (AttributeError, KeyError, TypeError, ValueError):
        return None


# GET JSON dengan retry backoff; HTTP 429 langsung menjadi RateLimitError kecuali retry_429 (Open-Meteo)
def _get_json(url: str, query: dict, max_retries: int, before_call=None, retry_429: bool = False) -> dict:
    for attempt in range(1, max_retries + 1):
        if before_call:
            before_call()
        try:
            resp = _session.get(url, params=query, timeout=90)
            if resp.status_code == 429 and not retry_429:
                raise RateLimitError(f"{url} menolak dengan HTTP 429 (batas kuota tercapai)")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            resp = getattr(exc, "response", None)
            status = getattr(resp, "status_code", None)
            retry_after = _retry_after(resp) if status == 429 or (status or 0) >= 500 else None
            delay = min(2 ** attempt, 60) if retry_after is None else retry_after
            # Retry-After yang sangat panjang berarti kuota harian habis; menunggu tidak ada gunanya.
            if attempt == max_retries or delay > OPENMETEO_MAX_RETRY_AFTER_S:
                if status == 429:
                    raise RateLimitError(f"{url} menolak dengan HTTP 429 setelah {attempt} percobaan "
                                         f"(Retry-After={retry_after})") from exc
                raise RuntimeError(f"{url} gagal setelah {attempt} percobaan: {exc}") from exc
            logger.warning("%s gagal (%s), coba lagi dalam %ds (%d/%d)", url, exc, delay, attempt, max_retries)
            time.sleep(delay)


# Memecah rentang tanggal menjadi potongan berisi paling banyak max_days hari
def _date_chunks(start: date, end: date, max_days: int) -> list[tuple[date, date]]:
    chunks = []
    while start <= end:
        chunk_end = min(end, start + timedelta(days=max_days - 1))
        chunks.append((start, chunk_end))
        start = chunk_end + timedelta(days=1)
    return chunks


# Menyusun query NASA POWER (parameter endpoint default, termasuk bahan hitung) lalu memanggil _get_json()
def _nasa_get(spec: params.TableSpec, lat: float, lon: float, start: date, end: date) -> dict:
    query = {
        "parameters": ",".join(p.api_code for p in spec.params_for("default")),
        "community": config.NASA_COMMUNITY,
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": config.NASA_TIME_STANDARD[spec.granularity],
    }
    return _get_json(f"{NASA_URL}/{spec.granularity}/point", query, max_retries=6, before_call=_wait_nasa_turn)


# Mengambil NASA hourly per potongan 366 hari, mengubahnya lewat transform, lalu menghitung DPD
def fetch_nasa_hourly(kelurahan_id: int, lat: float, lon: float, start: date, end: date,
                      spec: params.TableSpec = params.NASA_HOURLY) -> pd.DataFrame:
    frames = [transform.nasa_to_frame(_nasa_get(spec, lat, lon, s, e), spec, kelurahan_id)
              for s, e in _date_chunks(start, end, NASA_MAX_DAYS_PER_HOURLY_REQUEST)]
    df = transform.finalize_frame(pd.concat(frames, ignore_index=True), spec) if frames else transform.empty_frame(spec)
    return transform.drop_all_null(transform.drop_future(df, spec), spec)


# Menghitung bobot panggilan dengan rumus resmi Open-Meteo: nLocations * max(1, (nDays / 14) * (nVariables / 10))
def call_weight(n_locations: int, n_days: int, n_variables: int) -> float:
    if n_locations <= 0 or n_days <= 0 or n_variables <= 0:
        return 0.0
    return n_locations * max(1.0, (n_days / 14.0) * (n_variables / 10.0))


# Menjumlahkan bobot yang terpakai pada hari UTC ini, 1 jam terakhir, dan 1 menit terakhir
def budget_usage(events: list[tuple[float, float, str]], now: float) -> dict[str, float]:
    day_start = datetime.fromtimestamp(now, tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "day": sum(w for ts, w, _ in events if ts >= day_start.timestamp()),
        "hour": sum(w for ts, w, _ in events if ts >= now - 3600),
        "minute": sum(w for ts, w, _ in events if ts >= now - 60),
    }


# Membaca riwayat pemakaian kuota (waktu, bobot, endpoint) dari _work/openmeteo_budget.json
def _load_budget_events() -> list[tuple[float, float, str]]:
    try:
        return [(float(e[0]), float(e[1]), str(e[2]) if len(e) > 2 else "")
                for e in json.loads(BUDGET_FILE.read_text(encoding="utf-8"))["events"]]
    except FileNotFoundError:
        return []
    except Exception as exc:
        logger.warning("Gagal membaca %s, penghitung kuota dimulai dari nol: %s", BUDGET_FILE, exc)
        return []


# Menolak panggilan yang melewati kuota harian/per jam, menunggu bila melewati kuota per menit, lalu mencatat bobot per endpoint
def acquire_budget(weight: float, endpoint: str = "") -> None:
    global _openmeteo_last_call
    now = time.time()
    events = _load_budget_events()
    used = budget_usage(events, now)
    if used["day"] + weight > config.OPENMETEO_LIMIT_DAY:
        raise BudgetExceededError(f"Kuota harian Open-Meteo penuh: {used['day']:.1f} + {weight:.1f} > {config.OPENMETEO_LIMIT_DAY}")
    if used["hour"] + weight > config.OPENMETEO_LIMIT_HOUR:
        raise BudgetExceededError(f"Kuota per jam Open-Meteo penuh: {used['hour']:.1f} + {weight:.1f} > {config.OPENMETEO_LIMIT_HOUR}")
    if used["minute"] + weight > config.OPENMETEO_LIMIT_MINUTE:
        logger.info("Mendekati batas per menit Open-Meteo (%.1f), jeda 60 detik", used["minute"])
        time.sleep(60.5)
        now = time.time()
    wait = OPENMETEO_MIN_INTERVAL_S - (time.monotonic() - _openmeteo_last_call)
    if wait > 0:
        time.sleep(wait)
    _openmeteo_last_call = time.monotonic()

    events.append((now, float(weight), endpoint))
    day_start = datetime.fromtimestamp(now, tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = min(day_start.timestamp(), now - 3600)
    BUDGET_FILE.parent.mkdir(parents=True, exist_ok=True)
    BUDGET_FILE.write_text(json.dumps({"events": [list(e) for e in events if e[0] >= cutoff]}), encoding="utf-8")


# Menyusun query Open-Meteo, memanggil acquire_budget(), lalu _get_json() dengan retry 429/5xx
def _openmeteo_get(url: str, spec: params.TableSpec, endpoint: str, lat: float, lon: float,
                   start: date, end: date, extra: dict) -> dict:
    variables = spec.params_for(endpoint)
    query = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        spec.granularity: ",".join(p.api_code for p in variables),
        **extra,
    }
    acquire_budget(call_weight(1, (end - start).days + 1, len(variables)),
                   f"{ENDPOINT_LABEL.get(endpoint, endpoint)}/{spec.granularity}")
    return _get_json(url, query, max_retries=5, retry_429=True)


# Memanggil setiap endpoint Open-Meteo milik spec; endpoint pertama wajib, endpoint berikutnya boleh gagal (NULL)
def fetch_openmeteo_hourly(kelurahan_id: int, lat: float, lon: float, start: date, end: date,
                           spec: params.TableSpec = params.OPENMETEO_HOURLY) -> pd.DataFrame:
    frames = {}
    for i, endpoint in enumerate(spec.endpoints):
        url, extra = OPENMETEO_HOURLY_ENDPOINTS[endpoint]
        try:
            payload = _openmeteo_get(url, spec, endpoint, lat, lon, start, end, extra)
            frames[endpoint] = transform.openmeteo_to_frame(payload, spec, kelurahan_id, endpoint)
        except (RateLimitError, BudgetExceededError):
            raise
        except Exception as exc:
            if i == 0:
                raise
            logger.warning("%s tidak tersedia untuk kelurahan_id=%d (%s..%s), diisi NULL: %s",
                           ENDPOINT_LABEL[endpoint], kelurahan_id, start, end, exc)
            frames[endpoint] = None
    df = transform.merge_openmeteo_hourly(frames, spec)
    return transform.drop_all_null(transform.drop_future(df, spec), spec)


# Mengubah rentang WIB menjadi tanggal UTC yang harus diminta, karena hourly diminta dalam UTC
def utc_dates(start: datetime, end: datetime) -> tuple[date, date]:
    return start.astimezone(timezone.utc).date(), end.astimezone(timezone.utc).date()


# Memanggil fetch_nasa_hourly() atau fetch_openmeteo_hourly() sesuai sumber, lalu memangkas ke start..end (WIB)
def fetch_hourly(source: str, kelurahan_id: int, lat: float, lon: float, start: datetime, end: datetime,
                 spec: params.TableSpec | None = None) -> pd.DataFrame:
    spec = spec or params.get_spec(source)
    d_start, d_end = utc_dates(start, end)
    if source == "nasa":
        df = fetch_nasa_hourly(kelurahan_id, lat, lon, d_start, d_end, spec)
    else:
        df = fetch_openmeteo_hourly(kelurahan_id, lat, lon, d_start, d_end, spec)
    if df.empty:
        return df
    t = pd.to_datetime(df["waktu"], utc=True)
    return df[(t >= pd.Timestamp(start)) & (t <= pd.Timestamp(end))].reset_index(drop=True)


# Mengambil data daily satu stasiun BMKG; elevasi tidak di-set (default API) seperti data hourly
def fetch_daily_stasiun(spec: params.TableSpec, id_wmo: int, lat: float, lon: float,
                        start: date, end: date) -> pd.DataFrame:
    if spec.source == "nasa":
        df = transform.nasa_to_frame(_nasa_get(spec, lat, lon, start, end), spec, id_wmo)
    else:
        payload = _openmeteo_get(ARCHIVE_URL, spec, "default", lat, lon, start, end,
                                 {"wind_speed_unit": config.OPENMETEO_WIND_UNIT, "timezone": config.LOCAL_TZ})
        df = transform.openmeteo_to_frame(payload, spec, id_wmo, "default")
    return transform.drop_all_null(transform.drop_future(df, spec), spec)


# Mengambil elevasi titik grid dari metadata respons satu hari (NASA: geometry, Open-Meteo: elevation)
def fetch_elevation(spec: params.TableSpec, endpoint: str, lat: float, lon: float, day: date) -> float | None:
    if spec.source == "nasa":
        coords = _nasa_get(spec, lat, lon, day, day).get("geometry", {}).get("coordinates", [])
        return coords[2] if len(coords) > 2 else None
    one = params.TableSpec(spec.name, spec.source, spec.granularity, (spec.params_for(endpoint)[0],))
    if spec.granularity == "daily":
        url, extra = ARCHIVE_URL, {"wind_speed_unit": config.OPENMETEO_WIND_UNIT, "timezone": config.LOCAL_TZ}
    else:
        url, extra = OPENMETEO_HOURLY_ENDPOINTS[endpoint]
    return _openmeteo_get(url, one, endpoint, lat, lon, day, day, extra).get("elevation")
