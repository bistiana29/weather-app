# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Warga Surabaya (umum)**: membuka peta risiko lewat HP maupun laptop, sering dari tautan pesan peringatan WhatsApp, untuk tahu apakah kelurahannya berisiko cuaca ekstrem esok hari sebelum beraktivitas.
- **Pihak kelurahan/kecamatan dan peneliti**: memantau sebaran risiko lintas kelurahan dari laptop.
- **Pengguna terdaftar**: memilih maksimal 3 kelurahan pantauan dan menerima peringatan WA H-1.
- **Admin sistem**: memantau pengambilan data (ETL), performa dan versi model, serta log notifikasi.

HP dan laptop sama penting; tidak ada ukuran layar yang dikorbankan.

## Product Purpose
Memetakan risiko cuaca ekstrem per kelurahan (153 kelurahan) di Kota Surabaya, dipisah per parameter (curah hujan, suhu, angin, jarak pandang, kelembapan), dari hasil prediksi model forecasting berbasis data NASA POWER dan Open-Meteo. Informasi bahaya harus terbaca jelas dan cepat. Peringatan WhatsApp dikirim pukul 12.00 WIB untuk periode esok hari 00.00–23.59 WIB.

Berhasil berarti warga bisa menemukan kelurahannya dan memahami kategori risikonya dalam beberapa detik, dan peringatan WA membawa mereka langsung ke kelurahan yang tepat.

## Positioning
Resolusi per kelurahan dan per parameter dengan kategori ambang Tabel 2.1 (mengacu peraturan BMKG), ditambah peringatan WA H-1 untuk kelurahan pilihan pengguna. Bukan peringatan resmi BMKG.

## Operating Context
- Tautan dari pesan WA membuka peta pada parameter, kelurahan, dan tanggal tertentu (`/peta-risiko/:parameter?kel=&tgl=`).
- Prediksi dibuat harian pukul 12.00 WIB; semua waktu ditampilkan dalam WIB.
- Area publik tanpa login: Landing dan Peta Risiko. Akun hanya untuk peringatan WA. Admin punya panel terpisah.

## Capabilities and Constraints
- **Status (16 Nov 2026):** prototipe UI/UX. Belum terintegrasi dengan backend maupun model; integrasi direncanakan sekitar dua minggu lagi. Semua data saat ini berasal dari mock (`VITE_USE_MOCK`), dan bentuk respons mock harus tetap sesuai kontrak API dan skema ETL.
- **Kategori data:** satu sumber kebenaran di `src/lib/kategori.js` (objek `AMBANG`). Nilai ambang dan label kategori tidak boleh diubah. Warna kategori data terpisah dari warna brand, dan peta tetap datar.
- **Teknologi:** React 19, Vite, JavaScript (tanpa TypeScript), CSS biasa dengan token di `src/styles/`, react-router, TanStack Query, Leaflet, Recharts, motion, Radix UI, lucide-react.
- **Hanya mode terang.**
- Route, kontrak API/mock, alur autentikasi, dan perilaku mode mock tidak diubah oleh pekerjaan desain.

## Brand Commitments
- **Nama produk tetap:** "Pemetaan Cuaca Ekstrem Surabaya" (bentuk panjang "Pemetaan Cuaca Ekstrem Kota Surabaya").
- **Bahasa:** Bahasa Indonesia baku dengan sapaan "Anda".
- **Logo:** belum ada. Logo final akan disediakan nanti; sementara memakai ikon dari lucide.
- **Disclaimer wajib di area publik:** "Hasil prediksi model, bukan peringatan resmi BMKG."

## Evidence on Hand
- Batas wilayah 153 kelurahan: `public/kelurahan.geojson`.
- Belum ada data prediksi atau metrik model yang nyata. Metrik model (RMSE, R²) ditampilkan sebagai placeholder `[ ]` dan tidak boleh diganti angka karangan. Tidak ada testimoni, statistik pengguna, atau klaim akurasi yang boleh dibuat.

## Product Principles
1. **Bahaya terbaca lebih dulu.** Kategori risiko, nilai, dan periode jam adalah informasi utama di setiap tampilan kelurahan.
2. **Jujur terhadap sumber.** Selalu tampak bahwa ini hasil prediksi model, bukan peringatan resmi; data contoh selalu diberi tanda.
3. **Satu kelurahan, satu tautan.** Setiap tampilan kelurahan bisa dibuka langsung dari URL, sehingga pesan WA mendarat di tempat yang tepat.
4. **Sama baiknya di HP dan laptop.**

## Accessibility & Inclusion
- Kontras teks minimal WCAG AA (4,5:1); focus ring keyboard jelas; target sentuh minimal 44×44 px.
- Responsif: mobile < 768 px, tablet 768–1279 px, desktop ≥ 1280 px.
- Menghormati `prefers-reduced-motion`.
- Informasi kategori tidak boleh hanya bergantung pada warna.
