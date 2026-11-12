# ETL Data Cuaca Surabaya

Folder ini berisi pipeline ETL (extract, transform, load: ambil data, rapikan, lalu simpan) untuk data cuaca dari dua sumber, NASA POWER dan Open-Meteo, sejak 1 Januari 2022:

- **Hourly 153 kelurahan**: data per jam untuk setiap kelurahan di Surabaya, diambil otomatis sesuai jadwal. Data ini yang dipakai model.
- **Daily titik stasiun BMKG**: data per hari di 3 titik stasiun BMKG, diambil manual, untuk dibandingkan dengan observasi harian BMKG.

## Gambaran singkat

Data hourly disimpan di dua lapis:

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

Data daily stasiun kecil (beberapa ribu baris), jadi hanya disimpan di Postgres.

Setiap nama kolom nilai memuat satuannya, misalnya `"T2M (°C)"`.

| Tabel | Kunci | Waktu | Isi |
|---|---|---|---|
| `nasa_hourly` | `kelurahan_id`, `waktu` | jam awal periode, WIB | hourly 153 kelurahan |
| `openmeteo_hourly` | `kelurahan_id`, `waktu` | jam awal periode, WIB | hourly 153 kelurahan |
| `nasa_daily_stasiun` | `id_wmo`, `tanggal` | LST (waktu matahari lokal) | daily 3 stasiun BMKG |
| `openmeteo_daily_stasiun` | `id_wmo`, `tanggal` | WIB (Asia/Jakarta) | daily 3 stasiun BMKG |

**Zona waktu: semua waktu ditampilkan dalam WIB (Asia/Jakarta, +07).**
- **Postgres:** kolom waktu bertipe `timestamptz`, yang menyimpan titik waktu yang pasti. Zona default database `postgres`, role `postgres`, dan setiap koneksi pipeline diatur ke Asia/Jakarta, sehingga hasil query dan view tampil dengan `+07`. Koneksi lewat Session pooler Supabase bisa memakai ulang koneksi server lama yang masih UTC sampai koneksi itu diganti; jika di SQL Editor masih tampil `+00`, jalankan `SET TIME ZONE 'Asia/Jakarta';`.
- **Parquet:** kolom `waktu` disimpan sebagai timestamp berzona Asia/Jakarta, dan file dikelompokkan per bulan WIB.
- **API:** NASA hourly tetap diminta dengan `time-standard=UTC` dan Open-Meteo hourly dengan `timezone=GMT`; keduanya dikonversi ke WIB di `transform.py`. LST tidak dipakai untuk hourly karena LST sekitar UTC+7,5 jam, bukan WIB.
- **Aturan waktu:** batas 130 hari, "jam masa depan tidak disimpan", lookback, dan rotasi deep_refresh dihitung dalam WIB.
- **Pengecualian:** jadwal cron GitHub Actions tetap ditulis dalam UTC, karena begitu aturan GitHub. Penghitung kuota harian Open-Meteo juga mengikuti hari UTC, karena kuotanya direset pukul 00:00 UTC.

Tabel pendukung:
- `kelurahan` dan `stasiun_bmkg`: daftar lokasi.
- `ingestion_log`: catatan setiap run beserta statusnya.
- `ringkasan_arsip`: statistik per parameter untuk setiap file Parquet.

Ada juga dua view pemantauan, `status_pengambilan_data` dan `status_data_parameter`.

## Titik kelurahan

`koordinat_kelurahan_surabaya.csv` berisi satu titik per kelurahan dengan header `kode_kel,kecamatan,desa,latitude,longitude,metode_titik`. CSV ini sumber kebenaran: setiap job menyamakan tabel `kelurahan` dengan isinya. `kelurahan_id` adalah nomor baris CSV (mulai 1), jadi urutan barisnya tidak boleh diubah.

Aturan titik representatif: dipakai **centroid**, lalu diganti **polylabel** (titik terdalam di dalam poligon) bila centroid tidak representatif terhadap wilayahnya. Saat ini 148 kelurahan memakai centroid dan 5 memakai polylabel:

