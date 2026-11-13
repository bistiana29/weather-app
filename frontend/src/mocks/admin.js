import { KELURAHAN } from './kelurahan'

// Data contoh halaman admin. Bentuk status_data_parameter, status_pengambilan_data, dan ingestion_log
// mengikuti etl/schema.sql; bentuk lain adalah usulan tabel. Semua waktu dalam WIB (+07:00).

export const MOCK_SEKARANG = '2026-11-13T13:10:00+07:00'
const DATA_MULAI = '2022-01-01T00:00:00+07:00'
const BACKFILL_AKHIR = '2026-11-11T23:00:00+07:00'
const NASA_TERAKHIR = '2026-11-09T07:00:00+07:00'
const STASIUN_MULAI = '2024-06-14T00:00:00+07:00'
const STASIUN_AKHIR = '2026-06-15T00:00:00+07:00'
const JUMLAH_KELURAHAN = KELURAHAN.length
const JAM_HOURLY = 42624
const HARI_STASIUN = 732

// Baris view status_data_parameter dengan persen_kosong konsisten terhadap jumlah_terisi
function barisParameter(sumber, granularitas, parameter, mulai, akhir, jumlahBaris, persenKosong) {
  const jumlahTerisi = Math.round(jumlahBaris * (1 - persenKosong / 100))
  return {
    sumber,
    granularitas,
    parameter,
    data_mulai: mulai,
    data_terakhir: akhir,
    jumlah_baris: jumlahBaris,
    jumlah_terisi: jumlahTerisi,
    persen_kosong: Math.round(((jumlahBaris - jumlahTerisi) / jumlahBaris) * 10000) / 100,
  }
}

const BARIS_HOURLY = JAM_HOURLY * JUMLAH_KELURAHAN
const BARIS_STASIUN = HARI_STASIUN * 3

export const STATUS_DATA_PARAMETER = [
  ...['T2M (°C)', 'WS2M (m/s)', 'WD2M (°)', 'PRECTOTCORR (mm/jam)', 'RH2M (%)', 'PS (kPa)'].map((p) =>
    barisParameter('nasa', 'hourly', p, DATA_MULAI, NASA_TERAKHIR, BARIS_HOURLY, 0.15),
  ),
  ...['T2M (°C)', 'T2M_MAX (°C)', 'T2M_MIN (°C)', 'WS2M (m/s)', 'WS2M_MAX (m/s)', 'WD2M (°)', 'PRECTOTCORR (mm/hari)', 'RH2M (%)'].map((p) =>
    barisParameter('nasa', 'daily_stasiun', p, STASIUN_MULAI, STASIUN_AKHIR, BARIS_STASIUN, 0),
  ),
  ...[
    ['temperature_2m (°C)', 0],
    ['wind_speed_10m (kn)', 0],
    ['wind_direction_10m (°)', 0],
    ['relative_humidity_2m (%)', 0],
    ['precipitation (mm)', 0],
    ['sunshine_duration (s)', 0],
    ['surface_pressure (hPa)', 0],
    ['visibility (m)', 1.37],
  ].map(([p, kosong]) => barisParameter('openmeteo', 'hourly', p, DATA_MULAI, BACKFILL_AKHIR, BARIS_HOURLY, kosong)),
  ...[
    'temperature_2m_mean (°C)',
    'temperature_2m_max (°C)',
    'temperature_2m_min (°C)',
    'wind_speed_10m_mean (kn)',
    'wind_speed_10m_max (kn)',
    'wind_direction_10m_dominant (°)',
    'precipitation_sum (mm)',
    'relative_humidity_2m_mean (%)',
    'sunshine_duration (s)',
  ].map((p) => barisParameter('openmeteo', 'daily_stasiun', p, STASIUN_MULAI, STASIUN_AKHIR, BARIS_STASIUN, 0)),
]

