import { Link } from 'react-router'
import FormMasuk from '../components/auth/FormMasuk'
import JudulHalaman from '../components/JudulHalaman'
import KartuAuth from '../components/layout/KartuAuth'

// Halaman masuk pengguna umum (akun peringatan WhatsApp)
export default function Login() {
  return (
    <KartuAuth
      judul="Masuk"
      subjudul="Kelola peringatan WhatsApp dan kelurahan pantauan Anda."
      kaki={
        <p>
          Belum punya akun? <Link to="/daftar">Daftar</Link>
        </p>
      }
    >
      <JudulHalaman judul="Masuk" />
      <FormMasuk role="user" tampilLupa />
    </KartuAuth>
  )
}