| `kelurahan_id` | `kode_kel` | Kecamatan | Kelurahan |
|---|---|---|---|
| 12 | 35.78.13.1005 | Bubutan | Tembok Dukuh |
| 41 | 35.78.23.1002 | Jambangan | Karah |
| 63 | 35.78.26.1005 | Mulyorejo | Dukuh Sutorejo |
| 67 | 35.78.26.1002 | Mulyorejo | Manyar Sabrangan |
| 150 | 35.78.04.1003 | Wonokromo | Ngagel |

Jika titik sebuah kelurahan diganti, data hourly lamanya berasal dari koordinat lain dan harus dibuang seluruhnya, bukan ditimpa dengan COALESCE. Hapus barisnya dari `nasa_hourly`, `openmeteo_hourly`, semua file Parquet bulanan beserta salinannya di `_work/parquet_staging/`, perbarui `ringkasan_arsip`, lalu ubah potongan backfill kelurahan itu di `ingestion_log` menjadi `superseded`. Backfill hanya menganggap status `success` sebagai selesai, jadi potongan tersebut akan diambil ulang. Penggantian 5 titik di atas dilakukan pada 2026-11-13.

## Penjadwalan

Data hourly diambil otomatis oleh GitHub Actions, yaitu layanan GitHub yang menjalankan perintah di server sesuai jadwal. Jadwal ditulis dalam format cron (menit, jam, tanggal, bulan, hari) dan selalu dalam UTC. WIB = UTC + 7 jam. Data daily stasiun tidak dijadwalkan.

| Workflow | Cron (UTC) | Waktu WIB | Isi | Lookback |
|---|---|---|---|---|
| `hourly.yml` | `7 * * * *` | tiap jam, menit ke-7 | hourly NASA, dan Open-Meteo tiap 3 jam | 7 hari |
| `deep_refresh.yml` | `33 20 * * *` | 03:33 setiap hari | hourly kedua sumber, sekitar 22 kelurahan per hari | 120 hari |
| `compact.yml` | `43 21 * * 0` | Senin 04:43 | memindahkan data hourly lebih tua dari 130 hari ke Parquet | - |

- **Lookback** adalah rentang hari ke belakang yang diambil ulang setiap kali job berjalan.
- **Menit jadwal tidak di :00.** Antrean GitHub paling padat pada awal jam, jadi menit jadwal sengaja digeser. Jadwal GitHub memang bisa terlambat beberapa menit, dan itu aman karena ada lookback.
- **Open-Meteo hourly diambil tiap 3 jam** (pukul 07, 10, 13, 16, 19, 22, 01, 04 WIB, yaitu jam UTC 00, 03, 06, ...) untuk menghemat kuota, sedangkan NASA diambil tiap jam. Jam yang terlewat, baik karena jadwal 3 jam maupun run yang gagal, tetap terisi karena setiap run mengambil ulang 7 hari terakhir.
- **deep_refresh** memilih kelurahan dengan `kelurahan_id % 7 == tanggal.toordinal() % 7` (tanggal WIB), sehingga seluruh 153 kelurahan tersegarkan sekali dalam 7 hari. `toordinal()` adalah nomor urut hari sejak tahun 1, jadi rotasinya tidak rusak saat pergantian tahun.
- **Concurrency**: setiap workflow punya grup sendiri dengan `cancel-in-progress: false`. Jika run sebelumnya belum selesai, run baru menunggu, bukan berjalan bersamaan. GitHub hanya menyimpan satu run yang menunggu; run menunggu yang lebih lama dibatalkan.
- **Jalan manual**: semua workflow bisa dijalankan dari tab Actions lewat tombol "Run workflow" (`workflow_dispatch`).
- **Saklar jadwal `SCHEDULE_ENABLED`**: jadwal hanya berjalan jika repository variable `SCHEDULE_ENABLED` bernilai `true`. Repository variable adalah pengaturan teks di GitHub, bukan rahasia. Selama belum diisi, run terjadwal tampil sebagai *skipped*, tetapi jalan manual tetap bisa. Isi variabel ini setelah backfill selesai (lihat bagian Backfill).
- **Jadwal bisa nonaktif sendiri**: GitHub menonaktifkan jadwal di repo publik yang tidak ada aktivitas selama 60 hari. Jika itu terjadi, aktifkan lagi dari tab Actions.
- **HTTP 429**: jika API menolak karena batas kuota, job berhenti tanpa menulis data setengah jadi, mencatat status `failed` di `ingestion_log`, dan keluar dengan exit code 1, sehingga run tampil merah di tab Actions.