export const STATUS_PENGAMBILAN_DATA = [
  {
    sumber: 'nasa',
    granularitas: 'hourly',
    run_sukses_terakhir_wib: '2026-11-13T12:58:41+07:00',
    data_terbaru_wib: NASA_TERAKHIR,
    run_gagal_24_jam_terakhir: 0,
    persen_null_7_hari: 48.5,
  },
  {
    sumber: 'openmeteo',
    granularitas: 'hourly',
    run_sukses_terakhir_wib: '2026-11-13T12:57:03+07:00',
    data_terbaru_wib: BACKFILL_AKHIR,
    run_gagal_24_jam_terakhir: 2,
    persen_null_7_hari: 0,
  },
]

const RENTANG_TAHUN = {
  2025: ['2025-01-01T00:00:00+07:00', '2025-12-31T23:00:00+07:00', 8760],
  2024: ['2024-01-01T00:00:00+07:00', '2024-12-31T23:00:00+07:00', 8784],
}

// Riwayat run ingestion_log, terbaru di atas
export const INGESTION_LOG = [
  { id: 48213, job: 'backfill', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: 88, tahun: 2025, tujuan: 'backfill_chunk', status: 'running', mulai_at: '2026-11-13T12:59:02+07:00', selesai_at: null },
  { id: 48212, job: 'backfill', sumber: 'nasa', granularitas: 'hourly', kelurahan_id: 88, tahun: 2025, tujuan: 'backfill_chunk', status: 'success', mulai_at: '2026-11-13T12:58:10+07:00', selesai_at: '2026-11-13T12:58:41+07:00' },
  { id: 48211, job: 'backfill', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: 87, tahun: 2025, tujuan: 'backfill_chunk', status: 'success', mulai_at: '2026-11-13T12:56:21+07:00', selesai_at: '2026-11-13T12:57:03+07:00' },
  { id: 48210, job: 'backfill_flush', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: null, tahun: null, tujuan: 'storage:2025-12', status: 'success', jumlah_baris: 7440, mulai_at: '2026-11-13T12:55:40+07:00', selesai_at: '2026-11-13T12:56:18+07:00' },
  { id: 48209, job: 'backfill', sumber: 'nasa', granularitas: 'hourly', kelurahan_id: 87, tahun: 2025, tujuan: 'backfill_chunk', status: 'success', mulai_at: '2026-11-13T12:54:52+07:00', selesai_at: '2026-11-13T12:55:31+07:00' },
  { id: 48208, job: 'backfill', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: 87, tahun: 2025, tujuan: 'backfill_chunk', status: 'failed', pesan_error: 'Open-Meteo menolak permintaan: HTTP 429 (kuota terlampaui)', mulai_at: '2026-11-13T07:12:09+07:00', selesai_at: '2026-11-13T07:12:11+07:00' },
  { id: 48207, job: 'backfill', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: 87, tahun: 2025, tujuan: 'backfill_chunk', status: 'failed', pesan_error: 'Open-Meteo menolak permintaan: HTTP 429 (kuota terlampaui)', mulai_at: '2026-11-13T03:15:47+07:00', selesai_at: '2026-11-13T03:15:48+07:00' },
  { id: 48206, job: 'backfill', sumber: 'nasa', granularitas: 'hourly', kelurahan_id: 86, tahun: 2025, tujuan: 'backfill_chunk', status: 'success', mulai_at: '2026-11-13T03:13:30+07:00', selesai_at: '2026-11-13T03:14:02+07:00' },
  { id: 48190, job: 'stasiun', sumber: 'nasa', granularitas: 'daily_stasiun', kelurahan_id: null, tahun: null, tujuan: 'nasa_daily_stasiun', status: 'success', jumlah_baris: BARIS_STASIUN, mulai_at: '2026-11-12T20:05:11+07:00', selesai_at: '2026-11-12T20:05:26+07:00', rentang_mulai: '2024-06-14T00:00:00+07:00', rentang_akhir: STASIUN_AKHIR },
  { id: 48189, job: 'stasiun', sumber: 'openmeteo', granularitas: 'daily_stasiun', kelurahan_id: null, tahun: null, tujuan: 'openmeteo_daily_stasiun', status: 'success', jumlah_baris: BARIS_STASIUN, mulai_at: '2026-11-12T20:04:40+07:00', selesai_at: '2026-11-12T20:05:09+07:00', rentang_mulai: '2024-06-14T00:00:00+07:00', rentang_akhir: STASIUN_AKHIR },
  { id: 47702, job: 'backfill', sumber: 'nasa', granularitas: 'hourly', kelurahan_id: 41, tahun: 2024, tujuan: 'backfill_chunk', status: 'superseded', mulai_at: '2026-11-10T16:20:13+07:00', selesai_at: '2026-11-10T16:20:49+07:00' },
  { id: 47701, job: 'backfill', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: 41, tahun: 2024, tujuan: 'backfill_chunk', status: 'superseded', mulai_at: '2026-11-10T16:19:30+07:00', selesai_at: '2026-11-10T16:20:11+07:00' },
  { id: 47655, job: 'backfill', sumber: 'openmeteo', granularitas: 'hourly', kelurahan_id: 44, tahun: 2024, tujuan: 'backfill_chunk', status: 'aborted', mulai_at: '2026-11-10T09:02:44+07:00', selesai_at: null },
].map(({ tahun, ...kolom }) => {
  const [mulai, akhir, jam] = tahun ? RENTANG_TAHUN[tahun] : [kolom.rentang_mulai ?? null, kolom.rentang_akhir ?? null, null]
  return {
    rentang_mulai: mulai,
    rentang_akhir: akhir,
    pesan_error: null,
    ...kolom,
    jumlah_baris: kolom.jumlah_baris ?? (kolom.status === 'success' || kolom.status === 'superseded' ? jam : null),
  }
})

