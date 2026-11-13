import { ambangParameter, batasKejadian, hitungKejadian, JENIS_KEJADIAN, kategoriDari, PARAMETER } from '../lib/kategori'
import { tambahHari } from '../lib/tanggal'

// Data cuaca contoh (fiktif) yang dibangkitkan deterministik dari kode kelurahan + tanggal

const SUHU_NORMAL_CONTOH = 32
const MODEL_CONTOH = { nama: '[ARIMAX / LSTM]', versi: '[vX]' }

function hash(teks) {
  let h = 2166136261
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Angka acak 0..1 yang selalu sama untuk kunci yang sama
function acak(...kunci) {
  let a = hash(kunci.join('|'))
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function gauss(jam, pusat, lebar) {
  return Math.exp(-((jam - pusat) ** 2) / (2 * lebar ** 2))
}

// Pola harian suhu: minimum pukul 05, puncak pukul 14
function polaSuhu(jam) {
  if (jam >= 5 && jam <= 14) return (1 - Math.cos((Math.PI * (jam - 5)) / 9)) / 2
  const jarak = (jam - 14 + 24) % 24
  return (1 + Math.cos((Math.PI * jarak) / 15)) / 2
}

const bulat = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d

// Bangkitkan 24 nilai per jam untuk satu kelurahan, parameter, dan tanggal
function buatSeri(kodeKel, parameter, tgl) {
  const kodeKec = kodeKel.split('.').slice(0, 3).join('.')
  const rHari = acak(parameter, tgl)
  const rKec = acak(parameter, tgl, kodeKec)
  const rKel = acak(parameter, tgl, kodeKel)
  const rWilayah = rKec * 0.65 + rKel * 0.35
  const jam = Array.from({ length: 24 }, (_, i) => i)

  if (parameter === 'hujan') {
    const puncak = 75 * rWilayah ** 3.4 * (0.5 + rHari * 0.7)
    const pusat = 13 + Math.floor(acak('jam', tgl, kodeKec) * 5)
    const lebar = 1.4 + rKel * 1.6
    return jam.map((j) => {
      const v = puncak * gauss(j, pusat, lebar)
      return v < 0.2 ? 0 : bulat(v)
    })
  }
  if (parameter === 'suhu') {
    const maks = SUHU_NORMAL_CONTOH - 1 + rWilayah * 5 + (rHari - 0.5) * 1.5
    const min = maks - 7
    return jam.map((j) => bulat(min + (maks - min) * polaSuhu(j)))
  }
  if (parameter === 'angin') {
    const maks = 14 + rWilayah ** 1.7 * 44 * (0.7 + rHari * 0.5)
    const dasar = maks * 0.35
    const pusat = 14 + Math.floor(rKel * 3)
    return jam.map((j) => bulat(dasar + (maks - dasar) * gauss(j, pusat, 3), 0))
  }
  if (parameter === 'jarak-pandang') {
    const min = 400 + (1 - rWilayah) ** 1.3 * 9000 * (0.6 + rHari * 0.6)
    return jam.map((j) => Math.round((10000 - (10000 - min) * gauss(j, 6, 2.2)) / 10) * 10)
  }
  const maks = 72 + rWilayah * 26
  return jam.map((j) => bulat(maks - 24 * polaSuhu(j), 0))
}

const formatJam = (j) => (j >= 24 ? '23:59' : `${String(j).padStart(2, '0')}:00`)

// Ringkas seri jadi nilai puncak, kategori, dan periode jam kejadian
function ringkasSeri(parameter, seri) {
  const normal = parameter === 'suhu' ? SUHU_NORMAL_CONTOH : undefined
  const pakaiMin = PARAMETER[parameter].jenisNilai === 'min'
  const nilai = pakaiMin ? Math.min(...seri) : Math.max(...seri)
  const kategori = kategoriDari(parameter, nilai, { normal })
  const batas = batasKejadian(parameter, kategori, { normal })
  if (!batas) return { nilai, kategori, jam_mulai: null, jam_selesai: null }
  const kena = seri.map((v, j) => (batas.arah === 'bawah' ? v < batas.nilai : v >= batas.nilai) && j).filter((j) => j !== false)
  return { nilai, kategori, jam_mulai: formatJam(kena[0]), jam_selesai: formatJam(kena.at(-1) + 1) }
}

export function buatRisiko(daftarKode, parameter, tgl) {
  return Object.fromEntries(daftarKode.map((kode) => [kode, ringkasSeri(parameter, buatSeri(kode, parameter, tgl))]))
}

export function buatRingkasan(daftarKode, tgl) {
  return Object.fromEntries(
    JENIS_KEJADIAN.map((j) => [j.kunci, hitungKejadian(j.parameter, buatRisiko(daftarKode, j.parameter, tgl))]),
  )
}

export function buatPrakiraan(kodeKel, parameter, tgl) {
  const kemarin = tambahHari(tgl, -1)
  const normal = parameter === 'suhu' ? SUHU_NORMAL_CONTOH : null
  const prediksi = buatSeri(kodeKel, parameter, tgl)
  const observasi = buatSeri(kodeKel, parameter, kemarin)
  const keTitik = (tanggal) => (nilai, j) => ({ waktu: `${tanggal}T${String(j).padStart(2, '0')}:00`, nilai })
  return {
    kode_kel: kodeKel,
    parameter,
    tgl,
    satuan: PARAMETER[parameter].satuan,
    ...ringkasSeri(parameter, prediksi),
    normal,
    ambang: ambangParameter(parameter, { normal }),
    observasi: observasi.map(keTitik(kemarin)),
    prediksi: prediksi.map(keTitik(tgl)),
    model: MODEL_CONTOH,
    dibuat: `${kemarin}T12:00`,
  }
}
