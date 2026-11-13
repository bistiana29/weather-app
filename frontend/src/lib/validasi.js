export const PANJANG_PASSWORD_MIN = 8

export function emailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// Ubah masukan nomor WA (08…, 62…, +62…, 8…) menjadi digit setelah +62
export function normalisasiNoWa(masukan) {
  const digit = masukan.replace(/\D/g, '')
  if (digit.startsWith('62')) return digit.slice(2)
  if (digit.startsWith('0')) return digit.slice(1)
  return digit
}

// Nomor seluler Indonesia: diawali 8, total 9–12 digit setelah +62
export function noWaValid(digitSetelah62) {
  return /^8\d{8,11}$/.test(digitSetelah62)
}

// "+62 812-****-**90"
export function samarkanNoWa(noWa) {
  const digit = noWa.replace(/^\+62/, '')
  return `+62 ${digit.slice(0, 3)}-****-**${digit.slice(-2)}`
}

// Pesan galat password, atau null jika valid
export function cekPassword(password) {
  if (password.length < PANJANG_PASSWORD_MIN) return `Minimal ${PANJANG_PASSWORD_MIN} karakter`
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Gunakan kombinasi huruf dan angka'
  return null
}
