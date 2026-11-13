// Sumber tunggal kategori cuaca ekstrem (Tabel 2.1)

export const WARNA_DATA = {
  netral: '#F3F4F1',
  hujan: ['#F3F4F1', '#FDE9A8', '#F9B44C', '#EE6A2C', '#C21F3A', '#6B0F3A'],
  ekstrem: '#C21F3A',
}

const KELEMBAPAN_MIN = 60
const KELEMBAPAN_MAX = 100
const KELEMBAPAN_WARNA = ['#F3F4F1', '#5B6875']

export const TIDAK_EKSTREM = 'Tidak Ekstrem'

// Semua angka ambang Tabel 2.1 (BMKG) hanya ditulis di sini
export const AMBANG = {
  hujanRingan: 1,
  hujanSedang: 5,
  hujanLebat: 10,
  hujanSangatLebat: 20,
  // Tafsiran batas tabel: nilai tepat 50 mm/jam masuk Hujan Ekstrem
  hujanEkstrem: 50,
  anginKencangKmj: 45,
  anginKencangKnot: 25,
  suhuDiAtasNormal: 3,
  jarakPandangM: 1000,
}

const A = AMBANG

export const PARAMETER = {
  hujan: {
    slug: 'hujan',
    label: 'Hujan',
    judul: 'Curah Hujan',
    satuan: 'mm/jam',
    jenisNilai: 'maks',
    kategori: [
      // Label tampilan untuk < 1 mm/jam, bukan bagian Tabel 2.1
      { label: 'Tidak Hujan', min: -Infinity, rentang: `< ${A.hujanRingan}`, warna: WARNA_DATA.hujan[0] },
      { label: 'Hujan Ringan', min: A.hujanRingan, rentang: `${A.hujanRingan} – < ${A.hujanSedang}`, warna: WARNA_DATA.hujan[1] },
      { label: 'Hujan Sedang', min: A.hujanSedang, rentang: `${A.hujanSedang} – < ${A.hujanLebat}`, warna: WARNA_DATA.hujan[2] },
      { label: 'Hujan Lebat', min: A.hujanLebat, rentang: `${A.hujanLebat} – < ${A.hujanSangatLebat}`, warna: WARNA_DATA.hujan[3] },
      { label: 'Hujan Sangat Lebat', min: A.hujanSangatLebat, rentang: `${A.hujanSangatLebat} – < ${A.hujanEkstrem}`, warna: WARNA_DATA.hujan[4] },
      { label: 'Hujan Ekstrem', min: A.hujanEkstrem, rentang: `≥ ${A.hujanEkstrem}`, warna: WARNA_DATA.hujan[5] },
    ],
  },
  suhu: {
    slug: 'suhu',
    label: 'Suhu',
    judul: 'Suhu Udara',
    satuan: '°C',
    jenisNilai: 'maks',
    kategori: [
      { label: TIDAK_EKSTREM, rentang: `< normal + ${A.suhuDiAtasNormal} °C`, warna: WARNA_DATA.netral },
      { label: 'Suhu Ekstrem', rentang: `≥ normal + ${A.suhuDiAtasNormal} °C`, warna: WARNA_DATA.ekstrem },
    ],
  },
  angin: {
    slug: 'angin',
    label: 'Angin',
    judul: 'Kecepatan Angin',
    satuan: 'km/jam',
    jenisNilai: 'maks',
    kategori: [
      { label: TIDAK_EKSTREM, rentang: `< ${A.anginKencangKmj} km/jam`, warna: WARNA_DATA.netral },
      { label: 'Angin Kencang', rentang: `≥ ${A.anginKencangKmj} km/jam (±${A.anginKencangKnot} knot)`, warna: WARNA_DATA.ekstrem },
    ],
  },
  'jarak-pandang': {
    slug: 'jarak-pandang',
    label: 'Jarak Pandang',
    judul: 'Jarak Pandang Mendatar',
    satuan: 'm',
    jenisNilai: 'min',
    kategori: [
      { label: TIDAK_EKSTREM, rentang: `≥ ${A.jarakPandangM} m`, warna: WARNA_DATA.netral },
      { label: 'Jarak Pandang Mendatar Ekstrem', rentang: `< ${A.jarakPandangM} m`, warna: WARNA_DATA.ekstrem },
    ],
  },
  kelembapan: {
    slug: 'kelembapan',
    label: 'Kelembapan',
    judul: 'Kelembapan Udara',
    satuan: '%',
    jenisNilai: 'maks',
    kategori: [],
    skala: { min: KELEMBAPAN_MIN, max: KELEMBAPAN_MAX, warna: KELEMBAPAN_WARNA },
  },
}

export const DAFTAR_PARAMETER = Object.values(PARAMETER)

export function parameterValid(slug) {
  return Object.hasOwn(PARAMETER, slug)
}

// Nilai ambang untuk garis di grafik (null jika tidak ada ambang)
export function ambangParameter(parameter, { normal } = {}) {
  if (parameter === 'hujan') return A.hujanSangatLebat
  if (parameter === 'suhu') return normal != null ? normal + A.suhuDiAtasNormal : null
  if (parameter === 'angin') return A.anginKencangKmj
  if (parameter === 'jarak-pandang') return A.jarakPandangM
  return null
}

