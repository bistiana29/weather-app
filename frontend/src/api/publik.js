import { buatPrakiraan, buatRisikoGabungan } from '../mocks/cuaca'
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

// Risiko semua kelurahan dan parameter: { "<kode_kel>": { rain: { nilai, kategori, jam_mulai, jam_selesai }, wind: {...}, ... } }
export async function getRisiko(tgl) {
  if (!PAKAI_MOCK) return request(`/risiko?tgl=${tgl}`)
  return tundaMock(buatRisikoGabungan(await daftarKodeKel(), tgl))
}

// Prakiraan 24 jam observasi + 24 jam prediksi untuk satu kelurahan; observasi kosong untuk tanggal lebih dari H+1
export async function getPrakiraan(kodeKel, parameter, tgl) {
  if (!PAKAI_MOCK) return request(`/prakiraan/${kodeKel}/${parameter}?tgl=${tgl}`)
  return tundaMock(buatPrakiraan(kodeKel, parameter, tgl))
}
