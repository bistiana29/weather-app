import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { kirimUlangOtp, verifikasiOtp } from '../api/auth'
import BantuanMock from '../components/BantuanMock'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import OtpInput from '../components/ui/OtpInput'
import Pesan from '../components/ui/Pesan'
import { useAuth } from '../lib/auth'
import { teksGalat } from '../lib/galat'
import { bacaPendaftaran, hapusPendaftaran } from '../lib/pendaftaran'
import { samarkanNoWa } from '../lib/validasi'
import JudulHalaman from '../components/JudulHalaman'

const JEDA_KIRIM_ULANG = 60
const PANJANG_OTP = 6

function formatHitungMundur(detik) {
  return `${String(Math.floor(detik / 60)).padStart(2, '0')}:${String(detik % 60).padStart(2, '0')}`
}

// Halaman verifikasi nomor WA dengan 6 digit OTP; sukses langsung login ke Pengaturan
export default function VerifikasiOtp() {
  const { t } = useTranslation()
  const { mulaiSesi } = useAuth()
  const navigate = useNavigate()
  const [pendaftaran] = useState(bacaPendaftaran)
  const [kode, setKode] = useState('')
  const [sisa, setSisa] = useState(JEDA_KIRIM_ULANG)
  const [galat, setGalat] = useState(null)
  const [info, setInfo] = useState(false)
  const [memproses, setMemproses] = useState(false)

  // Hitung mundur sebelum boleh kirim ulang kode
  useEffect(() => {
    if (sisa <= 0) return
    const timer = setTimeout(() => setSisa((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [sisa])

  if (!pendaftaran) return <Navigate to="/register" replace />

  async function verifikasi(e) {
    e.preventDefault()
    setGalat(null)
    setInfo(false)
    setMemproses(true)
    try {
      const sesi = await verifikasiOtp(pendaftaran.no_wa, kode, pendaftaran)
      hapusPendaftaran()
      mulaiSesi(sesi)
      navigate('/settings', { replace: true })
    } catch (err) {
      setGalat(err)
      setKode('')
      setMemproses(false)
    }
  }

  async function kirimUlang() {
    setGalat(null)
    await kirimUlangOtp(pendaftaran.no_wa)
    setInfo(true)
    setSisa(JEDA_KIRIM_ULANG)
  }

  return (
    <KartuAuth
      judul={t('auth.otp.judul')}
      subjudul={
        <Trans
          i18nKey="auth.otp.subjudul"
          values={{ nomor: samarkanNoWa(pendaftaran.no_wa) }}
          components={{ utuh: <span className="auth-nomor" /> }}
        />
      }
    >
      <JudulHalaman judul={t('auth.otp.judul')} />
      {galat && <Pesan nada="galat">{teksGalat(t, galat)}</Pesan>}
      {info && <Pesan>{t('auth.otp.terkirimUlang')}</Pesan>}

      <form className="auth-form auth-otp" onSubmit={verifikasi} noValidate>
        <OtpInput value={kode} onChange={setKode} panjang={PANJANG_OTP} disabled={memproses} />

        <p className="teks-sekunder auth-hitung" aria-live="polite">
          {sisa > 0 ? (
            <Trans i18nKey="auth.otp.hitungMundur" values={{ waktu: formatHitungMundur(sisa) }} components={{ tebal: <strong /> }} />
          ) : (
            <button type="button" className="tautan-teks" onClick={kirimUlang}>
              {t('auth.otp.kirimUlang')}
            </button>
          )}
        </p>

        <Button type="submit" ukuran="besar" disabled={memproses || kode.length < PANJANG_OTP} className="auth-tombol">
          {memproses ? t('auth.otp.memverifikasi') : t('auth.otp.tombol')}
        </Button>
      </form>

      <p className="auth-ubah">
        {t('auth.otp.nomorSalah')}{' '}
        <button type="button" className="tautan-teks" onClick={() => navigate('/register')}>
          {t('auth.otp.ubahNomor')}
        </button>
      </p>

      <BantuanMock jenis="otp" />
    </KartuAuth>
  )
}
