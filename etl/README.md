# ETL Data Cuaca Surabaya

## Deskripsi

Pipeline ini mengambil data cuaca dan kualitas udara (PM2.5) per jam dari NASA POWER dan Open-Meteo untuk 153 kelurahan di Surabaya sejak 2022-01-01, merapikannya, lalu menyimpannya di Supabase: 130 hari terakhir di Postgres dan data yang lebih tua sebagai Parquet bulanan di Supabase Storage. Selain itu, pipeline mengambil data harian kedua sumber di titik 3 stasiun BMKG sebagai pembanding observasi BMKG. Semua waktu disimpan dan ditampilkan dalam WIB.

## Alur ETL

```mermaid
flowchart LR
    subgraph DARI["1. Dari mana"]
        NASA["NASA POWER"]
        OM["Open-Meteo<br/>termasuk Air Quality (PM2.5)"]
    end
    subgraph KAPAN["2. Kapan diambil (153 kelurahan, per jam)"]
        BF["Backfill<br/>sekali, manual<br/>1 Jan 2022 – 11 Nov 2026<br/>parameter baru: s.d. 27 Nov 2026"]
        H["Hourly<br/>tiap jam, Open-Meteo tiap 3 jam<br/>ambil ulang 7 hari terakhir"]
        DR["Deep refresh<br/>tiap hari 03:33 WIB<br/>ambil ulang 120 hari, 1/7 kelurahan bergilir"]
    end
    subgraph KOSONG["3. Kalau data belum ada"]
        N["Disimpan NULL<br/>nilai lama tidak ditimpa<br/>diisi nanti saat diambil ulang<br/>selama masih dalam 7 / 120 hari"]
    end
    subgraph DIMANA["4. Disimpan di mana"]
        HOT[("Postgres<br/>130 hari terakhir")]
        COLD[("Parquet bulanan<br/>Supabase Storage<br/>lebih tua dari 130 hari")]
    end

    NASA --> BF & H & DR
    OM --> BF & H & DR
    BF & H & DR --> N
    N --> HOT
    N -->|"backfill, data lama"| COLD
    HOT -->|"dipindah tiap minggu"| COLD
    HOT & COLD --> MOD["Pemodelan<br/>data lebih tua dari 120 hari (matang)"]
```

Data harian di 3 stasiun BMKG, untuk membandingkan kedua sumber dengan observasi BMKG, dan elevasi titik grid yang dipakai sumber (diambil sekali):

```mermaid
flowchart LR
    SRC["NASA POWER<br/>Open-Meteo"] -->|"diambil manual, per hari"| PG[("Postgres<br/>tabel daily stasiun")]
    PG --> VAL["Dibandingkan dengan<br/>observasi BMKG"]
    SRC -->|"sekali, dari metadata respons"| EL[("Postgres<br/>elevasi_titik<br/>153 kelurahan + 3 stasiun")]
```

Backfill mengisi riwayat sekali, sedangkan hourly dan deep refresh terus mengambil ulang beberapa hari terakhir, sehingga nilai yang terlambat atau direvisi sumber ikut masuk. Nilai yang belum ada di sumber (-999 atau NaN) disimpan sebagai NULL, dan nilai yang sudah tersimpan tidak pernah ditimpa oleh NULL. Data 130 hari terakhir ada di Postgres, sisanya di Parquet, dan pemodelan memakai gabungan keduanya yang sudah matang, yaitu lebih tua dari 120 hari karena tidak lagi direvisi sumber. Data harian stasiun memakai aturan nilai yang sama, tetapi hanya disimpan di Postgres.

## Alur file

Panah berarti "memanggil".

```mermaid
flowchart LR
    WH["hourly.yml<br/>deep_refresh.yml"] --> ING["ingest.py"]
    MAN["manual"] --> BF["backfill.py"]
    MAN --> ST["stasiun.py"]
    MAN --> EL["elevasi.py"]
    WC["compact.yml"] --> CP["compact.py"]
    ING & BF & ST & EL --> E["extract.py"]
    E --> T["transform.py"]
    ING & BF & ST & CP & EL --> L["load.py"]
    RD["read.py"] --> L
    PEND["config.py dan params.py<br/>dipakai hampir semua file"]
```

