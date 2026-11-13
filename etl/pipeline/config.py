"""Konfigurasi pipeline. Semua path dihitung dari lokasi file ini, jadi tidak bergantung pada folder tempat perintah dijalankan."""
import logging
import os
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
WORK_DIR = BASE_DIR / "_work"
KELURAHAN_CSV = BASE_DIR / "koordinat_kelurahan_surabaya.csv"
STASIUN_CSV = BASE_DIR / "koordinat_BMKG_surabaya.csv"
SCHEMA_SQL = BASE_DIR / "schema.sql"

load_dotenv(BASE_DIR / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STORAGE_BUCKET = "weather-archive"

LOCAL_TZ = "Asia/Jakarta"
WIB = ZoneInfo(LOCAL_TZ)

START_DATE = date(2022, 1, 1)
BACKFILL_END = datetime(2026, 11, 11, 23, 0, tzinfo=WIB)
STASIUN_START = date(2024, 6, 14)
STASIUN_END = date(2026, 6, 15)
HOT_DAYS = 130
MATURE_DAYS = 120

NASA_TIME_STANDARD = {"hourly": "UTC", "daily": "LST"}
NASA_COMMUNITY = "RE"
NASA_CONCURRENCY = 2
NASA_MIN_INTERVAL_S = 0.5

OPENMETEO_WIND_UNIT = "kn"
OPENMETEO_LIMIT_DAY = 9000
OPENMETEO_LIMIT_HOUR = 4500
OPENMETEO_LIMIT_MINUTE = 500
OPENMETEO_HOURLY_EVERY_N_HOURS = 3


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


_run_lock = None


def acquire_run_lock(job: str) -> None:
    """Hanya satu job pipeline yang menulis data boleh berjalan sekaligus di satu mesin, karena semuanya berbagi
    _work/ (file pending, salinan Parquet, penghitung kuota Open-Meteo) dan ringkasan_arsip. Kunci dilepas otomatis
    oleh sistem operasi saat proses berakhir, termasuk bila proses mati mendadak."""
    import fcntl
    global _run_lock
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    f = open(WORK_DIR / "pipeline.lock", "a+", encoding="utf-8")
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        f.seek(0)
        holder = f.read().strip() or "tidak diketahui"
        sys.exit(f"Job {job} dibatalkan: job pipeline lain masih berjalan di mesin ini ({holder}). "
                 f'Cek dengan: pgrep -af "python -m pipeline"')
    f.seek(0)
    f.truncate()
    f.write(f"{job}, pid {os.getpid()}, mulai {datetime.now(WIB):%Y-%m-%d %H:%M:%S} WIB\n")
    f.flush()
    _run_lock = f