### Perkiraan kuota Open-Meteo

Kuota gratis Open-Meteo 10.000 bobot panggilan per hari. Pipeline membatasi diri di 9.000 per hari, 4.500 per jam, dan 500 per menit. Bobot dihitung dengan rumus resmi `max(1, (hari / 14) × (variabel / 10))` per lokasi.

| Pemakaian | Bobot |
|---|---|
| `hourly`: 8 run × 153 kelurahan × 2 panggilan (archive dan visibility) | 2.448 per hari |
| `deep_refresh`: sekitar 22 kelurahan × 7 | 153 per hari |
| **Total jadwal otomatis** | **sekitar 2.600 per hari** |
| Backfill hourly 2022-01-01 s.d. 2026-11-11 WIB, sekali | 15.571 |
| `pipeline.stasiun` (rentang default), setiap kali dijalankan | sekitar 141 |

## Backfill

Backfill adalah pengisian data hourly lama untuk 153 kelurahan, dengan rentang tetap **2022-01-01 00:00 WIB sampai 2026-11-11 23:00 WIB** (inklusif; `config.BACKFILL_END`). Proses ini dijalankan manual di laptop, bukan di GitHub, karena butuh lebih dari satu hari; satu job GitHub Actions dibatasi 6 jam.

Isinya NASA POWER, Open-Meteo archive, dan visibility (Historical Forecast API). Pembagian penyimpanannya:
- **Data sebelum batas 130 hari** (dihitung saat backfill berjalan, 00:00 WIB) langsung masuk Parquet.
- **Data 130 hari terakhir** masuk Postgres.

**Selesaikan backfill dulu, baru aktifkan jadwal.** Backfill dan jadwal otomatis memakai kuota Open-Meteo yang sama, padahal penghitung kuotanya hanya lokal. Laptop menyimpannya di `_work/openmeteo_budget.json`, sedangkan server GitHub selalu mulai dari nol, jadi keduanya tidak saling tahu. Kalau berjalan bersamaan, totalnya bisa melewati batas asli Open-Meteo. Akibatnya Open-Meteo menolak dengan HTTP 429 dan keduanya sering berhenti. Data tidak rusak, tetapi prosesnya menjadi lebih lama.

### Menjalankan

Lihat dulu perkiraannya. `--estimate-only` juga menghitung potongan yang sudah selesai dari `ingestion_log`, tanpa memanggil API.

```bash
cd ~/Documents/KULIAH/PA/weather-app/etl
.venv/bin/python -m pipeline.backfill --estimate-only
setsid -f systemd-inhibit --what=sleep:shutdown --why="backfill" .venv/bin/python -m pipeline.backfill > _work/backfill.log 2>&1
```

- **`systemd-inhibit --what=sleep:shutdown`** mencegah laptop sleep atau dimatikan selama backfill berjalan. Menutup lid tetap membuat laptop sleep (aturan default systemd). Jika lid akan ditutup, pakai `--what=sleep:shutdown:handle-lid-switch`.
- **`setsid -f`** menjalankan backfill lepas dari terminal, sehingga tetap berjalan walaupun terminal atau VS Code ditutup. `nohup` tidak cukup, karena `systemd-inhibit` mengembalikan sinyal HUP ke default.
- **`> _work/backfill.log 2>&1`** menyimpan semua output ke log. `_work/` tidak masuk Git.

Memantau dan menghentikan:

```bash
tail -f _work/backfill.log             # progres langsung; Ctrl+C hanya menutup tampilan
pgrep -af "pipeline.backfill"          # tidak ada output = sudah berhenti
grep -c "\[backfill\]" _work/backfill.log   # jumlah potongan yang selesai pada run ini
pkill -INT -f "pipeline.backfill"      # menghentikan dengan aman; kirim sekali, lalu tunggu sampai pgrep kosong
```