// Usulan view kelengkapan_harian: persen sel terisi per sumber, parameter, dan tanggal WIB
const TANGGAL_14 = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 31 + i))
  return d.toISOString().slice(0, 10)
})

function kelengkapan(sumber, parameter, persenPerTanggal) {
  return TANGGAL_14.map((tanggal) => {
    const persen = persenPerTanggal(tanggal)
    const jumlahBaris = persen == null ? 0 : 24 * JUMLAH_KELURAHAN
    return {
      sumber,
      granularitas: 'hourly',
      parameter,
      tanggal,
      jumlah_baris: jumlahBaris,
      jumlah_terisi: persen == null ? 0 : Math.round((jumlahBaris * persen) / 100),
    }
  })
}

const sesudahBackfill = (t) => t > '2026-11-11'
export const KELENGKAPAN_HARIAN = [
  ...['T2M (°C)', 'WS2M (m/s)', 'WD2M (°)', 'PRECTOTCORR (mm/jam)', 'RH2M (%)', 'PS (kPa)'].flatMap((p) =>
    kelengkapan('nasa', p, (t) => {
      if (sesudahBackfill(t)) return null
      if (t === '2026-11-09') return 33.3
      return t > '2026-11-09' ? 0 : 100
    }),
  ),
  ...[
    'temperature_2m (°C)',
    'wind_speed_10m (kn)',
    'wind_direction_10m (°)',
    'relative_humidity_2m (%)',
    'precipitation (mm)',
    'sunshine_duration (s)',
    'surface_pressure (hPa)',
    'visibility (m)',
  ].flatMap((p) =>
    kelengkapan('openmeteo', p, (t) => {
      if (sesudahBackfill(t)) return null
      return p === 'visibility (m)' && (t === '2026-11-03' || t === '2026-11-04') ? 91.7 : 100
    }),
  ),
]

