-- Skema database pipeline. Dijalankan oleh load.prepare() di awal setiap job, jadi semua perintah harus idempoten.
-- Semua waktu disimpan sebagai timestamptz; zona waktu database, role, dan koneksi pipeline diatur ke Asia/Jakarta,
-- sehingga hasil query dan view tampil dalam WIB (+07).
-- Nama kolom nilai harus sama dengan pipeline/params.py.
-- RLS diaktifkan tanpa policy: tabel tidak terbuka lewat API publik Supabase (anon/authenticated).

CREATE TABLE IF NOT EXISTS "kelurahan" (
    kelurahan_id integer PRIMARY KEY,
    kode_kel text UNIQUE,
    kecamatan text NOT NULL,
    desa text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    metode_titik text,
    UNIQUE (kecamatan, desa)
);
-- Untuk tabel yang dibuat sebelum kolom ini ada; diisi oleh sync_kelurahan dari CSV.
ALTER TABLE "kelurahan" ADD COLUMN IF NOT EXISTS kode_kel text UNIQUE;
ALTER TABLE "kelurahan" ADD COLUMN IF NOT EXISTS metode_titik text;

CREATE TABLE IF NOT EXISTS "nasa_hourly" (
    kelurahan_id integer NOT NULL REFERENCES kelurahan (kelurahan_id),
    "waktu" timestamptz NOT NULL,
    "T2M (°C)" real,
    "WS2M (m/s)" real,
    "WD2M (°)" real,
    "PRECTOTCORR (mm/jam)" real,
    "RH2M (%)" real,
    "PS (kPa)" real,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kelurahan_id, "waktu")
);

CREATE INDEX IF NOT EXISTS "nasa_hourly_waktu_idx" ON "nasa_hourly" ("waktu");

COMMENT ON COLUMN "nasa_hourly"."T2M (°C)" IS 'Temperature at 2 Meters';

COMMENT ON COLUMN "nasa_hourly"."WS2M (m/s)" IS 'Wind Speed at 2 Meters';

COMMENT ON COLUMN "nasa_hourly"."WD2M (°)" IS 'Wind Direction at 2 Meters';

COMMENT ON COLUMN "nasa_hourly"."PRECTOTCORR (mm/jam)" IS 'Precipitation Corrected';

COMMENT ON COLUMN "nasa_hourly"."RH2M (%)" IS 'Relative Humidity at 2 Meters';

COMMENT ON COLUMN "nasa_hourly"."PS (kPa)" IS 'Surface Pressure';

COMMENT ON COLUMN "nasa_hourly"."waktu" IS 'Jam awal periode (timestamptz, ditampilkan dalam WIB)';

COMMENT ON COLUMN "nasa_hourly"."fetched_at" IS 'Terakhir kali baris menerima setidaknya satu nilai non-NULL baru dari sumber';

CREATE TABLE IF NOT EXISTS "openmeteo_hourly" (
    kelurahan_id integer NOT NULL REFERENCES kelurahan (kelurahan_id),
    "waktu" timestamptz NOT NULL,
    "temperature_2m (°C)" real,
    "wind_speed_10m (kn)" real,
    "wind_direction_10m (°)" real,
    "relative_humidity_2m (%)" real,
    "precipitation (mm)" real,
    "sunshine_duration (s)" real,
    "surface_pressure (hPa)" real,
    "visibility (m)" real,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kelurahan_id, "waktu")
);

CREATE INDEX IF NOT EXISTS "openmeteo_hourly_waktu_idx" ON "openmeteo_hourly" ("waktu");

COMMENT ON COLUMN "openmeteo_hourly"."temperature_2m (°C)" IS 'Air temperature at 2 meters above ground';

COMMENT ON COLUMN "openmeteo_hourly"."wind_speed_10m (kn)" IS 'Wind speed at 10 meters above ground';

COMMENT ON COLUMN "openmeteo_hourly"."wind_direction_10m (°)" IS 'Wind direction at 10 meters above ground';

COMMENT ON COLUMN "openmeteo_hourly"."relative_humidity_2m (%)" IS 'Relative humidity at 2 meters above ground';

