import { useQueryClient } from '@tanstack/react-query'
import { createContext, createElement, use, useState } from 'react'
import { masuk as apiMasuk } from '../api/auth'
import { KUNCI_SESI } from '../api/client'

const AuthContext = createContext(null)

function bacaSesi() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_SESI))
  } catch {
    return null
  }
}

function tulisSesi(sesi) {
  try {
    if (sesi) localStorage.setItem(KUNCI_SESI, JSON.stringify(sesi))
    else localStorage.removeItem(KUNCI_SESI)
  } catch {
    // localStorage tidak tersedia, sesi hanya bertahan di memori
  }
}

// Penyedia status login untuk seluruh aplikasi
export function AuthProvider({ children }) {
  const [sesi, setSesi] = useState(bacaSesi)
  const [pesanKeluar, setPesanKeluar] = useState('')
  const queryClient = useQueryClient()

  // Simpan sesi dari login atau verifikasi OTP
  function mulaiSesi(hasil) {
    setPesanKeluar('')
    tulisSesi(hasil)
    setSesi(hasil)
    return hasil.pengguna
  }

  async function masuk(email, password) {
    return mulaiSesi(await apiMasuk(email, password))
  }

  // Keluar; pesan opsional ditampilkan di halaman Masuk berikutnya
  function keluar(pesan = '') {
    // Buang data milik pengguna agar tidak terlihat oleh akun berikutnya
    queryClient.removeQueries({ queryKey: ['pengaturan'] })
    tulisSesi(null)
    setSesi(null)
    setPesanKeluar(pesan)
  }

  const nilai = { pengguna: sesi?.pengguna ?? null, pesanKeluar, masuk, mulaiSesi, keluar }
  return createElement(AuthContext, { value: nilai }, children)
}

export function useAuth() {
  return use(AuthContext)
}

// Halaman awal setelah login sesuai role
export function berandaRole(role) {
  return role === 'admin' ? '/admin' : '/pengaturan'
}
