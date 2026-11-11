# ETL Data Cuaca Kelurahan Surabaya

Folder ini berisi pipeline ETL (extract, transform, load: ambil data, rapikan, lalu simpan) untuk data cuaca per jam (hourly) dan per hari (daily) dari dua sumber, NASA POWER dan Open-Meteo, pada 153 kelurahan di Surabaya sejak 1 Januari 2022.

## Gambaran singkat

Data disimpan di dua lapis:

- **Lapis panas**: data 130 hari terakhir disimpan di Postgres Supabase, yang cepat dibaca dan mudah diperbarui.
- **Lapis dingin**: data yang lebih tua disimpan sebagai file Parquet bulanan di Supabase Storage. Parquet adalah format file tabel terkompresi yang hemat tempat.

```
 NASA POWER ─┐                            ┌─ Postgres (130 hari terakhir)
             ├─> api.py ─> transform.py ─>┤        │ compact (mingguan)
 Open-Meteo ─┘   ambil      rapikan       │        v
                                          └─ Parquet bulanan di Supabase Storage
                                                   │
                         load_dataset() <──────────┘  gabungan keduanya untuk pemodelan
```

Ada empat tabel data. Setiap nama kolom memuat satuannya, misalnya `"T2M (°C)"`.

| Tabel | Kunci | Waktu |
|---|---|---|
| `nasa_hourly` | `kelurahan_id`, `waktu_utc` | UTC, jam awal periode |
| `nasa_daily` | `kelurahan_id`, `tanggal` | LST (waktu matahari lokal) |
| `openmeteo_hourly` | `kelurahan_id`, `waktu_utc` | UTC, jam awal periode |
| `openmeteo_daily` | `kelurahan_id`, `tanggal` | WIB (Asia/Jakarta) |

Selain itu ada tabel `kelurahan` (daftar lokasi), `ingestion_log` (catatan setiap run beserta statusnya), dan view `status_pengambilan_data` (ringkasan kesehatan pipeline).

## Penjadwalan

Pipeline dijalankan otomatis oleh GitHub Actions, yaitu layanan GitHub yang menjalankan perintah di server sesuai jadwal. Jadwal ditulis dalam format cron (menit, jam, tanggal, bulan, hari) dan selalu dalam UTC. WIB = UTC + 7 jam.

| Workflow | Cron (UTC) | Waktu WIB | Isi | Lookback |
|---|---|---|---|---|
| `hourly.yml` | `7 * * * *` | tiap jam, menit ke-7 | data hourly NASA, dan Open-Meteo tiap 3 jam | 7 hari |
| `daily.yml` | `19 */6 * * *` | 01:19, 07:19, 13:19, 19:19 | data daily NASA dan Open-Meteo | 7 hari |
| `deep_refresh.yml` | `33 20 * * *` | 03:33 setiap hari | hourly dan daily kedua sumber, sekitar 22 kelurahan per hari | 120 hari |
| `compact.yml` | `43 21 * * 0` | Senin 04:43 | memindahkan data lebih tua dari 130 hari ke Parquet | - |

- **Lookback** adalah rentang hari ke belakang yang diambil ulang setiap kali job berjalan.
- Menit jadwal sengaja tidak di :00 karena antrean GitHub paling padat pada awal jam, sehingga jadwal sering terlambat. Jadwal GitHub memang bisa terlambat beberapa menit, dan itu aman karena ada lookback.
- **Open-Meteo hourly diambil tiap 3 jam** (jam UTC 00, 03, 06, ... atau 07, 10, 13, ... WIB) untuk menghemat kuota, sedangkan NASA hourly diambil tiap jam. Jam yang terlewat, baik karena jadwal 3 jam maupun run yang gagal, tetap terisi karena setiap run mengambil ulang 7 hari terakhir.
- **deep_refresh** memilih kelurahan dengan `kelurahan_id % 7 == tanggal.toordinal() % 7`, sehingga seluruh 153 kelurahan tersegarkan sekali dalam 7 hari. `toordinal()` adalah nomor urut hari sejak tahun 1, sehingga rotasi tidak rusak saat pergantian tahun.
- **Concurrency**: setiap workflow punya grup sendiri dengan `cancel-in-progress: false`. Jika run sebelumnya belum selesai, run baru menunggu, bukan berjalan bersamaan. GitHub hanya menyimpan satu run yang menunggu; run menunggu yang lebih lama dibatalkan.
- Semua workflow bisa dijalankan manual dari tab Actions (tombol "Run workflow", disebut `workflow_dispatch`).
- **Saklar jadwal `SCHEDULE_ENABLED`**: jadwal hanya berjalan jika repository variable (pengaturan teks di GitHub, bukan rahasia) `SCHEDULE_ENABLED` bernilai `true`. Selama belum diisi, run terjadwal tampil sebagai *skipped*, tetapi jalan manual tetap bisa. Isi variabel ini setelah backfill selesai.
- GitHub menonaktifkan jadwal di repo publik yang tidak ada aktivitas selama 60 hari. Jika itu terjadi, aktifkan lagi dari tab Actions.