// Usulan tabel run_harian: status tiap tahap alur harian
export const RUN_HARIAN = {
  tanggal_prakiraan: '2026-11-14',
  tahap: [
    { tahap: 'ingest', status: 'peringatan', mulai_at: '2026-11-13T12:00:04+07:00', selesai_at: '2026-11-13T12:00:09+07:00', pesan: 'Data hourly terakhir 11 Nov 23.00 WIB; jadwal hourly belum aktif selama backfill' },
    { tahap: 'pra_proses', status: 'sukses', mulai_at: '2026-11-13T12:00:10+07:00', selesai_at: '2026-11-13T12:02:31+07:00', pesan: null },
    { tahap: 'forecast', status: 'sukses', mulai_at: '2026-11-13T12:02:32+07:00', selesai_at: '2026-11-13T12:09:18+07:00', pesan: null },
    { tahap: 'klasifikasi', status: 'sukses', mulai_at: '2026-11-13T12:09:19+07:00', selesai_at: '2026-11-13T12:09:24+07:00', pesan: null },
    { tahap: 'kirim_wa', status: 'peringatan', mulai_at: '2026-11-13T12:09:25+07:00', selesai_at: '2026-11-13T12:10:02+07:00', pesan: '2 pesan gagal terkirim' },
  ],
}

// Usulan tabel model_registry; metrik dibiarkan null sampai evaluasi tersedia
const model = (id, parameter, jenis_model, versi, tahap, sumber_data, dilatih_pada) => ({
  id,
  parameter,
  jenis_model,
  versi,
  tahap,
  sumber_data,
  rentang_latih_mulai: '2022-01-01',
  rentang_latih_akhir: '2025-12-31',
  dilatih_pada,
  rmse: null,
  mae: null,
  r2: null,
})

export const MODEL_REGISTRY = [
  model(15, 'hujan', 'LSTM', 'v5', 'staging', 'openmeteo', '2026-11-12T21:40:00+07:00'),
  model(12, 'hujan', 'LSTM', 'v4', 'production', 'openmeteo', '2026-10-28T20:15:00+07:00'),
  model(8, 'hujan', 'ARIMAX', 'v3', 'archived', 'openmeteo', '2026-10-02T19:05:00+07:00'),
  model(13, 'suhu', 'ARIMAX', 'v3', 'production', 'nasa', '2026-10-29T18:30:00+07:00'),
  model(9, 'suhu', 'ARIMAX', 'v2', 'archived', 'nasa', '2026-10-03T18:10:00+07:00'),
  model(14, 'angin', 'LSTM', 'v2', 'production', 'openmeteo', '2026-10-30T22:00:00+07:00'),
  model(10, 'angin', 'ARIMAX', 'v1', 'archived', 'openmeteo', '2026-10-04T17:45:00+07:00'),
  model(11, 'jarak-pandang', 'ARIMAX', 'v2', 'production', 'openmeteo', '2026-10-30T23:10:00+07:00'),
  model(7, 'kelembapan', 'ARIMAX', 'v2', 'production', 'nasa', '2026-10-27T17:20:00+07:00'),
]

// Usulan tabel evaluasi_model: 30 hari terakhir, nilai metrik belum ada
export const EVALUASI_MODEL = Array.from({ length: 30 }, (_, i) => ({
  tanggal: new Date(Date.UTC(2026, 9, 14 + i)).toISOString().slice(0, 10),
  rmse_produksi: null,
  rmse_persistence: null,
  batas_drift: null,
}))

// Status drift per parameter (dari evaluasi_model), tanpa angka
export const DRIFT_PARAMETER = { hujan: true }

