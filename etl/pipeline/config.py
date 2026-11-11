"""Konfigurasi pipeline. Semua path dihitung dari lokasi file ini, jadi tidak bergantung pada folder tempat perintah dijalankan."""
import logging
import os
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
WORK_DIR = BASE_DIR / "_work"
KELURAHAN_CSV = BASE_DIR / "koordinat_kelurahan_surabaya.csv"
SCHEMA_SQL = BASE_DIR / "schema.sql"

load_dotenv(BASE_DIR / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STORAGE_BUCKET = "weather-archive"

START_DATE = date(2022, 1, 1)
HOT_DAYS = 130
MATURE_DAYS = 120
LOCAL_TZ = "Asia/Jakarta"

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
