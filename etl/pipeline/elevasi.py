"""
Pengendali: mengisi sekali tabel elevasi_titik dengan elevasi titik grid dari metadata respons API, untuk 153 kelurahan dan 3 stasiun BMKG.

Alur file: manual → elevasi.py → extract.py, load.py
Alur fungsi: main() → endpoint_params() → existing_keys() → extract.fetch_elevation() → simpan_elevasi()
"""
import logging
import sys
from datetime import date

from . import config, extract, load, params, stasiun
from .params import TableSpec

logger = logging.getLogger(__name__)

# Satu hari contoh yang punya data di semua endpoint (Air Quality baru tersedia sejak Agustus 2022).
SAMPLE_DAY = date(2024, 1, 1)

INSERT_SQL = """INSERT INTO elevasi_titik (jenis_titik, kode_titik, sumber, endpoint, parameter, elevasi_m)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (jenis_titik, kode_titik, sumber, endpoint, parameter) DO NOTHING"""


# Nama endpoint di tabel: hourly/daily untuk NASA, archive/historical_forecast/air_quality untuk Open-Meteo
def endpoint_name(spec: TableSpec, endpoint: str) -> str:
    return spec.granularity if spec.source == "nasa" else extract.ENDPOINT_LABEL[endpoint]


# Mengelompokkan kolom yang disimpan per endpoint API; parameter turunan (DPD) ikut endpoint kolom suhunya
def endpoint_params(spec: TableSpec) -> dict[str, list[str]]:
    by_col = {p.column: p for p in spec.params}
    out: dict[str, list[str]] = {}
    for p in spec.params:
        if p.disimpan:
            endpoint = by_col[p.selisih[0]].endpoint if p.selisih else p.endpoint
            out.setdefault(endpoint, []).append(p.column)
    return out


# Membaca kunci (jenis, kode, sumber, endpoint, parameter) yang sudah ada agar run ulang tidak memanggil API lagi
def existing_keys(conn) -> set[tuple[str, str, str, str, str]]:
    with conn.cursor() as cur:
        cur.execute("SELECT jenis_titik, kode_titik, sumber, endpoint, parameter FROM elevasi_titik")
        keys = set(cur.fetchall())
    conn.commit()
    return keys


# Menyimpan baris elevasi satu titik dan satu endpoint dengan INSERT ... ON CONFLICT DO NOTHING
def simpan_elevasi(conn, rows: list[tuple]) -> None:
    with conn.cursor() as cur:
        cur.executemany(INSERT_SQL, rows)
    conn.commit()


# Mengambil elevasi per titik, sumber, dan endpoint untuk kelurahan (spec hourly) dan stasiun (spec daily)
def main() -> int:
    config.setup_logging()
    config.acquire_run_lock("elevasi")
    kel = load.load_kelurahan()
    sta = stasiun.load_stasiun_csv()
    titik = [("kelurahan", [(r.kode_kel, r.latitude, r.longitude) for r in kel.itertuples()],
              [params.NASA_HOURLY, params.OPENMETEO_HOURLY]),
             ("stasiun", [(str(r.id_wmo), r.latitude, r.longitude) for r in sta.itertuples()],
              [params.NASA_DAILY_STASIUN, params.OPENMETEO_DAILY_STASIUN])]
    with load.connect() as conn:
        load.prepare(conn)
        done = existing_keys(conn)
        for jenis, points, specs in titik:
            for spec in specs:
                log_id = load.log_start(conn, "elevasi", spec.source, spec.granularity, None, None, None, jenis)
                inserted = 0
                try:
                    for kode, lat, lon in points:
                        for endpoint, cols in endpoint_params(spec).items():
                            ep = endpoint_name(spec, endpoint)
                            if all((jenis, kode, spec.source, ep, c) in done for c in cols):
                                continue
                            elev = extract.fetch_elevation(spec, endpoint, float(lat), float(lon), SAMPLE_DAY)
                            simpan_elevasi(conn, [(jenis, kode, spec.source, ep, c, elev) for c in cols])
                            inserted += len(cols)
                    load.log_finish(conn, log_id, "success", jumlah_baris=inserted)
                    logger.info("[elevasi] %s %s/%s: %d baris baru", jenis, spec.source, spec.granularity, inserted)
                except Exception as exc:
                    load.log_finish(conn, log_id, "failed", pesan_error=str(exc))
                    raise
    return 0


if __name__ == "__main__":
    sys.exit(main())