### Backfill manual di laptop

Backfill adalah pengisian data lama, dari 2022-01-01 sampai hari ini. Proses ini dijalankan di laptop, bukan di GitHub, karena butuh beberapa hari. Kuota gratis Open-Meteo 10.000 panggilan per hari, dan pipeline membatasi diri di 9.000 per hari, 4.500 per jam, dan 500 per menit. Saat kuota harian habis, backfill berhenti dengan rapi. Jalankan perintah yang sama keesokan harinya untuk melanjutkan; potongan yang sudah sukses tercatat di `ingestion_log` dan dilewati. Gunakan `--estimate-only` untuk melihat perkiraan jumlah panggilan dan jumlah hari.

**Jangan jalankan backfill di laptop saat jadwal aktif.** Penghitung kuota hanya lokal: laptop menyimpannya di `_work/openmeteo_budget.json`, sedangkan server GitHub selalu mulai dari nol. Keduanya tidak saling tahu, sehingga bersama-sama bisa melewati batas asli Open-Meteo. Urutannya: selesaikan backfill, baru isi `SCHEDULE_ENABLED=true`.

Jika API menolak karena batas kuota (HTTP 429), job berhenti tanpa menulis data setengah jadi, mencatat status `failed` di `ingestion_log`, dan keluar dengan exit code 1 sehingga run tampil merah di tab Actions.

### Memantau pipeline

Buka Supabase, lalu pilih **Table Editor**, skema `public`, dan klik `status_pengambilan_data` (view tampil di daftar yang sama dengan tabel). Cara lain, di **SQL Editor** jalankan `select * from status_pengambilan_data;`. Ada satu baris per sumber dan granularitas:

| Kolom | Arti |
|---|---|
| `run_sukses_terakhir_wib` | kapan job pengambilan terakhir kali selesai sukses |
| `data_terbaru_wib` | waktu data terbaru yang punya minimal satu nilai |
| `run_gagal_24_jam_terakhir` | jumlah run gagal dalam 24 jam terakhir |
| `persen_null_7_hari` | persentase sel kosong (NULL) pada baris 7 hari terakhir |

Untuk `openmeteo_hourly`, beberapa hari terakhir biasanya hanya berisi `visibility`, karena Archive API Open-Meteo tertinggal beberapa hari. Akibatnya `persen_null_7_hari` di baris itu wajar lebih tinggi. View ini dibuat dengan `security_invoker`, jadi tidak membuka data lewat API publik Supabase.

## Penanganan missing value

- **-999 dan NaN menjadi NULL.** NASA memakai -999 sebagai tanda "tidak ada data", dan Open-Meteo mengirim `null`. Keduanya disimpan sebagai NULL. Baris yang semua nilainya NULL tidak disimpan.
- **Upsert COALESCE.** Upsert berarti menambah baris baru atau memperbarui baris yang kuncinya sudah ada. COALESCE berarti memakai nilai baru jika tidak NULL, dan mempertahankan nilai lama jika nilai baru NULL. Jadi NULL tidak pernah menimpa data yang sudah ada. Contoh untuk kelurahan 1, 2026-11-08 00:00 UTC:

  | | `temperature_2m (°C)` | `visibility (m)` |
  |---|---|---|
  | Sebelum (di Postgres) | 28.0 | NULL |
  | Data baru dari API | NULL | 10000.0 |
  | Sesudah upsert | 28.0 | 10000.0 |