Pengendali memanggil `extract.py` untuk mengambil data lalu memanggil `load.py` sendiri untuk menyimpannya, jadi `transform.py` tidak memanggil `load.py`. `load.py` juga memakai `drop_all_null()` dan `coalesce_dupes()` dari `transform.py`, agar aturan NULL dan COALESCE sama saat menulis ke Postgres maupun Parquet. `load.py` bisa dijalankan langsung dengan `python -m pipeline.load` untuk mengisi ulang `ringkasan_arsip` dari semua Parquet di Storage, tanpa memanggil API cuaca. `read.py` diteruskan lewat `__init__.py`, sehingga cukup menulis `from pipeline import load_dataset, load_stasiun`.

| File | Peran | Dipanggil oleh |
|---|---|---|
| `ingest.py` | Pengendali: job `hourly` dan `deep_refresh` ke Postgres | `hourly.yml`, `deep_refresh.yml` |
| `backfill.py` | Pengendali: backfill hourly yang bisa dihentikan dan dilanjutkan | manual di laptop |
| `stasiun.py` | Pengendali: daily titik stasiun BMKG | manual |
| `compact.py` | Pengendali: memindahkan hourly lebih tua dari 130 hari ke Parquet | `compact.yml` |
| `elevasi.py` | Pengendali: mengisi `elevasi_titik` sekali (aman diulang) | manual |
| `extract.py` | Extract: memanggil API (NASA, Open-Meteo Archive, Historical Forecast, Air Quality), retry, jeda, penghitung kuota per endpoint | `ingest.py`, `backfill.py`, `stasiun.py`, `elevasi.py` |
| `transform.py` | Transform: JSON ke DataFrame, -999/NaN ke NULL, waktu ke WIB, hitung DPD, buang bahan hitung dan waktu masa depan | `extract.py`, `load.py` |
| `load.py` | Load: Postgres (upsert COALESCE, `ingestion_log`), Parquet di Storage, `ringkasan_arsip` | semua pengendali, `read.py`; manual `python -m pipeline.load` |
| `read.py` | Pendukung: `load_dataset()` dan `load_stasiun()` | `__init__.py` |
| `__init__.py` | Pendukung: meneruskan `load_dataset()` dan `load_stasiun()` | `from pipeline import ...` |
| `config.py` | Pendukung: path, `.env`, konstanta, logging, kunci satu job | hampir semua file |
| `params.py` | Pendukung: parameter dan nama kolom bersatuan per tabel | semua file kecuali `config.py` |

## Tabel database

