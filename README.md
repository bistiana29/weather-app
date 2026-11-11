# Weather App

Weather App adalah sistem pemantauan dan peringatan risiko cuaca ekstrem untuk setiap kelurahan di Kota Surabaya. Sistem ini mengumpulkan data cuaca per jam dan per hari dari NASA POWER dan Open-Meteo untuk 153 kelurahan, menyimpannya di Supabase, lalu memakainya untuk membangun model risiko yang hasilnya akan disajikan lewat backend dan antarmuka web.

| Folder | Fungsi |
|---|---|
| `etl/` | Pipeline pengambilan, pembersihan, dan penyimpanan data cuaca (berjalan terjadwal lewat GitHub Actions) |
| `modeling/` | Notebook eksplorasi data dan pemodelan risiko cuaca |
| `backend/` | API yang akan menyajikan data dan hasil model (belum dibuat) |
| `frontend/` | Antarmuka web berbasis React dan Vite |

Penjelasan lengkap pipeline, jadwal di `.github/workflows/`, dan cara menjalankannya ada di [etl/README.md](etl/README.md).