COMMENT ON COLUMN "openmeteo_hourly"."precipitation (mm)" IS 'Total precipitation (rain, showers, snow) sum of the preceding hour';

COMMENT ON COLUMN "openmeteo_hourly"."sunshine_duration (s)" IS 'Number of seconds of sunshine of the preceding hour';

COMMENT ON COLUMN "openmeteo_hourly"."surface_pressure (hPa)" IS 'Atmospheric air pressure at surface';

COMMENT ON COLUMN "openmeteo_hourly"."visibility (m)" IS 'Viewing distance (Historical Forecast API)';

COMMENT ON COLUMN "openmeteo_hourly"."waktu" IS 'Jam awal periode (timestamptz, ditampilkan dalam WIB)';

COMMENT ON COLUMN "openmeteo_hourly"."fetched_at" IS 'Terakhir kali baris menerima setidaknya satu nilai non-NULL baru dari sumber';

CREATE TABLE IF NOT EXISTS "ingestion_log" (
    id bigserial PRIMARY KEY,
    job text NOT NULL,
    sumber text NOT NULL,
    granularitas text NOT NULL,
    kelurahan_id integer REFERENCES kelurahan (kelurahan_id),
    rentang_mulai timestamptz,
    rentang_akhir timestamptz,
    tujuan text,
    status text NOT NULL,
    jumlah_baris integer,
    pesan_error text,
    mulai_at timestamptz NOT NULL DEFAULT now(),
    selesai_at timestamptz
);
-- superseded: potongan yang datanya dibuang (misalnya koordinat kelurahan berubah), backfill mengambilnya ulang.
-- aborted: run yang terhenti tanpa sempat mencatat hasil.
ALTER TABLE "ingestion_log" DROP CONSTRAINT IF EXISTS ingestion_log_status_check;
ALTER TABLE "ingestion_log" ADD CONSTRAINT ingestion_log_status_check
    CHECK (status IN ('running', 'success', 'failed', 'skipped', 'superseded', 'aborted'));

CREATE INDEX IF NOT EXISTS "ingestion_log_checkpoint_idx" ON "ingestion_log" (sumber, granularitas, kelurahan_id, rentang_mulai, rentang_akhir) WHERE status = 'success';

ALTER TABLE "kelurahan" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "nasa_hourly" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "openmeteo_hourly" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ingestion_log" ENABLE ROW LEVEL SECURITY;

-- Titik stasiun BMKG untuk validasi daily. Elevasi API diisi oleh pipeline/stasiun.py dari respons API
-- (elevasi titik grid yang dipakai sumber), karena bisa berbeda jauh dari elevasi stasiun.
CREATE TABLE IF NOT EXISTS stasiun_bmkg (
    id_wmo integer PRIMARY KEY,
    nama text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    elevasi_m real,
    elevasi_openmeteo_m real,
    elevasi_nasa_m real
);

CREATE TABLE IF NOT EXISTS "nasa_daily_stasiun" (
    id_wmo integer NOT NULL REFERENCES stasiun_bmkg (id_wmo),
    "tanggal" date NOT NULL,
    "T2M (°C)" real,
    "T2M_MAX (°C)" real,
    "T2M_MIN (°C)" real,
    "WS2M (m/s)" real,
    "WS2M_MAX (m/s)" real,
    "WD2M (°)" real,
    "PRECTOTCORR (mm/hari)" real,
    "RH2M (%)" real,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id_wmo, "tanggal")
);

COMMENT ON COLUMN "nasa_daily_stasiun"."T2M (°C)" IS 'Temperature at 2 Meters';

COMMENT ON COLUMN "nasa_daily_stasiun"."T2M_MAX (°C)" IS 'Temperature at 2 Meters Maximum';

COMMENT ON COLUMN "nasa_daily_stasiun"."T2M_MIN (°C)" IS 'Temperature at 2 Meters Minimum';

COMMENT ON COLUMN "nasa_daily_stasiun"."WS2M (m/s)" IS 'Wind Speed at 2 Meters';