| Peran | Tabel | Sumber | Granularitas | Titik | Isi singkat |
|---|---|---|---|---|---|
| Data | `nasa_hourly` | NASA POWER | hourly | 153 kelurahan | 8 parameter: `T2M`, `WS2M`, `WD2M`, `PRECTOTCORR`, `RH2M`, `PS`, `CLOUD_AMT`, `DPD` (= `T2M` − `T2MDEW`; `T2MDEW` tidak disimpan); 130 hari terakhir; kunci `(kelurahan_id, waktu)` |
| Data | `openmeteo_hourly` | Open-Meteo | hourly | 153 kelurahan | 11 parameter: 7 dari Archive termasuk `cloud_cover`, `visibility` dari Historical Forecast, `pm2_5` dari Air Quality, `DPD` (= `temperature_2m` − `dew_point_2m`; `dew_point_2m` tidak disimpan); 130 hari terakhir |
| Data | Parquet `weather-archive/{sumber}/hourly/{YYYY}/{YYYY-MM}.parquet` | NASA POWER, Open-Meteo | hourly | 153 kelurahan | data lebih tua dari 130 hari, kolom sama dengan tabel hourly, satu file per bulan WIB, zstd, nilai float32 |
| Juri | `nasa_daily_stasiun` | NASA POWER | daily | 3 stasiun BMKG | 8 parameter; `tanggal` dalam LST (waktu matahari lokal) |
| Juri | `openmeteo_daily_stasiun` | Open-Meteo | daily | 3 stasiun BMKG | 9 parameter; `tanggal` dalam WIB |
| Referensi | `kelurahan` | `koordinat_kelurahan_surabaya.csv` | – | 153 kelurahan | `kode_kel`, kecamatan, desa, koordinat, `metode_titik` (centroid atau polylabel) |
| Referensi | `stasiun_bmkg` | `koordinat_BMKG_surabaya.csv` | – | 3 stasiun BMKG | koordinat dan elevasi stasiun |
| Referensi | `elevasi_titik` | metadata respons API | – | 153 kelurahan, 3 stasiun BMKG | elevasi titik grid per titik, sumber, endpoint, dan parameter; DPD memakai elevasi endpoint suhunya; diisi sekali |
| Catatan | `ingestion_log` | pipeline | – | – | satu baris per run atau potongan backfill: job, rentang, tujuan, status (`running`, `success`, `failed`, `skipped`, `superseded`, `aborted`) |
| Catatan | `ringkasan_arsip` | pipeline, dihitung dari Parquet | hourly | – | per sumber, bulan, dan parameter: jumlah baris, jumlah terisi, waktu awal dan akhir terisi |
| Pemantauan | `status_pengambilan_data` (view) | `ingestion_log`, tabel hourly | hourly | – | per sumber: run sukses terakhir, data terbaru, run gagal 24 jam terakhir, persen NULL 7 hari |
| Pemantauan | `status_data_parameter` (view) | tabel hourly, `ringkasan_arsip`, tabel daily stasiun | hourly, daily_stasiun | – | per sumber dan parameter: data mulai dan terakhir, jumlah baris, jumlah terisi, persen kosong |

## Penjadwalan