export function labelAmbang(parameter) {
  if (parameter === 'hujan') return 'Batas Hujan Sangat Lebat'
  if (parameter === 'suhu') return 'Batas Suhu Ekstrem'
  if (parameter === 'angin') return 'Batas Angin Kencang'
  if (parameter === 'jarak-pandang') return 'Batas Jarak Pandang Ekstrem'
  return null
}

// Tentukan kategori dari nilai (suhu butuh nilai normal setempat)
export function kategoriDari(parameter, nilai, { normal } = {}) {
  if (parameter === 'hujan') {
    return [...PARAMETER.hujan.kategori].reverse().find((k) => nilai >= k.min).label
  }
  if (parameter === 'suhu') return nilai >= normal + A.suhuDiAtasNormal ? 'Suhu Ekstrem' : TIDAK_EKSTREM
  if (parameter === 'angin') return nilai >= A.anginKencangKmj ? 'Angin Kencang' : TIDAK_EKSTREM
  if (parameter === 'jarak-pandang') return nilai < A.jarakPandangM ? 'Jarak Pandang Mendatar Ekstrem' : TIDAK_EKSTREM
  return null
}

export function apakahEkstrem(parameter, kategori) {
  if (!kategori || kategori === TIDAK_EKSTREM) return false
  if (parameter === 'hujan') return kategori !== PARAMETER.hujan.kategori[0].label
  return true
}

// Batas nilai yang menandai jam kejadian suatu kategori (null jika bukan kejadian)
export function batasKejadian(parameter, kategori, { normal } = {}) {
  if (!apakahEkstrem(parameter, kategori)) return null
  if (parameter === 'hujan') {
    return { nilai: PARAMETER.hujan.kategori.find((k) => k.label === kategori).min, arah: 'atas' }
  }
  return { nilai: ambangParameter(parameter, { normal }), arah: parameter === 'jarak-pandang' ? 'bawah' : 'atas' }
}

// Apakah satu nilai per jam termasuk kategori ekstrem (untuk ikon deret jam)
export function nilaiEkstrem(parameter, nilai, { normal } = {}) {
  return apakahEkstrem(parameter, kategoriDari(parameter, nilai, { normal }))
}

function campurWarna(a, b, t) {
  const ke = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [ke(a), ke(b)]
  const hasil = x.map((v, i) => Math.round(v + (y[i] - v) * t))
  return `#${hasil.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// Warna isian peta untuk satu kelurahan
export function warnaRisiko(parameter, data) {
  if (!data) return WARNA_DATA.netral
  const konfig = PARAMETER[parameter]
  if (konfig.skala) {
    const { min, max, warna } = konfig.skala
    const t = Math.min(1, Math.max(0, (data.nilai - min) / (max - min)))
    return campurWarna(warna[0], warna[1], t)
  }
  return konfig.kategori.find((k) => k.label === data.kategori)?.warna ?? WARNA_DATA.netral
}

export function warnaKategori(parameter, kategori) {
  return PARAMETER[parameter].kategori.find((k) => k.label === kategori)?.warna ?? WARNA_DATA.netral
}

// Pilih teks gelap atau putih agar kontras AA di atas warna data
export function teksKontras(hex) {
  const lum = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2]
  return l > 0.2 ? '#14202E' : '#FFFFFF'
}

// Format nilai beserta satuan, mis. "16 mm/jam" atau "0,8 km"
export function formatNilai(parameter, nilai, { denganSatuan = true } = {}) {
  if (nilai == null) return '–'
  if (parameter === 'jarak-pandang') {
    const teks = nilai >= 1000 ? (nilai / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : Math.round(nilai).toString()
    const satuan = nilai >= 1000 ? 'km' : 'm'
    return denganSatuan ? `${teks} ${satuan}` : teks
  }
  const desimal = parameter === 'hujan' || parameter === 'suhu' ? 1 : 0
  const teks = nilai.toLocaleString('id-ID', { maximumFractionDigits: desimal })
  return denganSatuan ? `${teks} ${PARAMETER[parameter].satuan}` : teks
}

export function satuanTampil(parameter, nilai) {
  if (parameter === 'jarak-pandang') return nilai >= 1000 ? 'km' : 'm'
  return PARAMETER[parameter].satuan
}

// Jenis kejadian untuk kartu ringkasan
export const JENIS_KEJADIAN = [
  { kunci: 'hujan_lebat', parameter: 'hujan', label: 'Hujan Lebat ke atas', labelPendek: 'Hujan Lebat+' },
  { kunci: 'angin_kencang', parameter: 'angin', label: 'Angin Kencang', labelPendek: 'Angin Kencang' },
  { kunci: 'suhu_ekstrem', parameter: 'suhu', label: 'Suhu Ekstrem', labelPendek: 'Suhu Ekstrem' },
  { kunci: 'jarak_pandang_ekstrem', parameter: 'jarak-pandang', label: 'Jarak Pandang Ekstrem', labelPendek: 'Jarak Pandang' },
]

// Kejadian yang masuk ringkasan dan pesan peringatan WA (hujan mulai Hujan Lebat)
export function masukPeringatan(parameter, kategori) {
  if (parameter === 'hujan') {
    return PARAMETER.hujan.kategori.some((k) => k.label === kategori && k.min >= A.hujanLebat)
  }
  return apakahEkstrem(parameter, kategori)
}

// Hitung jumlah kelurahan per jenis kejadian dari data risiko
export function hitungKejadian(parameter, risiko) {
  return Object.values(risiko ?? {}).filter((d) => masukPeringatan(parameter, d.kategori)).length
}
