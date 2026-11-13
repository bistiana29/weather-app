const ZONA = 'Asia/Jakarta'
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export { HARI_PENDEK, BULAN }

// Tanggal hari ini menurut WIB dalam format YYYY-MM-DD
export function hariIniWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

export function keDate(iso) {
  const [t, b, h] = iso.split('-').map(Number)
  return new Date(t, b - 1, h)
}

export function keIso(date) {
  const b = String(date.getMonth() + 1).padStart(2, '0')
  const h = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${b}-${h}`
}

export function tambahHari(iso, n) {
  const d = keDate(iso)
  d.setDate(d.getDate() + n)
  return keIso(d)
}

export function isoValid(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && keIso(keDate(iso)) === iso
}

// "Jumat, 14 Nov 2026"
export function formatPanjang(iso) {
  const d = keDate(iso)
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

// "14/11/2026"
export function formatAngka(iso) {
  const [t, b, h] = iso.split('-')
  return `${h}/${b}/${t}`
}

// "14 Nov"
export function formatRingkas(iso) {
  const d = keDate(iso)
  return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`
}

export function namaHariPendek(iso) {
  return HARI_PENDEK[keDate(iso).getDay()]
}

const FORMAT_WAKTU = new Intl.DateTimeFormat('id-ID', {
  timeZone: ZONA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// "13 Nov 2026 09.41 WIB" dari timestamp ISO berzona
export function formatWaktuWib(iso) {
  if (!iso) return '–'
  return `${FORMAT_WAKTU.format(new Date(iso)).replace(',', '')} WIB`
}

// Durasi singkat antara dua timestamp, mis. "3 mnt 12 dtk"
export function formatDurasi(mulai, selesai) {
  if (!mulai || !selesai) return '–'
  const detik = Math.round((new Date(selesai) - new Date(mulai)) / 1000)
  if (detik < 60) return `${detik} dtk`
  const menit = Math.floor(detik / 60)
  if (menit < 60) return `${menit} mnt ${detik % 60} dtk`
  return `${Math.floor(menit / 60)} jam ${menit % 60} mnt`
}