Backfill aman dihentikan di tengah jalan. Potongan (sumber, tahun WIB, kelurahan) yang sudah sukses tercatat di `ingestion_log` dan dilewati pada run berikutnya. File Parquet yang belum sempat terunggah juga diunggah otomatis di awal run berikutnya. Untuk melanjutkan, jalankan lagi perintah `setsid -f ...` yang sama; log lama akan tertimpa.

### Saat backfill berhenti sendiri

Lihat pesan terakhirnya dengan `grep -E "Kuota|429|Traceback|Backfill selesai" _work/backfill.log | tail -3`:

| Pesan terakhir | Yang dilakukan |
|---|---|
| `Kuota per jam Open-Meteo penuh` | Tunggu 1 jam, lalu jalankan lagi |
| `Kuota harian Open-Meteo penuh` | Jalankan lagi setelah pukul 07:00 WIB (kuota harian direset pukul 00:00 UTC) |
| `HTTP 429` | Tunggu 1 jam, lalu jalankan lagi |
| `Traceback` | Ada error; simpan log dan periksa sebelum melanjutkan |
| `Potongan baru diproses: 0` | Backfill selesai |

### Perkiraan durasi

Total kebutuhan: 1.530 potongan, 918 request NASA, dan 1.530 panggilan Open-Meteo dengan bobot 15.571, setara 1,73 hari kuota.

1. **NASA lebih dulu**, sekitar 1 jam (sekitar 3 detik per request ditambah jeda).
2. **Open-Meteo sampai kuota per jam habis** (4.500). Satu jam kemudian, run kedua berjalan sampai kuota harian habis (9.000).
3. **Hari berikutnya setelah 07:00 WIB**, dua run lagi untuk sisa bobot sekitar 6.600.

Total sekitar 2 hari kalender, dengan sekitar 4 kali menjalankan perintah dan sekitar 4–5 jam waktu berjalan.

### Mengaktifkan jadwal otomatis

Jadwal harus dinyalakan **setelah backfill selesai, dan paling lambat 2026-11-18**, yaitu 7 hari setelah batas akhir backfill (2026-11-11 23:00 WIB). Lookback job hourly hanya 7 hari. Kalau jadwal baru menyala sesudah tanggal itu, jam setelah batas akhir backfill tidak terjangkau lagi dan akan ada celah data. Celah sampai 120 hari masih tertutup perlahan oleh deep_refresh, tetapi perlu 7 hari per putaran.

Lakukan hanya setelah backfill menampilkan `Potongan baru diproses: 0`. Mulai saat ini, jangan menjalankan backfill di laptop lagi.

```bash
gh variable set SCHEDULE_ENABLED --body true
gh run list --limit 5                  # 1-2 jam kemudian: harus ada run terjadwal "Hourly Weather Ingestion" yang hijau
```

Setelah itu buka `status_pengambilan_data` di Supabase. Pastikan `run_sukses_terakhir_wib` terus maju dan `run_gagal_24_jam_terakhir` bernilai 0.

## Data daily titik stasiun BMKG

**Tujuan**: data daily NASA POWER dan Open-Meteo diambil di titik 3 stasiun BMKG pada `koordinat_BMKG_surabaya.csv` (Juanda 96935, Perak I 96933, Maritim Tanjung Perak 96937). Data ini dibandingkan dengan observasi harian BMKG untuk memilih sumber prioritas per parameter. Data daily per kelurahan tidak diambil.

**Tabel**:
- `stasiun_bmkg`: `id_wmo`, `nama`, `latitude`, `longitude`, dan `elevasi_m` dari CSV, ditambah `elevasi_openmeteo_m` dan `elevasi_nasa_m`, yaitu elevasi titik grid yang dikembalikan API.
- `nasa_daily_stasiun` dan `openmeteo_daily_stasiun`: kunci `(id_wmo, tanggal)`, kolom `fetched_at`, dengan parameter dan nama kolom bersatuan sama dengan daftar daily di `params.py`.