Rincian dari diagram [Alur ETL](#alur-etl).

| Workflow | Cron (UTC) | WIB | Lookback | Isi |
|---|---|---|---|---|
| `hourly.yml` | `7 * * * *` | tiap jam, menit ke-7 | 7 hari | NASA tiap jam; Open-Meteo hanya pada jam UTC kelipatan 3; semua 153 kelurahan |
| `deep_refresh.yml` | `33 20 * * *` | 03:33 setiap hari | 120 hari | kedua sumber untuk sekitar 22 kelurahan yang mendapat giliran hari itu |
| `compact.yml` | `43 21 * * 0` | Senin 04:43 | – | memindahkan hourly lebih tua dari 130 hari dari Postgres ke Parquet |

- **`SCHEDULE_ENABLED`**: run terjadwal hanya berjalan jika repository variable `SCHEDULE_ENABLED` bernilai `true`. Jika tidak, run tampil *skipped*. Jalan manual dari tab Actions (`workflow_dispatch`) selalu bisa.
- **Concurrency dan lock**: setiap workflow punya grup concurrency sendiri dengan `cancel-in-progress: false`, jadi run baru menunggu run sebelumnya dari workflow yang sama, bukan berjalan bersamaan. Di satu mesin, setiap job memegang kunci `_work/pipeline.lock` (`fcntl.flock`), dan job kedua langsung berhenti. Kunci ini tidak menjangkau runner GitHub.
- **Lookback 7 hari**: rentangnya dari 00:00 WIB enam hari lalu sampai jam yang sedang berjalan.
- **Deep refresh bergilir**: kelurahan dipilih dengan `kelurahan_id % 7 == tanggal_WIB.toordinal() % 7`. `toordinal()` terus bertambah melewati pergantian tahun, jadi gilirannya tidak rusak di awal tahun. `CLOUD_AMT` NASA terbit sekitar 3 bulan terlambat, jadi kolom ini terisi oleh deep refresh, bukan oleh hourly.
- **Compact**: batasnya 00:00 WIB (hari ini − 130 hari). Per bulan, data digabung ke Parquet, diunggah dan diverifikasi lewat `etag`, dicatat di `ringkasan_arsip`, dan baru setelah itu dihapus dari Postgres. Jika satu langkah gagal, baris di Postgres tetap ada.
- **Open-Meteo hourly tiap 3 jam**: hanya pada jam UTC 00, 03, 06, …, yaitu 07, 10, 13, 16, 19, 22, 01, dan 04 WIB, untuk menghemat kuota. Setiap run memanggil Archive, Historical Forecast, dan Air Quality untuk 153 kelurahan (bobot 459), jadi jadwal memakai sekitar 3.700 per hari ditambah sekitar 210 untuk deep refresh. Penghitung kuota lokal membatasi 9.000 per hari UTC, 4.500 per jam, dan 500 per menit, dan mencatat bobot per endpoint.
- **HTTP 429 dan 5xx**: Open-Meteo dicoba ulang sampai 5 kali dengan jeda eksponensial atau sesuai header `Retry-After` (paling lama 300 detik). Jika tetap 429, atau NASA membalas 429, job berhenti tanpa menulis data dan run tampil gagal.
- **Upsert COALESCE**: `fetched_at` hanya berubah jika baris menerima nilai non-NULL baru yang berbeda.
- **Jadwal GitHub bersifat best effort**: run terjadwal bisa terlambat atau dilewati, terutama di awal jam; karena itu menitnya digeser ke :07, :33, dan :43. Celahnya ditutup oleh lookback. GitHub juga menonaktifkan jadwal repo publik yang tidak aktif selama 60 hari.
- **Backfill hanya manual**: `python -m pipeline.backfill` dijalankan di laptop, dan potongan yang sudah `success` dilewati. `--extra` hanya mengisi parameter baru (`CLOUD_AMT`, `cloud_cover`, `DPD`, `pm2_5`) dengan identitas `job = backfill_extra` dan `tujuan = hourly_extra:<endpoint>` di `ingestion_log`, tanpa menulis ulang kolom lama; `pm2_5` sebelum data Air Quality tersedia (2022-08-04 07:00 WIB) tersimpan NULL. Jangan menjalankannya saat jadwal sedang memakai kuota Open-Meteo, karena penghitung kuota laptop dan runner GitHub tidak saling tahu sehingga total pemakaian bisa melewati batas asli.

## Tree

```
etl/
├── README.md                          dokumentasi ini
├── requirements.txt                   library Python
├── schema.sql                         tabel, indeks, RLS, dan view; dijalankan load.prepare() di awal setiap job
├── koordinat_kelurahan_surabaya.csv   153 titik kelurahan; nomor baris = kelurahan_id, urutannya jangan diubah
├── koordinat_BMKG_surabaya.csv        3 titik stasiun BMKG
├── .env                               DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (tidak masuk Git)
├── pipeline/
│   ├── __init__.py                    mengekspor load_dataset() dan load_stasiun()
│   ├── config.py                      path, .env, konstanta, logging, kunci satu job per mesin
│   ├── params.py                      parameter dan nama kolom bersatuan per tabel
│   ├── extract.py                     ambil data NASA POWER dan Open-Meteo, retry, penghitung kuota
│   ├── transform.py                   JSON ke DataFrame: NULL, WIB, buang waktu masa depan
│   ├── load.py                        Postgres, Parquet di Storage, ringkasan_arsip
│   ├── ingest.py                      job hourly dan deep_refresh
│   ├── backfill.py                    backfill hourly manual yang bisa dilanjutkan; --extra untuk parameter baru
│   ├── stasiun.py                     daily titik stasiun BMKG, manual
│   ├── compact.py                     pindahkan hourly lebih tua dari 130 hari ke Parquet
│   ├── elevasi.py                     isi elevasi_titik sekali dari metadata respons API
│   └── read.py                        load_dataset() dan load_stasiun() untuk pemodelan
└── _work/                             data kerja lokal (tidak masuk Git)
    ├── parquet_staging/               salinan persis file Storage sesudah unggahan terverifikasi
    ├── parquet_pending/               data backfill yang belum diunggah
    ├── openmeteo_budget.json          penghitung kuota Open-Meteo lokal
    ├── backfill.log                   log semua run backfill
    ├── backfill_extra.log             log backfill parameter baru
    ├── elevasi_stasiun_lama.csv       cadangan kolom elevasi API lama di stasiun_bmkg
    └── pipeline.lock                  kunci satu job per mesin
```
