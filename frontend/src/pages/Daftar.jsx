import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router'
import { daftar } from '../api/auth'
import JudulHalaman from '../components/JudulHalaman'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import Dialog from '../components/ui/Dialog'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { berandaRole, useAuth } from '../lib/auth'
import { teksGalat } from '../lib/galat'
import { bacaPendaftaran, simpanPendaftaran } from '../lib/pendaftaran'
import { cekPassword, emailValid, normalisasiNoWa, noWaValid, PANJANG_PASSWORD_MIN } from '../lib/validasi'

const POIN_KETENTUAN = ['prediksi', 'data', 'jadwal', 'kendali']

function isianAwal() {
  const tersimpan = bacaPendaftaran()
  return {
    nama: tersimpan?.nama ?? '',
    email: tersimpan?.email ?? '',
    noWa: tersimpan?.no_wa?.replace(/^\+62/, '') ?? '',
    password: '',
    ulangi: '',
    setujuSk: false,
    setujuWa: false,
  }
}

// Validasi isian; nilai berupa kunci kamus agar ikut berganti bahasa
function validasi(isian) {
  const galat = {}
  if (isian.nama.trim().length < 2) galat.nama = 'validasi.namaWajib'
  if (!emailValid(isian.email)) galat.email = 'validasi.emailTidakValid'
  if (!noWaValid(normalisasiNoWa(isian.noWa))) galat.noWa = 'validasi.noWa'
  const galatPassword = cekPassword(isian.password)
  if (galatPassword) galat.password = `validasi.${galatPassword}`
  if (isian.ulangi !== isian.password) galat.ulangi = 'validasi.passwordTidakSama'
  if (!isian.setujuSk) galat.setujuSk = 'validasi.setujuSk'
  if (!isian.setujuWa) galat.setujuWa = 'validasi.setujuWa'
  return galat
}

// Ringkasan syarat & kebijakan privasi dalam dialog
function DialogKetentuan({ open, onOpenChange }) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange} judul={t('auth.daftar.ketentuan.judul')}>
      <ul className="daftar-ketentuan">
        {POIN_KETENTUAN.map((kunci) => (
          <li key={kunci}>{t(`auth.daftar.ketentuan.${kunci}`)}</li>
        ))}
      </ul>
    </Dialog>
  )
}

// Halaman pendaftaran akun peringatan dini WhatsApp
export default function Daftar() {
  const { t } = useTranslation()
  const { pengguna } = useAuth()
  const navigate = useNavigate()
  const [isian, setIsian] = useState(isianAwal)
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState(null)
  const [memproses, setMemproses] = useState(false)
  const [ketentuanTerbuka, setKetentuanTerbuka] = useState(false)

  if (pengguna) return <Navigate to={berandaRole(pengguna.role)} replace />

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))
  const centang = (kunci) => (nilai) => setIsian((v) => ({ ...v, [kunci]: nilai }))
  const pesan = (kunci) => galat[kunci] && t(galat[kunci], { n: PANJANG_PASSWORD_MIN })

  async function kirim(e) {
    e.preventDefault()
    const hasilValidasi = validasi(isian)
    setGalat(hasilValidasi)
    setGalatServer(null)
    if (Object.keys(hasilValidasi).length) return
    setMemproses(true)
    const data = {
      nama: isian.nama.trim(),
      email: isian.email.trim().toLowerCase(),
      no_wa: `+62${normalisasiNoWa(isian.noWa)}`,
    }
    try {
      await daftar({ ...data, password: isian.password, setuju_wa: true })
      simpanPendaftaran(data)
      navigate('/verify-otp')
    } catch (err) {
      setGalatServer(err)
      setMemproses(false)
    }
  }

  return (
    <KartuAuth
      judul={t('auth.daftar.judul')}
      subjudul={t('auth.daftar.subjudul')}
      lebar="lebar"
      kaki={
        <p>
          {t('auth.daftar.sudahPunyaAkun')} <Link to="/login">{t('umum.nav.masuk')}</Link>
        </p>
      }
    >
      <JudulHalaman judul={t('auth.daftar.judul')} />
      {galatServer && <Pesan nada="galat">{teksGalat(t, galatServer)}</Pesan>}

      <p className="teks-sekunder auth-wajib">{t('auth.daftar.semuaWajib')}</p>
      <form className="auth-form" onSubmit={kirim} noValidate>
        <TextField label={t('auth.daftar.nama')} required autoComplete="name" value={isian.nama} onChange={ubah('nama')} galat={pesan('nama')} />
        <TextField
          label={t('auth.email')}
          required
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          value={isian.email}
          onChange={ubah('email')}
          galat={pesan('email')}
        />
        <TextField
          label={t('auth.daftar.noWa')}
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          awalan="+62"
          placeholder="81234567890"
          value={isian.noWa}
          onChange={ubah('noWa')}
          onBlur={() => setIsian((v) => ({ ...v, noWa: normalisasiNoWa(v.noWa) }))}
          galat={pesan('noWa')}
          bantuan={t('auth.daftar.noWaBantuan')}
        />
        <div className="auth-dua-kolom">
          <TextField
            label={t('auth.password')}
            required
            type="password"
            autoComplete="new-password"
            value={isian.password}
            onChange={ubah('password')}
            galat={pesan('password')}
            bantuan={t('auth.passwordBantuan', { n: PANJANG_PASSWORD_MIN })}
          />
          <TextField
            label={t('auth.ulangiPassword')}
            required
            type="password"
            autoComplete="new-password"
            value={isian.ulangi}
            onChange={ubah('ulangi')}
            galat={pesan('ulangi')}
          />
        </div>

        <div className="auth-persetujuan">
          <Checkbox wajib checked={isian.setujuSk} onCheckedChange={centang('setujuSk')} galat={pesan('setujuSk')}>
            {t('auth.daftar.setujuSk')}{' '}
            <button type="button" className="tautan-teks" onClick={() => setKetentuanTerbuka(true)}>
              {t('auth.daftar.ketentuan.judul')}
            </button>
          </Checkbox>
          <Checkbox wajib checked={isian.setujuWa} onCheckedChange={centang('setujuWa')} galat={pesan('setujuWa')}>
            {t('auth.daftar.setujuWa')}
          </Checkbox>
        </div>

        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? t('umum.memproses') : t('auth.daftar.tombol')}
        </Button>
      </form>

      <DialogKetentuan open={ketentuanTerbuka} onOpenChange={setKetentuanTerbuka} />
    </KartuAuth>
  )
}