COMMENT ON COLUMN "nasa_daily_stasiun"."WS2M_MAX (m/s)" IS 'Wind Speed at 2 Meters Maximum';

COMMENT ON COLUMN "nasa_daily_stasiun"."WD2M (°)" IS 'Wind Direction at 2 Meters';

COMMENT ON COLUMN "nasa_daily_stasiun"."PRECTOTCORR (mm/hari)" IS 'Precipitation Corrected';

COMMENT ON COLUMN "nasa_daily_stasiun"."RH2M (%)" IS 'Relative Humidity at 2 Meters';

COMMENT ON COLUMN "nasa_daily_stasiun"."tanggal" IS 'Tanggal LST (NASA POWER time-standard=LST)';

COMMENT ON COLUMN "nasa_daily_stasiun"."fetched_at" IS 'Terakhir kali baris menerima setidaknya satu nilai non-NULL baru dari sumber';

CREATE TABLE IF NOT EXISTS "openmeteo_daily_stasiun" (
    id_wmo integer NOT NULL REFERENCES stasiun_bmkg (id_wmo),
    "tanggal" date NOT NULL,
    "temperature_2m_mean (°C)" real,
    "temperature_2m_max (°C)" real,
    "temperature_2m_min (°C)" real,
    "wind_speed_10m_mean (kn)" real,
    "wind_speed_10m_max (kn)" real,
    "wind_direction_10m_dominant (°)" real,
    "precipitation_sum (mm)" real,
    "relative_humidity_2m_mean (%)" real,
    "sunshine_duration (s)" real,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id_wmo, "tanggal")
);

COMMENT ON COLUMN "openmeteo_daily_stasiun"."temperature_2m_mean (°C)" IS 'Mean daily air temperature at 2 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."temperature_2m_max (°C)" IS 'Maximum daily air temperature at 2 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."temperature_2m_min (°C)" IS 'Minimum daily air temperature at 2 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."wind_speed_10m_mean (kn)" IS 'Mean daily wind speed at 10 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."wind_speed_10m_max (kn)" IS 'Maximum daily wind speed at 10 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."wind_direction_10m_dominant (°)" IS 'Dominant daily wind direction at 10 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."precipitation_sum (mm)" IS 'Sum of daily precipitation';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."relative_humidity_2m_mean (%)" IS 'Mean daily relative humidity at 2 meters above ground';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."sunshine_duration (s)" IS 'Number of seconds of sunshine per day';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."tanggal" IS 'Tanggal lokal Asia/Jakarta';

COMMENT ON COLUMN "openmeteo_daily_stasiun"."fetched_at" IS 'Terakhir kali baris menerima setidaknya satu nilai non-NULL baru dari sumber';

ALTER TABLE "stasiun_bmkg" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "nasa_daily_stasiun" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "openmeteo_daily_stasiun" ENABLE ROW LEVEL SECURITY;

