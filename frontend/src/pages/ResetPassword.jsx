import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { resetPassword } from '../api/auth'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { teksGalat } from '../lib/galat'
import { cekPassword, PANJANG_PASSWORD_MIN } from '../lib/validasi'
import JudulHalaman from '../components/JudulHalaman'

// Halaman atur password baru dari tautan email (?token=)
export default function ResetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [isian, setIsian] = useState({ password: '', ulangi: '' })
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState(null)
  const [memproses, setMemproses] = useState(false)

  if (!token) {
    return (
      <KartuAuth judul={t('auth.reset.tidakValidJudul')} subjudul={t('auth.reset.tidakValidSubjudul')}>
        <JudulHalaman judul={t('auth.reset.tidakValidJudul')} />
        <Button as={Link} to="/forgot-password" ukuran="besar">
          {t('auth.reset.mintaBaru')}
        </Button>
      </KartuAuth>
    )
  }

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))

  async function kirim(e) {
    e.preventDefault()
    const hasil = {}
    const galatPassword = cekPassword(isian.password)
    if (galatPassword) hasil.password = `validasi.${galatPassword}`
    if (isian.ulangi !== isian.password) hasil.ulangi = 'validasi.passwordTidakSama'
    setGalat(hasil)
    setGalatServer(null)
    if (Object.keys(hasil).length) return
    setMemproses(true)
    try {
      await resetPassword(token, isian.password)
      navigate('/login', { replace: true, state: { pesan: 'auth.pesan.passwordDiubah' } })
    } catch (err) {
      setGalatServer(err)
      setMemproses(false)
    }
  }

  return (
    <KartuAuth judul={t('auth.reset.judul')} subjudul={t('auth.reset.subjudul')}>
      <JudulHalaman judul={t('auth.reset.judul')} />
      {galatServer && (
        <Pesan nada="galat">
          {teksGalat(t, galatServer)} <Link to="/forgot-password">{t('auth.reset.mintaBaru')}</Link>
        </Pesan>
      )}
      <form className="auth-form" onSubmit={kirim} noValidate>
        <TextField
          label={t('auth.reset.passwordBaru')}
          type="password"
          autoComplete="new-password"
          value={isian.password}
          onChange={ubah('password')}
          galat={galat.password && t(galat.password, { n: PANJANG_PASSWORD_MIN })}
          bantuan={t('auth.passwordBantuan', { n: PANJANG_PASSWORD_MIN })}
        />
        <TextField
          label={t('auth.ulangiPassword')}
          type="password"
          autoComplete="new-password"
          value={isian.ulangi}
          onChange={ubah('ulangi')}
          galat={galat.ulangi && t(galat.ulangi)}
        />
        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? t('auth.reset.menyimpan') : t('umum.simpan')}
        </Button>
      </form>
    </KartuAuth>
  )
}
