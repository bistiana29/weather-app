import { AKUN_CONTOH } from '../mocks/akun'
import { PENGATURAN_AWAL_CONTOH } from '../mocks/pengguna'
import { KUNCI_SESI, PAKAI_MOCK, request, tolakMock, tundaMock } from './client'

export const MAKS_KELURAHAN_PANTAUAN = 3
const KUNCI_MOCK = 'pce-mock-pengaturan'

function bacaMock() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_MOCK)) ?? PENGATURAN_AWAL_CONTOH
  } catch {
    return PENGATURAN_AWAL_CONTOH
  }
}

function tulisMock(data) {
  try {
    if (data) localStorage.setItem(KUNCI_MOCK, JSON.stringify(data))
    else localStorage.removeItem(KUNCI_MOCK)
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
}

function akunSesi() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_SESI))?.pengguna ?? {}
  } catch {
    return {}
  }
}

// Pengaturan notifikasi, kelurahan pantauan, dan info akun milik pengguna login
export function getPengaturan() {
  if (!PAKAI_MOCK) return request('/pengguna/pengaturan')
  const { nama, email, no_wa } = akunSesi()
  return tundaMock({ ...bacaMock(), akun: { nama, email, no_wa } })
}

export function simpanPengaturan({ notif_wa, kelurahan }) {
  if (kelurahan.length > MAKS_KELURAHAN_PANTAUAN) {
    return Promise.reject(new Error(`Maksimal ${MAKS_KELURAHAN_PANTAUAN} kelurahan pantauan`))
  }
  if (!PAKAI_MOCK) return request('/pengguna/pengaturan', { method: 'PUT', body: { notif_wa, kelurahan } })
  tulisMock({ notif_wa, kelurahan })
  return tundaMock({ notif_wa, kelurahan })
}

export function ubahPassword(passwordLama, passwordBaru) {
  if (!PAKAI_MOCK) {
    return request('/pengguna/password', { method: 'PUT', body: { password_lama: passwordLama, password_baru: passwordBaru } })
  }
  if (passwordLama !== AKUN_CONTOH[0].password) return tolakMock('Password lama salah', 400)
  return tundaMock({ berhasil: true })
}

export function hapusAkun() {
  if (!PAKAI_MOCK) return request('/pengguna', { method: 'DELETE' })
  tulisMock(null)
  return tundaMock(null)
}
