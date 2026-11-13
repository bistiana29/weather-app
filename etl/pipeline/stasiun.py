"""
Pengendali: mengambil data daily NASA POWER dan Open-Meteo di titik 3 stasiun BMKG ke Postgres, untuk validasi sumber.

Alur file: manual → stasiun.py → extract.py, load.py
Alur fungsi: main() → load_stasiun_csv() → sync_stasiun() → run() → extract.fetch_daily_stasiun() → load.upsert()
"""
import argparse
import logging
import sys
from datetime import date

import pandas as pd

from . import config, extract, load, params

logger = logging.getLogger(__name__)

ELEVATION_COL = {"nasa": "elevasi_nasa_m", "openmeteo": "elevasi_openmeteo_m"}


# Membaca dan memvalidasi CSV stasiun BMKG, lalu mengganti nama kolomnya
def load_stasiun_csv() -> pd.DataFrame:
    raw = pd.read_csv(config.STASIUN_CSV)
    expected = ["ID_WMO", "Stasiun", "Latitude", "Longitude", "elevasi"]
    if list(raw.columns) != expected:
        raise ValueError(f"Kolom CSV harus {expected}, dapat {list(raw.columns)}")
    df = raw.rename(columns={"ID_WMO": "id_wmo", "Stasiun": "nama", "Latitude": "latitude",
                             "Longitude": "longitude", "elevasi": "elevasi_m"})
    if df["id_wmo"].duplicated().any() or df[["latitude", "longitude"]].isna().any().any():
        raise ValueError("id_wmo harus unik dan koordinat tidak boleh kosong")
    return df


# Menyamakan tabel stasiun_bmkg dengan isi CSV
def sync_stasiun(conn, df: pd.DataFrame) -> None:
    with conn.cursor() as cur:
        cur.executemany("""INSERT INTO stasiun_bmkg (id_wmo, nama, latitude, longitude, elevasi_m)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (id_wmo) DO UPDATE SET nama = EXCLUDED.nama, latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude, elevasi_m = EXCLUDED.elevasi_m""",
                        [(int(r.id_wmo), r.nama, float(r.latitude), float(r.longitude), float(r.elevasi_m))
                         for r in df.itertuples()])
    conn.commit()


# Mengambil semua stasiun satu sumber, menulis sekali lewat load.upsert(), lalu menyimpan elevasi grid API
def run(conn, spec: params.TableSpec, stasiun: pd.DataFrame, start: date, end: date) -> None:
    t_start, t_end = load.day_bounds(start, end)
    log_id = load.log_start(conn, "stasiun", spec.source, spec.granularity, None, t_start, t_end, spec.name)
    try:
        frames, elevations = [], {}
        for r in stasiun.itertuples(index=False):
            df, elevation = extract.fetch_daily_stasiun(spec, int(r.id_wmo), float(r.latitude), float(r.longitude), start, end)
            frames.append(df)
            elevations[int(r.id_wmo)] = elevation
        combined = pd.concat([f for f in frames if not f.empty], ignore_index=True)
        stats = load.upsert(conn, spec, combined)
        with conn.cursor() as cur:
            cur.executemany(f"UPDATE stasiun_bmkg SET {ELEVATION_COL[spec.source]} = %s WHERE id_wmo = %s",
                            [(v, k) for k, v in elevations.items()])
        conn.commit()
        load.log_finish(conn, log_id, "success", jumlah_baris=len(combined))
        logger.info("[stasiun] %s (%d stasiun, %s..%s): rows=%d, inserted=%d, updated=%d, unchanged=%d, elevasi=%s",
                    spec.name, len(stasiun), start, end, len(combined), stats["inserted"], stats["updated"],
                    stats["unchanged"], elevations)
    except Exception as exc:
        load.log_finish(conn, log_id, "failed", pesan_error=str(exc))
        logger.exception("[stasiun] Gagal pada %s: %s", spec.name, exc)
        raise


# Membaca argumen rentang tanggal lalu memanggil run() untuk NASA dan Open-Meteo
def main(argv: list[str] | None = None) -> int:
    config.setup_logging()
    p = argparse.ArgumentParser(description="Data daily NASA POWER dan Open-Meteo di titik stasiun BMKG")
    p.add_argument("--start-date", type=str, default=config.STASIUN_START.isoformat())
    p.add_argument("--end-date", type=str, default=config.STASIUN_END.isoformat())
    args = p.parse_args(argv)
    config.acquire_run_lock("stasiun")

    start, end = date.fromisoformat(args.start_date), date.fromisoformat(args.end_date)
    stasiun = load_stasiun_csv()
    ok = True
    with load.connect() as conn:
        load.prepare(conn)
        sync_stasiun(conn, stasiun)
        for spec in params.STASIUN_TABLES.values():
            try:
                run(conn, spec, stasiun, start, end)
            except (extract.RateLimitError, extract.BudgetExceededError):
                return 1
            except Exception:
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