// Usulan tabel sumber_prioritas; nilai metrik validasi menunggu data BMKG
export const SUMBER_PRIORITAS = [
  { parameter: 'hujan', sumber: 'openmeteo', kolom_sumber: 'precipitation (mm)', metrik: 'RMSE vs BMKG', nilai_metrik: null, divalidasi_pada: null },
  { parameter: 'suhu', sumber: 'nasa', kolom_sumber: 'T2M (°C)', metrik: 'RMSE vs BMKG', nilai_metrik: null, divalidasi_pada: null },
  { parameter: 'angin', sumber: 'openmeteo', kolom_sumber: 'wind_speed_10m (kn)', metrik: 'RMSE vs BMKG', nilai_metrik: null, divalidasi_pada: null },
  { parameter: 'jarak-pandang', sumber: 'openmeteo', kolom_sumber: 'visibility (m)', metrik: 'satu-satunya sumber', nilai_metrik: null, divalidasi_pada: null },
  { parameter: 'kelembapan', sumber: 'nasa', kolom_sumber: 'RH2M (%)', metrik: 'RMSE vs BMKG', nilai_metrik: null, divalidasi_pada: null },
]

// Usulan tabel riwayat_model: catatan promosi dan rollback
export const RIWAYAT_MODEL = [
  { id: 4, parameter: 'hujan', aksi: 'promosi', dari_versi: 'v3', ke_versi: 'v4', alasan: 'Validasi musim hujan 2025 lebih stabil pada LSTM', admin: 'admin@contoh.id', dilakukan_at: '2026-10-29T09:12:00+07:00' },
]

// Usulan status gateway pesan WA
export const GATEWAY = {
  penyedia: '[nama gateway]',
  status: 'terhubung',
  nomor_pengirim: '+62 811-****-**21',
  diperiksa_at: '2026-11-13T13:05:00+07:00',
}

// Usulan tabel notifikasi_log untuk kiriman 12.00 WIB (prakiraan esok hari)
const LOG_DASAR = [
  ['01', 'terkirim', ['Asem Rowo', 'Lakarsantri']],
  ['02', 'terkirim', ['Gubeng']],
  ['03', 'gagal', ['Ketintang', 'Jambangan'], 'Nomor tidak terdaftar di WhatsApp'],
  ['04', 'terkirim', ['Rungkut Kidul']],
  ['05', 'terkirim', ['Wonokromo', 'Darmo', 'Sawunggaling']],
  ['06', 'gagal', ['Kenjeran'], 'Gateway tidak merespons (timeout 30 dtk)'],
  ['07', 'terkirim', ['Tambak Wedi']],
  ['08', 'terkirim', ['Medokan Ayu']],
]
export const NOTIFIKASI_LOG = LOG_DASAR.map(([n, status, kelurahan, pesan_error], i) => ({
  id: 900 + i,
  pengguna: `Pengguna ${n}`,
  no_wa_samar: `+62 8**-****-**${String(10 + i * 7).slice(-2)}`,
  tanggal_prakiraan: '2026-11-14',
  kelurahan,
  status,
  percobaan: status === 'gagal' ? 3 : 1,
  pesan_error: pesan_error ?? null,
  dikirim_at: `2026-11-13T12:${String(9 + Math.floor(i / 3)).padStart(2, '0')}:${String(30 + i * 3).padStart(2, '0')}+07:00`,
}))

// Usulan tabel pengguna (kolom tersamar saat dikirim ke admin)
export const PENGGUNA_ADMIN = LOG_DASAR.map(([n, , kelurahan], i) => ({
  id: `u-${n}`,
  nama: `Pengguna ${n}`,
  email_samar: `p***${n}@contoh.id`,
  no_wa_samar: `+62 8**-****-**${String(10 + i * 7).slice(-2)}`,
  notif_wa: i !== 6,
  jumlah_pantauan: kelurahan.length,
  persetujuan_wa_at: `2026-11-${String(1 + i).padStart(2, '0')}T${String(8 + i).padStart(2, '0')}:14:00+07:00`,
  terverifikasi_at: `2026-11-${String(1 + i).padStart(2, '0')}T${String(8 + i).padStart(2, '0')}:16:00+07:00`,
}))
