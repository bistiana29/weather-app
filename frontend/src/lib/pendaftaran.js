const KUNCI = 'pce-pendaftaran'

// Data pendaftaran yang menunggu verifikasi OTP (tanpa password) disimpan per tab
export function simpanPendaftaran(data) {
  try {
    sessionStorage.setItem(KUNCI, JSON.stringify(data))
  } catch {
    // Abaikan jika sessionStorage tidak tersedia
  }
}

export function bacaPendaftaran() {
  try {
    return JSON.parse(sessionStorage.getItem(KUNCI))
  } catch {
    return null
  }
}

export function hapusPendaftaran() {
  try {
    sessionStorage.removeItem(KUNCI)
  } catch {
    // Abaikan jika sessionStorage tidak tersedia
  }
}
