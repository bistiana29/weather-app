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