-- Ringkasan kesehatan job terjadwal (hourly 153 kelurahan) untuk dibuka di Supabase Table Editor, satu baris per sumber.
-- Hanya job yang mengambil dari API yang dihitung; compact dan backfill_flush tidak mengambil data baru.
-- security_invoker = true agar RLS tabel asal tetap berlaku, sehingga view ini tidak membuka data lewat API publik.
CREATE OR REPLACE VIEW status_pengambilan_data WITH (security_invoker = true) AS
WITH kombinasi (sumber, granularitas) AS (
    VALUES ('nasa', 'hourly'), ('openmeteo', 'hourly')
),
sel AS (
    SELECT 'nasa' AS sumber, 'hourly' AS granularitas, waktu, 6 AS kolom,
           num_nulls("T2M (°C)", "WS2M (m/s)", "WD2M (°)", "PRECTOTCORR (mm/jam)", "RH2M (%)", "PS (kPa)") AS kosong
    FROM nasa_hourly
    UNION ALL
    SELECT 'openmeteo', 'hourly', waktu, 8,
           num_nulls("temperature_2m (°C)", "wind_speed_10m (kn)", "wind_direction_10m (°)", "relative_humidity_2m (%)",
                     "precipitation (mm)", "sunshine_duration (s)", "surface_pressure (hPa)", "visibility (m)")
    FROM openmeteo_hourly
),
data AS (
    SELECT sumber, granularitas,
           max(waktu) FILTER (WHERE kosong < kolom) AS data_terbaru,
           round(100.0 * sum(kosong) FILTER (WHERE waktu >= now() - interval '7 days')
                 / nullif(sum(kolom) FILTER (WHERE waktu >= now() - interval '7 days'), 0), 1) AS persen_null_7_hari
    FROM sel
    GROUP BY sumber, granularitas
),
log AS (
    SELECT sumber, granularitas,
           max(selesai_at) FILTER (WHERE status = 'success') AS run_sukses_terakhir,
           count(*) FILTER (WHERE status = 'failed' AND mulai_at >= now() - interval '24 hours') AS run_gagal_24_jam
    FROM ingestion_log
    WHERE job IN ('hourly', 'deep_refresh', 'backfill')
    GROUP BY sumber, granularitas
)
SELECT k.sumber,
       k.granularitas,
       date_trunc('second', l.run_sukses_terakhir) AS run_sukses_terakhir_wib,
       date_trunc('second', d.data_terbaru) AS data_terbaru_wib,
       coalesce(l.run_gagal_24_jam, 0) AS run_gagal_24_jam_terakhir,
       d.persen_null_7_hari
FROM kombinasi k
LEFT JOIN data d USING (sumber, granularitas)
LEFT JOIN log l USING (sumber, granularitas)
ORDER BY k.sumber, k.granularitas;

-- Ringkasan per parameter untuk setiap file Parquet bulanan (lapis dingin), diisi oleh simpan_ringkasan() di pipeline/load.py.
-- Disimpan di Postgres agar status data tidak perlu mengunduh semua file Parquet setiap kali dibuka.
CREATE TABLE IF NOT EXISTS ringkasan_arsip (
    sumber text NOT NULL,
    granularitas text NOT NULL,
    bulan text NOT NULL,
    parameter text NOT NULL,
    jumlah_baris integer NOT NULL,
    jumlah_terisi integer NOT NULL,
    waktu_awal_terisi timestamptz,
    waktu_akhir_terisi timestamptz,
    diperbarui_pada timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (sumber, granularitas, bulan, parameter)
);

ALTER TABLE "ringkasan_arsip" ENABLE ROW LEVEL SECURITY;

