import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { lupaPassword } from '../api/auth'
import BantuanMock from '../components/BantuanMock'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { teksGalat } from '../lib/galat'
import { emailValid } from '../lib/validasi'
import JudulHalaman from '../components/JudulHalaman'

// Halaman minta tautan reset; pesan sukses dibuat samar agar tidak membocorkan email terdaftar
export default function LupaPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [galat, setGalat] = useState('')
  const [galatServer, setGalatServer] = useState(null)
  const [terkirim, setTerkirim] = useState(false)
  const [memproses, setMemproses] = useState(false)

  async function kirim(e) {
    e.preventDefault()
    setGalatServer(null)
    if (!emailValid(email)) {
      setGalat('validasi.emailTidakValid')
      return
    }
    setGalat('')
    setMemproses(true)
    try {
      await lupaPassword(email.trim().toLowerCase())
      setTerkirim(true)
    } catch (err) {
      setGalatServer(err)
    } finally {
      setMemproses(false)
    }
  }

  return (
    <KartuAuth
      judul={t('auth.lupa.judul')}
      subjudul={t('auth.lupa.subjudul')}
      kaki={
        <p>
          {t('auth.lupa.ingat')} <Link to="/login">{t('umum.nav.masuk')}</Link>
        </p>
      }
    >
      <JudulHalaman judul={t('auth.lupa.judul')} />
      {galatServer && <Pesan nada="galat">{teksGalat(t, galatServer)}</Pesan>}

      {terkirim ? (
        <>
          <Pesan>{t('auth.lupa.terkirim')}</Pesan>
          <Button variant="sekunder" onClick={() => setTerkirim(false)}>
            {t('auth.lupa.emailLain')}
          </Button>
          <BantuanMock jenis="reset" />
        </>
      ) : (
        <form className="auth-form" onSubmit={kirim} noValidate>
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            galat={galat && t(galat)}
          />
          <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
            {memproses ? t('auth.lupa.mengirim') : t('auth.lupa.tombol')}
          </Button>
        </form>
      )}
    </KartuAuth>
  )
}
