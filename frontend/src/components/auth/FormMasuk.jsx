import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { masuk as apiMasuk } from '../../api/auth'
import { berandaRole, useAuth } from '../../lib/auth'
import { emailValid } from '../../lib/validasi'
import BantuanMock from '../BantuanMock'
import Button from '../ui/Button'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'

const PESAN_DITOLAK = 'Akun ini tidak bisa masuk di sini.'

function validasi({ email, password }) {
  const galat = {}
  if (!emailValid(email)) galat.email = 'Masukkan email yang valid'
  if (!password) galat.password = 'Password wajib diisi'
  return galat
}

// Form masuk untuk satu role; akun dengan role lain ditolak sebelum sesi disimpan
export default function FormMasuk({ role, tampilLupa = false }) {
  const { pengguna, pesanKeluar, mulaiSesi } = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()
  const [isian, setIsian] = useState({ email: '', password: '' })
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState('')
  const [memproses, setMemproses] = useState(false)

  // Pengguna yang sudah login langsung diarahkan ke halamannya
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
      const sesi = await apiMasuk(isian.email, isian.password)
      if (sesi.pengguna.role !== role) {
        setGalatServer(PESAN_DITOLAK)
        setMemproses(false)
        return
      }
      mulaiSesi(sesi)
      const dari = lokasi.state?.dari
      const bolehKembali = dari && (role === 'admin' ? dari.startsWith('/admin') : !dari.startsWith('/admin'))
      navigate(bolehKembali ? dari : berandaRole(role), { replace: true })
    } catch (err) {
      setGalatServer(err.message)
      setMemproses(false)
    }
  }

  const pesanInfo = pesanKeluar || lokasi.state?.pesan

  return (
    <>
      {pesanInfo && <Pesan>{pesanInfo}</Pesan>}
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
        {tampilLupa && (
          <Link to="/lupa-password" className="auth-tautan-kanan">
            Lupa password?
          </Link>
        )}
        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>

      <BantuanMock jenis={role === 'admin' ? 'akun-admin' : 'akun-user'} />
    </>
  )
}