-- Status data per parameter. Hourly 153 kelurahan: lapis dingin dari ringkasan_arsip ditambah lapis panas yang
-- dihitung langsung. Daily titik stasiun (granularitas 'daily_stasiun'): dihitung langsung dari tabelnya.
-- Baris Postgres yang waktunya tidak lebih baru dari data terakhir di arsip dilewati, karena baris itu
-- sudah tercakup di Parquet (misalnya selama compact belum menghapusnya), sehingga tidak terhitung dua kali.
CREATE OR REPLACE VIEW status_data_parameter WITH (security_invoker = true) AS
WITH batas AS (
    SELECT sumber, granularitas, max(waktu_akhir_terisi) AS akhir_arsip
    FROM ringkasan_arsip
    GROUP BY sumber, granularitas
),
panas AS (
    SELECT 'nasa' AS sumber, 'hourly' AS granularitas, p.parameter, t.waktu, p.nilai
    FROM nasa_hourly t
    CROSS JOIN LATERAL (VALUES
        ('T2M (°C)', t."T2M (°C)"), ('WS2M (m/s)', t."WS2M (m/s)"), ('WD2M (°)', t."WD2M (°)"),
        ('PRECTOTCORR (mm/jam)', t."PRECTOTCORR (mm/jam)"), ('RH2M (%)', t."RH2M (%)"), ('PS (kPa)', t."PS (kPa)")
    ) AS p (parameter, nilai)
    UNION ALL
    SELECT 'nasa', 'daily_stasiun', p.parameter, t.tanggal::timestamp AT TIME ZONE 'Asia/Jakarta', p.nilai
    FROM nasa_daily_stasiun t
    CROSS JOIN LATERAL (VALUES
        ('T2M (°C)', t."T2M (°C)"), ('T2M_MAX (°C)', t."T2M_MAX (°C)"), ('T2M_MIN (°C)', t."T2M_MIN (°C)"),
        ('WS2M (m/s)', t."WS2M (m/s)"), ('WS2M_MAX (m/s)', t."WS2M_MAX (m/s)"), ('WD2M (°)', t."WD2M (°)"),
        ('PRECTOTCORR (mm/hari)', t."PRECTOTCORR (mm/hari)"), ('RH2M (%)', t."RH2M (%)")
    ) AS p (parameter, nilai)
    UNION ALL
    SELECT 'openmeteo', 'hourly', p.parameter, t.waktu, p.nilai
    FROM openmeteo_hourly t
    CROSS JOIN LATERAL (VALUES
        ('temperature_2m (°C)', t."temperature_2m (°C)"), ('wind_speed_10m (kn)', t."wind_speed_10m (kn)"),
        ('wind_direction_10m (°)', t."wind_direction_10m (°)"), ('relative_humidity_2m (%)', t."relative_humidity_2m (%)"),
        ('precipitation (mm)', t."precipitation (mm)"), ('sunshine_duration (s)', t."sunshine_duration (s)"),
        ('surface_pressure (hPa)', t."surface_pressure (hPa)"), ('visibility (m)', t."visibility (m)")
    ) AS p (parameter, nilai)
    UNION ALL
    SELECT 'openmeteo', 'daily_stasiun', p.parameter, t.tanggal::timestamp AT TIME ZONE 'Asia/Jakarta', p.nilai
    FROM openmeteo_daily_stasiun t
    CROSS JOIN LATERAL (VALUES
        ('temperature_2m_mean (°C)', t."temperature_2m_mean (°C)"), ('temperature_2m_max (°C)', t."temperature_2m_max (°C)"),
        ('temperature_2m_min (°C)', t."temperature_2m_min (°C)"), ('wind_speed_10m_mean (kn)', t."wind_speed_10m_mean (kn)"),
        ('wind_speed_10m_max (kn)', t."wind_speed_10m_max (kn)"), ('wind_direction_10m_dominant (°)', t."wind_direction_10m_dominant (°)"),
        ('precipitation_sum (mm)', t."precipitation_sum (mm)"), ('relative_humidity_2m_mean (%)', t."relative_humidity_2m_mean (%)"),
        ('sunshine_duration (s)', t."sunshine_duration (s)")
    ) AS p (parameter, nilai)
),
gabung AS (
    SELECT p.sumber, p.granularitas, p.parameter, count(*) AS jumlah_baris, count(p.nilai) AS jumlah_terisi,
           min(p.waktu) FILTER (WHERE p.nilai IS NOT NULL) AS awal,
           max(p.waktu) FILTER (WHERE p.nilai IS NOT NULL) AS akhir
    FROM panas p
    LEFT JOIN batas b USING (sumber, granularitas)
    WHERE p.waktu > coalesce(b.akhir_arsip, '-infinity')
    GROUP BY p.sumber, p.granularitas, p.parameter
    UNION ALL
    SELECT sumber, granularitas, parameter, sum(jumlah_baris), sum(jumlah_terisi),
           min(waktu_awal_terisi), max(waktu_akhir_terisi)
    FROM ringkasan_arsip
    GROUP BY sumber, granularitas, parameter
)
SELECT sumber,
       granularitas,
       parameter,
       date_trunc('second', min(awal)) AS data_mulai,
       date_trunc('second', max(akhir)) AS data_terakhir,
       sum(jumlah_baris)::bigint AS jumlah_baris,
       sum(jumlah_terisi)::bigint AS jumlah_terisi,
       round(100.0 * (sum(jumlah_baris) - sum(jumlah_terisi)) / nullif(sum(jumlah_baris), 0), 2) AS persen_kosong
FROM gabung
GROUP BY sumber, granularitas, parameter
ORDER BY sumber, granularitas, parameter;