Aturan nilainya sama dengan data hourly: -999/NaN menjadi NULL, dan upsert memakai COALESCE.

**Rentang**: default **2024-06-14 sampai 2026-06-15**, sama untuk ketiga stasiun. Ini rentang data observasi BMKG (15 Jun 2024–14 Jun 2026), ditambah 1 hari di tiap ujung untuk menguji pergeseran hari. Rentang bisa diganti dengan `--start-date` dan `--end-date`.

**Perintah**: `python -m pipeline.stasiun [--start-date 2024-06-14] [--end-date 2026-06-15]`, dengan satu request per stasiun per sumber. Perintah ini **tidak dijadwalkan**. Jalankan manual kapan saja untuk memperbarui datanya; aman diulang karena memakai upsert. Satu run memakai 3 request NASA dan bobot Open-Meteo sekitar 141, memakai penghitung kuota yang sama, dan dicatat di `ingestion_log` sebagai job `stasiun`. Membacanya:

```python
from pipeline import load_stasiun
df = load_stasiun("nasa", mulai="2024-06-15", akhir="2026-06-14")   # kolom: id_wmo, nama_stasiun, tanggal, lalu parameter
```

**Konvensi waktu**, dicatat dari respons API:
- **NASA POWER**: diminta dengan `time-standard=LST`, dan header respons mengembalikan `"time_standard": "LST"`, `"fill_value": -999.0`, serta sumber `GEOSIT`. LST (Local Solar Time) adalah waktu matahari lokal, jadi batas hari mengikuti posisi matahari di titik itu, bukan WIB. Untuk bujur 112,7° hasil hitungannya sekitar UTC+7,5 jam.
- **Open-Meteo**: diminta dengan `timezone=Asia/Jakarta`, dan respons mengembalikan `"timezone": "Asia/Jakarta"` serta `"utc_offset_seconds": 25200`. Satu hari = 00:00–24:00 WIB.

Penyesuaian dengan definisi hari BMKG dilakukan di tahap analisis, bukan di ETL.

**Elevasi**: parameter elevasi tidak diatur, jadi kedua API memakai default, sama seperti data hourly 153 kelurahan. Tujuannya supaya validasi menilai data dengan cara pengambilan yang sama seperti data yang dipakai model. Elevasi yang dikembalikan API disimpan di `stasiun_bmkg`:
- **NASA**: `geometry.coordinates[2]`, yaitu elevasi rata-rata sel grid. Nilainya 239 m untuk Juanda dan 18 m untuk kedua stasiun Perak, padahal elevasi stasiunnya 3 m.
- **Open-Meteo**: `elevation`. Nilainya 3, 5, dan 6 m.

**Catatan untuk analisis**:
- **NASA:** Perak I dan Maritim Tanjung Perak jatuh di sel grid yang sama, jadi nilainya identik 100% untuk semua parameter.
- **Open-Meteo:** angin, hujan, dan sunshine identik 100%, dan kelembapan 98,6% (rentang 2024-06-14 s.d. 2026-06-15). Suhunya berbeda karena Open-Meteo menyesuaikan suhu dengan elevasi titik (5 m dan 6 m): hanya 1–7% hari yang nilainya sama persis.

## Memantau pipeline

Ada dua view pemantauan. Keduanya bisa dibuka di Supabase lewat **Table Editor** (skema `public`; view tampil di daftar yang sama dengan tabel), atau lewat **SQL Editor** dengan `select * from <nama_view>;`. Keduanya dibuat dengan `security_invoker`, jadi tidak membuka data lewat API publik Supabase. Backend nanti membacanya dengan koneksi database biasa.

**`status_pengambilan_data`**: kesehatan job terjadwal (hourly), satu baris per sumber. Run `pipeline.stasiun` tidak ditampilkan di sini.

| Kolom | Arti |
|---|---|
| `run_sukses_terakhir_wib` | kapan job pengambilan terakhir kali selesai sukses |
| `data_terbaru_wib` | waktu data terbaru yang punya minimal satu nilai |
| `run_gagal_24_jam_terakhir` | jumlah run gagal dalam 24 jam terakhir |
| `persen_null_7_hari` | persentase sel kosong (NULL) pada baris 7 hari terakhir |

