import {
  DRIFT_PARAMETER,
  EVALUASI_MODEL,
  GATEWAY,
  INGESTION_LOG,
  KELENGKAPAN_HARIAN,
  MOCK_SEKARANG,
  MODEL_REGISTRY,
  NOTIFIKASI_LOG,
  PENGGUNA_ADMIN,
  RIWAYAT_MODEL,
  RUN_HARIAN,
  STATUS_DATA_PARAMETER,
  STATUS_PENGAMBILAN_DATA,
  SUMBER_PRIORITAS,
} from '../mocks/admin'
import { KELURAHAN, STASIUN_BMKG } from '../mocks/kelurahan'
import { PAKAI_MOCK, request, tolakMock, tundaMock } from './client'

// State mock yang bisa berubah selama sesi (promosi model, kirim ulang pesan)
const mock = {
  registry: structuredClone(MODEL_REGISTRY),
  riwayat: structuredClone(RIWAYAT_MODEL),
  notifikasi: structuredClone(NOTIFIKASI_LOG),
}

export const PANJANG_ALASAN_MIN = 10

// View status_pengambilan_data
export function getStatusPengambilan() {
  if (!PAKAI_MOCK) return request('/admin/status-pengambilan-data')
  return tundaMock(STATUS_PENGAMBILAN_DATA)
}

// View status_data_parameter
export function getStatusDataParameter() {
  if (!PAKAI_MOCK) return request('/admin/status-data-parameter')
  return tundaMock(STATUS_DATA_PARAMETER)
}

// Tabel ingestion_log, terbaru di atas
export function getIngestionLog(limit = 50) {
  if (!PAKAI_MOCK) return request(`/admin/ingestion-log?limit=${limit}`)
  return tundaMock(INGESTION_LOG.slice(0, limit))
}

export function getKelurahan() {
  if (!PAKAI_MOCK) return request('/admin/kelurahan')
  return tundaMock(KELURAHAN)
}

export function getStasiunBmkg() {
  if (!PAKAI_MOCK) return request('/admin/stasiun-bmkg')
  return tundaMock(STASIUN_BMKG)
}

// Usulan view kelengkapan_harian (14 hari terakhir)
export function getKelengkapanHarian() {
  if (!PAKAI_MOCK) return request('/admin/kelengkapan-harian?hari=14')
  return tundaMock(KELENGKAPAN_HARIAN)
}

// Usulan tabel run_harian
export function getRunHarian() {
  if (!PAKAI_MOCK) return request('/admin/run-harian/terakhir')
  return tundaMock(RUN_HARIAN)
}

// Minta backfill; ditolak jika job pipeline lain masih berjalan (sama dengan kunci pipeline.lock)
export function mintaBackfill({ sumber, mulai, akhir }) {
  if (!PAKAI_MOCK) return request('/admin/backfill', { method: 'POST', body: { sumber, mulai, akhir } })
  const berjalan = INGESTION_LOG.find((r) => r.status === 'running')
  if (berjalan) return tolakMock(`Job pipeline lain masih berjalan (${berjalan.job} #${berjalan.id}). Coba lagi setelah selesai.`, 409)
  return tundaMock({ diterima: true })
}

// Unggah CSV observasi harian BMKG untuk satu stasiun
export async function unggahCsvBmkg({ idWmo, file }) {
  if (!PAKAI_MOCK) {
    const teks = await file.text()
    return request('/admin/observasi-bmkg', { method: 'POST', body: { id_wmo: idWmo, nama_file: file.name, isi: teks } })
  }
  const baris = (await file.text()).split(/\r?\n/).filter((b) => b.trim())
  return tundaMock({ id_wmo: idWmo, nama_file: file.name, kolom: baris[0]?.split(/[;,]/) ?? [], jumlah_baris: Math.max(0, baris.length - 1), diterima_at: MOCK_SEKARANG })
}

// Usulan tabel model_registry
export function getModelRegistry() {
  if (!PAKAI_MOCK) return request('/admin/model-registry')
  return tundaMock(mock.registry)
}

// Usulan tabel evaluasi_model untuk satu parameter
export function getEvaluasiModel(parameter) {
  if (!PAKAI_MOCK) return request(`/admin/evaluasi-model?parameter=${parameter}&hari=30`)
  return tundaMock(EVALUASI_MODEL)
}

export function getDriftParameter() {
  if (!PAKAI_MOCK) return request('/admin/drift')
  return tundaMock(DRIFT_PARAMETER)
}

export function getSumberPrioritas() {
  if (!PAKAI_MOCK) return request('/admin/sumber-prioritas')
  return tundaMock(SUMBER_PRIORITAS)
}

export function getRiwayatModel() {
  if (!PAKAI_MOCK) return request('/admin/riwayat-model')
  return tundaMock(mock.riwayat)
}

// Promosikan versi staging atau rollback ke versi arsip; versi produksi lama diarsipkan
export function ubahTahapModel({ modelId, aksi, alasan, admin }) {
  if (alasan.trim().length < PANJANG_ALASAN_MIN) return Promise.reject(new Error(`Alasan minimal ${PANJANG_ALASAN_MIN} karakter`))
  if (!PAKAI_MOCK) return request(`/admin/model-registry/${modelId}/${aksi}`, { method: 'POST', body: { alasan } })
  const target = mock.registry.find((m) => m.id === modelId)
  const syarat = aksi === 'promosi' ? 'staging' : 'archived'
  if (!target || target.tahap !== syarat) return tolakMock('Versi model tidak bisa diproses', 400)
  const produksi = mock.registry.find((m) => m.parameter === target.parameter && m.tahap === 'production')
  if (produksi) produksi.tahap = 'archived'
  target.tahap = 'production'
  mock.riwayat.unshift({
    id: Date.now(),
    parameter: target.parameter,
    aksi,
    dari_versi: produksi?.versi ?? null,
    ke_versi: target.versi,
    alasan: alasan.trim(),
    admin,
    dilakukan_at: new Date().toISOString(),
  })
  return tundaMock(target)
}

// Usulan status gateway pesan WA
export function getGateway() {
  if (!PAKAI_MOCK) return request('/admin/gateway')
  return tundaMock(GATEWAY)
}

// Usulan tabel notifikasi_log (kiriman terakhir)
export function getNotifikasiLog() {
  if (!PAKAI_MOCK) return request('/admin/notifikasi-log')
  return tundaMock(mock.notifikasi)
}

export function kirimUlangNotifikasi(id) {
  if (!PAKAI_MOCK) return request(`/admin/notifikasi-log/${id}/kirim-ulang`, { method: 'POST' })
  const baris = mock.notifikasi.find((n) => n.id === id)
  if (!baris || baris.status !== 'gagal') return tolakMock('Pesan ini tidak perlu dikirim ulang', 400)
  Object.assign(baris, { status: 'terkirim', percobaan: baris.percobaan + 1, pesan_error: null, dikirim_at: new Date().toISOString() })
  return tundaMock(baris)
}

// Usulan tabel pengguna, kolom pribadi sudah tersamar dari server
export function getPenggunaAdmin() {
  if (!PAKAI_MOCK) return request('/admin/pengguna')
  return tundaMock(PENGGUNA_ADMIN)
}
