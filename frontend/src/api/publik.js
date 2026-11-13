import { buatPrakiraan, buatRingkasan, buatRisiko } from '../mocks/cuaca'
import { PAKAI_MOCK, request, tundaMock } from './client'

let janjiGeojson = null

// Batas wilayah 153 kelurahan (file statis di public/)
export function getKelurahanGeojson() {
  janjiGeojson ??= fetch(`${import.meta.env.BASE_URL}kelurahan.geojson`).then((r) => {
    if (!r.ok) {
      janjiGeojson = null
      throw new Error('Gagal memuat batas kelurahan')
    }
    return r.json()
  })
  return janjiGeojson
}

async function daftarKodeKel() {
  const geojson = await getKelurahanGeojson()
  return geojson.features.map((f) => f.properties.kode_kel)
}

// Risiko semua kelurahan: { "<kode_kel>": { nilai, kategori, jam_mulai, jam_selesai } }
export async function getRisiko(parameter, tgl) {
  if (!PAKAI_MOCK) return request(`/risiko/${parameter}?tgl=${tgl}`)
  return tundaMock(buatRisiko(await daftarKodeKel(), parameter, tgl))
}

// Prakiraan 24 jam observasi + 24 jam prediksi untuk satu kelurahan
export async function getPrakiraan(kodeKel, parameter, tgl) {
  if (!PAKAI_MOCK) return request(`/prakiraan/${kodeKel}/${parameter}?tgl=${tgl}`)
  return tundaMock(buatPrakiraan(kodeKel, parameter, tgl))
}

// Jumlah kelurahan per jenis kejadian untuk satu tanggal
export async function getRingkasan(tgl) {
  if (!PAKAI_MOCK) return request(`/ringkasan?tgl=${tgl}`)
  return tundaMock(buatRingkasan(await daftarKodeKel(), tgl))
}