- **Lookback 7 hari dan penyegaran 120 hari.** Sumber sering mengirim nilai terlambat atau merevisinya. Lookback 7 hari mengisi NULL dari beberapa hari terakhir, dan deep_refresh mengambil ulang 120 hari untuk menangkap revisi yang lebih lambat.
- **Jam masa depan tidak disimpan.** Baris hourly setelah jam UTC yang sedang berjalan, dan baris daily untuk hari ini (WIB) dan sesudahnya, dibuang. Dengan begitu angka prakiraan tidak pernah tercampur dengan data pengamatan.
- **`fetched_at` dan `mature_only`.** `fetched_at` hanya berubah jika baris menerima nilai non-NULL baru yang berbeda, jadi kolom ini menunjukkan kapan data terakhir berubah. Data yang lebih tua dari 120 hari dianggap matang (tidak akan direvisi lagi). Untuk melatih model, pakai `mature_only=True`:

  ```python
  from pipeline import load_dataset
  df = load_dataset("nasa", "daily", "2022-01-01", "2026-11-01", mature_only=True)
  ```

- **`visibility` bisa NULL.** Kolom ini diambil dari Historical Forecast API, terpisah dari variabel lain. Jika panggilan itu gagal, baris tetap disimpan dengan `visibility` NULL, lalu diisi oleh run berikutnya lewat COALESCE.
- **Penggabungan saat pemadatan.** Saat `compact` memindahkan data ke Parquet, file bulan yang sudah ada digabung dengan aturan COALESCE yang sama. File hasil gabungan diunggah, lalu diunduh ulang untuk memastikan jumlah barisnya. Baru setelah itu baris dihapus dari Postgres. Jika ada langkah yang gagal, data di Postgres tidak dihapus.

## Isi folder

| File atau folder | Fungsi |
|---|---|
| `pipeline/config.py` | path, variabel dari `.env`, dan konstanta (batas kuota, 130/120 hari) |
| `pipeline/params.py` | daftar parameter dan nama kolom bersatuan untuk tiap tabel |
| `pipeline/api.py` | memanggil NASA POWER dan Open-Meteo: retry, jeda, penghitung kuota, berhenti saat HTTP 429 |
| `pipeline/transform.py` | mengubah JSON API menjadi tabel: -999/NaN ke NULL, waktu ke UTC, buang jam masa depan |
| `pipeline/db.py` | koneksi Postgres, menjalankan `schema.sql`, daftar kelurahan, upsert COALESCE, `ingestion_log` |
| `pipeline/storage.py` | membaca dan menulis Parquet bulanan di Supabase Storage dan `_work/parquet_staging/` |
| `pipeline/ingest.py` | job `hourly`, `daily`, dan `deep_refresh` |
| `pipeline/compact.py` | job pemadatan ke Parquet |
| `pipeline/backfill.py` | backfill lokal yang bisa dilanjutkan |
| `pipeline/read.py` | `load_dataset()` untuk pemodelan |
| `schema.sql` | tabel, indeks, RLS, dan view `status_pengambilan_data`; dijalankan otomatis di awal setiap job |
| `koordinat_kelurahan_surabaya.csv` | 153 kelurahan; nomor baris = `kelurahan_id`, jadi urutannya tidak boleh diubah |
| `requirements.txt` | library Python yang dibutuhkan |
| `_work/` | staging Parquet dan penghitung kuota lokal (tidak masuk Git) |
| `.env` | rahasia koneksi (tidak masuk Git) |
| `../.github/workflows/` | jadwal GitHub Actions |

## Cara menjalankan

Isi `.env` dengan `DATABASE_URL` (URI Session pooler Supabase), `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cd etl && uv venv --python 3.12 && uv pip install -r requirements.txt
source .venv/bin/activate              # fish: source .venv/bin/activate.fish
python -m pipeline.ingest hourly       # atau daily / deep_refresh; opsi --lookback-days, --kelurahan-ids
python -m pipeline.compact
python -m pipeline.backfill --estimate-only
python -m pipeline.backfill            # opsi --start-date, --kelurahan-ids
```