Untuk `openmeteo_hourly`, beberapa hari terakhir biasanya hanya berisi `visibility`, karena Archive API Open-Meteo tertinggal beberapa hari. Akibatnya `persen_null_7_hari` di baris itu wajar lebih tinggi.

**`status_data_parameter`**: kelengkapan data seluruh periode, satu baris per sumber, granularitas, dan parameter. Untuk `hourly`, lapis panas dan lapis dingin digabung. Granularitas `daily_stasiun` berisi data daily stasiun BMKG, dengan jam selalu 00:00. Semua waktu dalam WIB.

| Kolom | Arti |
|---|---|
| `data_mulai` | waktu paling awal yang parameter ini punya nilai |
| `data_terakhir` | waktu paling akhir yang parameter ini punya nilai |
| `jumlah_baris` | jumlah baris yang tersimpan (jam × kelurahan, atau hari × stasiun) |
| `jumlah_terisi` | jumlah baris yang parameter ini tidak NULL |
| `persen_kosong` | persentase NULL dari `jumlah_baris` |

Lapis dingin tidak dihitung dari file Parquet secara langsung, melainkan dari tabel **`ringkasan_arsip`**. Isinya satu baris per sumber, granularitas, bulan, dan parameter, dengan kolom `jumlah_baris`, `jumlah_terisi`, `waktu_awal_terisi`, `waktu_akhir_terisi`, dan `diperbarui_pada`.
- **Diperbarui otomatis:** backfill dan compact memperbarui ringkasan ini setiap selesai menulis satu file bulanan, dihitung dari isi file setelah digabung.
- **Mengisi ulang:** jalankan `python -m pipeline.ringkasan` untuk mengisi ulang ringkasan dari semua file yang sudah ada di Storage. Perintah ini hanya membaca Storage dan tidak memanggil API cuaca.

Agar baris di sekitar batas 130 hari tidak terhitung dua kali, baris Postgres yang waktunya tidak lebih baru dari data terakhir di arsip dilewati, karena baris itu sudah ada di Parquet. Ini bisa terjadi misalnya jika compact sudah mengunggah sebuah bulan tetapi belum sempat menghapusnya dari Postgres.

## Penanganan missing value

- **-999 dan NaN menjadi NULL.** NASA memakai -999 sebagai tanda "tidak ada data", dan Open-Meteo mengirim `null`. Keduanya disimpan sebagai NULL. Baris yang semua nilainya NULL tidak disimpan.
- **Upsert COALESCE.** Upsert berarti menambah baris baru atau memperbarui baris yang kuncinya sudah ada. COALESCE berarti memakai nilai baru jika tidak NULL, dan mempertahankan nilai lama jika nilai baru NULL. Jadi NULL tidak pernah menimpa data yang sudah ada. Contoh untuk kelurahan 1, 2026-11-08 07:00 WIB:

  | | `temperature_2m (°C)` | `visibility (m)` |
  |---|---|---|
  | Sebelum (di Postgres) | 28.0 | NULL |
  | Data baru dari API | NULL | 10000.0 |
  | Sesudah upsert | 28.0 | 10000.0 |

- **Lookback 7 hari dan penyegaran 120 hari.** Sumber sering mengirim nilai terlambat atau merevisinya. Lookback 7 hari mengisi NULL dari beberapa hari terakhir, dan deep_refresh mengambil ulang 120 hari untuk menangkap revisi yang lebih lambat.
- **Waktu masa depan tidak disimpan.** Yang dibuang: baris hourly setelah jam WIB yang sedang berjalan, dan baris daily stasiun untuk hari ini (WIB) dan sesudahnya. Dengan begitu angka prakiraan tidak pernah tercampur dengan data pengamatan.
- **`fetched_at` dan `mature_only`.** `fetched_at` hanya berubah jika baris menerima nilai non-NULL baru yang berbeda, jadi kolom ini menunjukkan kapan data terakhir berubah. Data yang lebih tua dari 120 hari dianggap matang, karena tidak akan direvisi lagi. Untuk melatih model, pakai `mature_only=True`:

  ```python
  from pipeline import load_dataset
  df = load_dataset("nasa", "2022-01-01", "2026-11-01", mature_only=True)   # hourly 153 kelurahan; tanggal dan kolom waktu dalam WIB
  ```

