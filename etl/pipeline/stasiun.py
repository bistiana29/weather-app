"""Data daily NASA POWER dan Open-Meteo di titik stasiun BMKG, untuk dibandingkan dengan observasi harian BMKG.
Hanya disimpan di Postgres dan tidak dijadwalkan. Aman dijalankan berulang (upsert COALESCE):

    python -m pipeline.stasiun [--start-date 2022-01-01]
"""
import argparse
import logging
import sys
from datetime import date, datetime, timezone

import pandas as pd

from . import api, backfill, config, db, params

logger = logging.getLogger(__name__)

ELEVATION_COL = {"nasa": "elevasi_nasa_m", "openmeteo": "elevasi_openmeteo_m"}


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


def sync_stasiun(conn, df: pd.DataFrame) -> None:
    with conn.cursor() as cur:
        cur.executemany("""INSERT INTO stasiun_bmkg (id_wmo, nama, latitude, longitude, elevasi_m)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (id_wmo) DO UPDATE SET nama = EXCLUDED.nama, latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude, elevasi_m = EXCLUDED.elevasi_m""",
                        [(int(r.id_wmo), r.nama, float(r.latitude), float(r.longitude), float(r.elevasi_m))
                         for r in df.itertuples()])
    conn.commit()


def run(conn, spec: params.TableSpec, stasiun: pd.DataFrame, start: date, end: date) -> None:
    """Ambil semua stasiun dulu, baru tulis sekali, sama seperti job ingest."""
    t_start, t_end = db.day_bounds(start, end)
    log_id = db.log_start(conn, "stasiun", spec.source, spec.granularity, None, t_start, t_end, spec.name)
    try:
        frames, elevations = [], {}
        for r in stasiun.itertuples(index=False):
            for s, e in backfill.yearly_slices(start, end):
                df, elevation = api.fetch_daily_stasiun(spec, int(r.id_wmo), float(r.latitude), float(r.longitude), s, e)
                frames.append(df)
                elevations[int(r.id_wmo)] = elevation
        combined = pd.concat([f for f in frames if not f.empty], ignore_index=True)
        stats = db.upsert(conn, spec, combined)
        with conn.cursor() as cur:
            cur.executemany(f"UPDATE stasiun_bmkg SET {ELEVATION_COL[spec.source]} = %s WHERE id_wmo = %s",
                            [(v, k) for k, v in elevations.items()])
        conn.commit()
        db.log_finish(conn, log_id, "success", jumlah_baris=len(combined))
        logger.info("[stasiun] %s (%d stasiun, %s..%s): rows=%d, inserted=%d, updated=%d, unchanged=%d, elevasi=%s",
                    spec.name, len(stasiun), start, end, len(combined), stats["inserted"], stats["updated"],
                    stats["unchanged"], elevations)
    except Exception as exc:
        db.log_finish(conn, log_id, "failed", pesan_error=str(exc))
        logger.exception("[stasiun] Gagal pada %s: %s", spec.name, exc)
        raise


def main(argv: list[str] | None = None) -> int:
    config.setup_logging()
    p = argparse.ArgumentParser(description="Data daily NASA POWER dan Open-Meteo di titik stasiun BMKG")
    p.add_argument("--start-date", type=str, default=config.START_DATE.isoformat())
    args = p.parse_args(argv)

    start, end = date.fromisoformat(args.start_date), datetime.now(timezone.utc).date()
    stasiun = load_stasiun_csv()
    ok = True
    with db.connect() as conn:
        db.prepare(conn)
        sync_stasiun(conn, stasiun)
        for spec in params.STASIUN_TABLES.values():
            try:
                run(conn, spec, stasiun, start, end)
            except (api.RateLimitError, api.BudgetExceededError):
                return 1
            except Exception:
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
