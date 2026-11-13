import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import BantuanMock from '../components/BantuanMock'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { berandaRole, useAuth } from '../lib/auth'
import { emailValid } from '../lib/validasi'

function validasi({ email, password }) {
  const galat = {}
  if (!emailValid(email)) galat.email = 'Masukkan email yang valid'
  if (!password) galat.password = 'Password wajib diisi'
  return galat
}

// Halaman masuk; diarahkan ke halaman sesuai role setelah berhasil
export default function Masuk() {
  const { pengguna, pesanKeluar, masuk } = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()
  const [isian, setIsian] = useState({ email: '', password: '' })
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState('')
  const [memproses, setMemproses] = useState(false)

  // Pengguna yang sudah login tidak perlu melihat halaman ini
  if (pengguna && !memproses) return <Navigate to={berandaRole(pengguna.role)} replace />

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))

  async function kirim(e) {
    e.preventDefault()
    const hasilValidasi = validasi(isian)
    setGalat(hasilValidasi)
    setGalatServer('')
    if (Object.keys(hasilValidasi).length) return
    setMemproses(true)
    try {
      const akun = await masuk(isian.email, isian.password)
      const dari = lokasi.state?.dari
      const bolehKembali = dari && (akun.role === 'admin' ? dari.startsWith('/admin') : !dari.startsWith('/admin'))
      navigate(bolehKembali ? dari : berandaRole(akun.role), { replace: true })
    } catch (err) {
      setGalatServer(err.message)
      setMemproses(false)
    }
  }

  return (
    <KartuAuth
      judul="Masuk"
      subjudul="Pemetaan Cuaca Ekstrem Surabaya"
      kaki={
        <p>
          Belum punya akun? <Link to="/daftar">Daftar</Link>
        </p>
      }
    >
      {(pesanKeluar || lokasi.state?.pesan) && <Pesan>{pesanKeluar || lokasi.state?.pesan}</Pesan>}
      {galatServer && <Pesan nada="galat">{galatServer}</Pesan>}

      <form className="auth-form" onSubmit={kirim} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          value={isian.email}
          onChange={ubah('email')}
          galat={galat.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={isian.password}
          onChange={ubah('password')}
          galat={galat.password}
        />
        <Link to="/lupa-password" className="auth-tautan-kanan">
          Lupa password?
        </Link>
        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>

      <BantuanMock jenis="akun" />
    </KartuAuth>
  )
}
