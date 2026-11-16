import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { masuk as apiMasuk } from '../../api/auth'
import { berandaRole, useAuth } from '../../lib/auth'
import { teksGalat } from '../../lib/galat'
import { emailValid } from '../../lib/validasi'
import BantuanMock from '../BantuanMock'
import Button from '../ui/Button'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'

// Validasi isian; nilai berupa kunci kamus agar ikut berganti bahasa
function validasi({ email, password }) {
  const galat = {}
  if (!emailValid(email)) galat.email = 'validasi.emailTidakValid'
  if (!password) galat.password = 'validasi.passwordWajib'
  return galat
}

// Form masuk untuk satu role; akun dengan role lain ditolak sebelum sesi disimpan
export default function FormMasuk({ role, tampilLupa = false }) {
  const { t } = useTranslation()
  const { pengguna, pesanKeluar, mulaiSesi } = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()
  const [isian, setIsian] = useState({ email: '', password: '' })
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState(null)
  const [memproses, setMemproses] = useState(false)

  // Pengguna yang sudah login langsung diarahkan ke halamannya
  if (pengguna && !memproses) return <Navigate to={berandaRole(pengguna.role)} replace />

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))

  async function kirim(e) {
    e.preventDefault()
    const hasilValidasi = validasi(isian)
    setGalat(hasilValidasi)
    setGalatServer(null)
    if (Object.keys(hasilValidasi).length) return
    setMemproses(true)
    try {
      const sesi = await apiMasuk(isian.email, isian.password)
      if (sesi.pengguna.role !== role) {
        setGalatServer({ kode: 'roleDitolak' })
        setMemproses(false)
        return
      }
      mulaiSesi(sesi)
      const dari = lokasi.state?.dari
      const bolehKembali = dari && (role === 'admin' ? dari.startsWith('/admin') : !dari.startsWith('/admin'))
      navigate(bolehKembali ? dari : berandaRole(role), { replace: true })
    } catch (err) {
      setGalatServer(err)
      setMemproses(false)
    }
  }

  const pesanInfo = pesanKeluar || lokasi.state?.pesan

  return (
    <>
      {pesanInfo && <Pesan>{t(pesanInfo)}</Pesan>}
      {galatServer && <Pesan nada="galat">{teksGalat(t, galatServer)}</Pesan>}

      <form className="auth-form" onSubmit={kirim} noValidate>
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={isian.email}
          onChange={ubah('email')}
          galat={galat.email && t(galat.email)}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={isian.password}
          onChange={ubah('password')}
          galat={galat.password && t(galat.password)}
        />
        {tampilLupa && (
          <Link to="/forgot-password" className="auth-tautan-kanan">
            {t('auth.login.lupa')}
          </Link>
        )}
        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? t('umum.memproses') : t('auth.login.tombol')}
        </Button>
      </form>

      <BantuanMock jenis={role === 'admin' ? 'akun-admin' : 'akun-user'} />
    </>
  )
}