- **`visibility` bisa NULL.** Kolom ini diambil dari Historical Forecast API, terpisah dari variabel lain. Jika panggilan itu gagal, baris tetap disimpan dengan `visibility` NULL, lalu diisi oleh run berikutnya lewat COALESCE.
- **Penggabungan saat pemadatan.** Saat `compact` memindahkan data ke Parquet, file bulan yang sudah ada digabung dengan aturan COALESCE yang sama. File hasil gabungan diunggah, lalu diunduh ulang untuk memastikan jumlah barisnya. Baru setelah itu baris dihapus dari Postgres. Jika ada langkah yang gagal, data di Postgres tidak dihapus.

## Isi folder

| File atau folder | Fungsi |
|---|---|
| `pipeline/config.py` | path, variabel dari `.env`, dan konstanta (batas kuota, 130/120 hari) |
| `pipeline/params.py` | daftar parameter dan nama kolom bersatuan untuk tiap tabel |
| `pipeline/api.py` | memanggil NASA POWER dan Open-Meteo: retry, jeda, penghitung kuota, berhenti saat HTTP 429 |
| `pipeline/transform.py` | mengubah JSON API menjadi tabel: -999/NaN ke NULL, waktu ke WIB, buang waktu masa depan |
| `pipeline/db.py` | koneksi Postgres, menjalankan `schema.sql`, daftar kelurahan, upsert COALESCE, `ingestion_log` |
| `pipeline/storage.py` | membaca dan menulis Parquet bulanan di Supabase Storage dan `_work/parquet_staging/` |
| `pipeline/ingest.py` | job `hourly` dan `deep_refresh` |
| `pipeline/compact.py` | job pemadatan ke Parquet |
| `pipeline/backfill.py` | backfill hourly lokal yang bisa dilanjutkan |
| `pipeline/stasiun.py` | perintah manual data daily titik stasiun BMKG |
| `pipeline/read.py` | `load_dataset()` (hourly) dan `load_stasiun()` (daily stasiun) |
| `pipeline/ringkasan.py` | menghitung dan menyimpan `ringkasan_arsip`, serta perintah pengisian ulang dari Storage |
| `schema.sql` | tabel, indeks, RLS, dan kedua view pemantauan; dijalankan otomatis di awal setiap job |
| `koordinat_kelurahan_surabaya.csv` | 153 kelurahan: `kode_kel`, `kecamatan`, `desa`, `latitude`, `longitude`, `metode_titik`; nomor baris = `kelurahan_id`, jadi urutannya tidak boleh diubah |
| `koordinat_BMKG_surabaya.csv` | 3 stasiun BMKG: `ID_WMO`, `Stasiun`, `Latitude`, `Longitude`, `elevasi` |
| `requirements.txt` | library Python yang dibutuhkan |
| `_work/` | staging Parquet, penghitung kuota lokal, dan log backfill (tidak masuk Git) |
| `.env` | rahasia koneksi (tidak masuk Git) |
| `../.github/workflows/` | jadwal GitHub Actions |

## Cara menjalankan

Isi `.env` dengan `DATABASE_URL` (URI Session pooler Supabase), `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cd etl && uv venv --python 3.12 && uv pip install -r requirements.txt
source .venv/bin/activate              # fish: source .venv/bin/activate.fish
python -m pipeline.ingest hourly       # atau deep_refresh; opsi --lookback-days, --kelurahan-ids
python -m pipeline.compact
python -m pipeline.backfill            # opsi --estimate-only, --start-date, --kelurahan-ids (lihat bagian Backfill)
python -m pipeline.stasiun             # daily titik stasiun BMKG; opsi --start-date, --end-date
python -m pipeline.ringkasan           # isi ulang ringkasan_arsip dari Parquet yang ada di Storage
```
