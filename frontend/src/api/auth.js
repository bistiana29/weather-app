import { AKUN_CONTOH, OTP_CONTOH, TOKEN_KEDALUWARSA } from '../mocks/akun'
import { PAKAI_MOCK, request, tolakMock, tundaMock } from './client'

const cariAkun = (email) => AKUN_CONTOH.find((a) => a.email === email.trim().toLowerCase())

// Masuk dengan email dan password, kembalikan token dan data pengguna
export function masuk(email, password) {
  if (!PAKAI_MOCK) return request('/auth/masuk', { method: 'POST', body: { email, password } })
  const akun = cariAkun(email)
  if (!akun || akun.password !== password) return tolakMock('Email atau password salah', 401)
  return tundaMock({ token: `mock-${akun.pengguna.id}`, pengguna: akun.pengguna })
}

// Daftar akun baru lalu kirim OTP ke nomor WA
export function daftar(data) {
  if (!PAKAI_MOCK) return request('/auth/daftar', { method: 'POST', body: data })
  if (cariAkun(data.email)) return tolakMock('Email sudah terdaftar', 409)
  return tundaMock({ no_wa: data.no_wa, berlaku_detik: 300 })
}

// Verifikasi OTP; sukses mengembalikan sesi login
export function verifikasiOtp(noWa, kode, data) {
  if (!PAKAI_MOCK) return request('/auth/verifikasi-otp', { method: 'POST', body: { no_wa: noWa, kode } })
  if (kode !== OTP_CONTOH) return tolakMock('Kode OTP salah atau sudah kedaluwarsa', 400)
  const pengguna = { id: 'u-contoh-baru', nama: data.nama, email: data.email, no_wa: noWa, role: 'user' }
  return tundaMock({ token: 'mock-u-contoh-baru', pengguna })
}

export function kirimUlangOtp(noWa) {
  if (!PAKAI_MOCK) return request('/auth/kirim-ulang-otp', { method: 'POST', body: { no_wa: noWa } })
  return tundaMock({ no_wa: noWa })
}

// Selalu sukses agar tidak membocorkan email mana yang terdaftar
export function lupaPassword(email) {
  if (!PAKAI_MOCK) return request('/auth/lupa-password', { method: 'POST', body: { email } })
  return tundaMock({ terkirim: true })
}

export function resetPassword(token, password) {
  if (!PAKAI_MOCK) return request('/auth/reset-password', { method: 'POST', body: { token, password } })
  if (token === TOKEN_KEDALUWARSA) return tolakMock('Tautan reset sudah kedaluwarsa', 410)
  return tundaMock({ berhasil: true })
}
