"""Pengambilan data dari NASA POWER dan Open-Meteo: retry untuk galat sementara, jeda antar-panggilan,
dan penghitung kuota Open-Meteo yang disimpan lokal di _work/openmeteo_budget.json."""
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
NASA_MAX_DAYS_PER_HOURLY_REQUEST = 366
OPENMETEO_MIN_INTERVAL_S = 0.15
BUDGET_FILE = config.WORK_DIR / "openmeteo_budget.json"


class RateLimitError(RuntimeError):
    """API menolak permintaan karena batas kuota (HTTP 429). Tidak di-retry: job harus berhenti."""


class BudgetExceededError(RuntimeError):
    """Penghitung kuota lokal memperkirakan panggilan berikutnya melewati batas Open-Meteo gratis."""


_session = requests.Session()
_session.headers["User-Agent"] = "surabaya-weather-pipeline/0.1"
_nasa_lock = threading.Lock()
_nasa_last_call = 0.0
_openmeteo_last_call = 0.0


def _wait_nasa_turn() -> None:
    global _nasa_last_call
    with _nasa_lock:
        wait = config.NASA_MIN_INTERVAL_S - (time.monotonic() - _nasa_last_call)
        if wait > 0:
            time.sleep(wait)
        _nasa_last_call = time.monotonic()


def _get_json(url: str, query: dict, max_retries: int, before_call=None) -> dict:
    for attempt in range(1, max_retries + 1):
        if before_call:
            before_call()
        try:
            resp = _session.get(url, params=query, timeout=90)
            if resp.status_code == 429:
                raise RateLimitError(f"{url} menolak dengan HTTP 429 (batas kuota tercapai)")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            if attempt == max_retries:
                raise RuntimeError(f"{url} gagal setelah {max_retries} percobaan: {exc}") from exc
            delay = min(2 ** attempt, 60)
            logger.warning("%s gagal (%s), coba lagi dalam %ds (%d/%d)", url, exc, delay, attempt, max_retries)
            time.sleep(delay)


def _date_chunks(start: date, end: date, max_days: int) -> list[tuple[date, date]]:
    chunks = []
    while start <= end:
        chunk_end = min(end, start + timedelta(days=max_days - 1))
        chunks.append((start, chunk_end))
        start = chunk_end + timedelta(days=1)
    return chunks


def _nasa_get(spec: params.TableSpec, lat: float, lon: float, start: date, end: date) -> dict:
    query = {
        "parameters": ",".join(p.api_code for p in spec.params),
        "community": config.NASA_COMMUNITY,
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": config.NASA_TIME_STANDARD[spec.granularity],
    }
    return _get_json(f"{NASA_URL}/{spec.granularity}/point", query, max_retries=6, before_call=_wait_nasa_turn)


def fetch_nasa_hourly(kelurahan_id: int, lat: float, lon: float, start: date, end: date) -> pd.DataFrame:
    spec = params.NASA_HOURLY
    frames = [transform.nasa_to_frame(_nasa_get(spec, lat, lon, s, e), spec, kelurahan_id)
              for s, e in _date_chunks(start, end, NASA_MAX_DAYS_PER_HOURLY_REQUEST)]
    df = pd.concat(frames, ignore_index=True) if frames else transform.empty_frame(spec)
    return transform.drop_all_null(transform.drop_future(df, spec), spec)


def call_weight(n_locations: int, n_days: int, n_variables: int) -> float:
    """Rumus bobot resmi Open-Meteo: nLocations * max(1, (nDays / 14) * (nVariables / 10))."""
    if n_locations <= 0 or n_days <= 0 or n_variables <= 0:
        return 0.0
    return n_locations * max(1.0, (n_days / 14.0) * (n_variables / 10.0))


