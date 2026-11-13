import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { kirimUlangOtp, verifikasiOtp } from '../api/auth'
import BantuanMock from '../components/BantuanMock'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import OtpInput from '../components/ui/OtpInput'
import Pesan from '../components/ui/Pesan'
import { useAuth } from '../lib/auth'
import { bacaPendaftaran, hapusPendaftaran } from '../lib/pendaftaran'
import { samarkanNoWa } from '../lib/validasi'

const JEDA_KIRIM_ULANG = 60
const PANJANG_OTP = 6

function formatHitungMundur(detik) {
  return `${String(Math.floor(detik / 60)).padStart(2, '0')}:${String(detik % 60).padStart(2, '0')}`
}

// Halaman verifikasi nomor WA dengan 6 digit OTP; sukses langsung login ke Pengaturan
export default function VerifikasiOtp() {
  const { mulaiSesi } = useAuth()
  const navigate = useNavigate()
  const [pendaftaran] = useState(bacaPendaftaran)
  const [kode, setKode] = useState('')
  const [sisa, setSisa] = useState(JEDA_KIRIM_ULANG)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [memproses, setMemproses] = useState(false)

  // Hitung mundur sebelum boleh kirim ulang kode
  useEffect(() => {
    if (sisa <= 0) return
    const timer = setTimeout(() => setSisa((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [sisa])

  if (!pendaftaran) return <Navigate to="/daftar" replace />

  async function verifikasi(e) {
    e.preventDefault()
    setGalat('')
    setInfo('')
    setMemproses(true)
    try {
      const sesi = await verifikasiOtp(pendaftaran.no_wa, kode, pendaftaran)
      hapusPendaftaran()
      mulaiSesi(sesi)
      navigate('/pengaturan', { replace: true })
    } catch (err) {
      setGalat(err.message)
      setKode('')
      setMemproses(false)
    }
  }

  async function kirimUlang() {
    setGalat('')
    await kirimUlangOtp(pendaftaran.no_wa)
    setInfo('Kode baru sudah dikirim.')
    setSisa(JEDA_KIRIM_ULANG)
  }

  return (
    <KartuAuth judul="Verifikasi Nomor WA" subjudul={`Kode 6 digit dikirim lewat WhatsApp ke ${samarkanNoWa(pendaftaran.no_wa)}`}>
      {galat && <Pesan nada="galat">{galat}</Pesan>}
      {info && <Pesan>{info}</Pesan>}

      <form className="auth-form auth-otp" onSubmit={verifikasi} noValidate>
        <OtpInput value={kode} onChange={setKode} panjang={PANJANG_OTP} disabled={memproses} />

        <p className="teks-sekunder auth-hitung" aria-live="polite">
          {sisa > 0 ? (
            <>Kirim ulang dalam <strong>{formatHitungMundur(sisa)}</strong></>
          ) : (
            <button type="button" className="tautan-teks" onClick={kirimUlang}>
              Kirim ulang kode
            </button>
          )}
        </p>

        <Button type="submit" ukuran="besar" disabled={memproses || kode.length < PANJANG_OTP} className="auth-tombol">
          {memproses ? 'Memverifikasi…' : 'Verifikasi'}
        </Button>
      </form>

      <p className="auth-ubah">
        Nomor salah?{' '}
        <button type="button" className="tautan-teks" onClick={() => navigate('/daftar')}>
          Ubah nomor
        </button>
      </p>

      <BantuanMock jenis="otp" />
    </KartuAuth>
  )
}