def budget_usage(events: list[tuple[float, float]], now: float) -> dict[str, float]:
    day_start = datetime.fromtimestamp(now, tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "day": sum(w for ts, w in events if ts >= day_start.timestamp()),
        "hour": sum(w for ts, w in events if ts >= now - 3600),
        "minute": sum(w for ts, w in events if ts >= now - 60),
    }


def _load_budget_events() -> list[tuple[float, float]]:
    try:
        return [(float(ts), float(w)) for ts, w in json.loads(BUDGET_FILE.read_text(encoding="utf-8"))["events"]]
    except FileNotFoundError:
        return []
    except Exception as exc:
        logger.warning("Gagal membaca %s, penghitung kuota dimulai dari nol: %s", BUDGET_FILE, exc)
        return []


def acquire_budget(weight: float) -> None:
    """Tolak panggilan yang melewati batas harian/per jam; tunggu sebentar jika melewati batas per menit."""
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

    events.append((now, float(weight)))
    day_start = datetime.fromtimestamp(now, tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = min(day_start.timestamp(), now - 3600)
    BUDGET_FILE.parent.mkdir(parents=True, exist_ok=True)
    BUDGET_FILE.write_text(json.dumps({"events": [e for e in events if e[0] >= cutoff]}), encoding="utf-8")


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
    acquire_budget(call_weight(1, (end - start).days + 1, len(variables)))
    return _get_json(url, query, max_retries=5)


def fetch_openmeteo_hourly(kelurahan_id: int, lat: float, lon: float, start: date, end: date) -> pd.DataFrame:
    spec = params.OPENMETEO_HOURLY
    archive = _openmeteo_get(ARCHIVE_URL, spec, "default", lat, lon, start, end,
                             {"wind_speed_unit": config.OPENMETEO_WIND_UNIT, "timezone": "GMT"})
    archive_df = transform.openmeteo_to_frame(archive, spec, kelurahan_id, "default")

    visibility_df = None
    try:
        vis = _openmeteo_get(HISTORICAL_FORECAST_URL, spec, "historical_forecast", lat, lon, start, end,
                             {"timezone": "GMT"})
        visibility_df = transform.openmeteo_to_frame(vis, spec, kelurahan_id, "historical_forecast")
    except (RateLimitError, BudgetExceededError):
        raise
    except Exception as exc:
        logger.warning("Visibility tidak tersedia untuk kelurahan_id=%d (%s..%s), diisi NULL: %s",
                       kelurahan_id, start, end, exc)

    df = transform.merge_openmeteo_hourly(archive_df, visibility_df)
    return transform.drop_all_null(transform.drop_future(df, spec), spec)


def fetch_hourly(source: str, kelurahan_id: int, lat: float, lon: float, start: date, end: date) -> pd.DataFrame:
    if source == "nasa":
        return fetch_nasa_hourly(kelurahan_id, lat, lon, start, end)
    return fetch_openmeteo_hourly(kelurahan_id, lat, lon, start, end)


def fetch_daily_stasiun(spec: params.TableSpec, id_wmo: int, lat: float, lon: float,
                        start: date, end: date) -> tuple[pd.DataFrame, float | None]:
    """Data daily satu stasiun, beserta elevasi titik grid yang dipakai API. Elevasi tidak di-set (default API)
    agar caranya sama dengan data hourly 153 kelurahan."""
    if spec.source == "nasa":
        payload = _nasa_get(spec, lat, lon, start, end)
        df = transform.nasa_to_frame(payload, spec, id_wmo)
        coords = payload.get("geometry", {}).get("coordinates", [])
        elevation = coords[2] if len(coords) > 2 else None
    else:
        payload = _openmeteo_get(ARCHIVE_URL, spec, "default", lat, lon, start, end,
                                 {"wind_speed_unit": config.OPENMETEO_WIND_UNIT, "timezone": config.LOCAL_TZ})
        df = transform.openmeteo_to_frame(payload, spec, id_wmo, "default")
        elevation = payload.get("elevation")
    return transform.drop_all_null(transform.drop_future(df, spec), spec), elevation
