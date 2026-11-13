import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { daftar } from '../api/auth'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import Dialog from '../components/ui/Dialog'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { berandaRole, useAuth } from '../lib/auth'
import { bacaPendaftaran, simpanPendaftaran } from '../lib/pendaftaran'
import { cekPassword, emailValid, normalisasiNoWa, noWaValid, PANJANG_PASSWORD_MIN } from '../lib/validasi'

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

function validasi(isian) {
  const galat = {}
  if (isian.nama.trim().length < 2) galat.nama = 'Nama wajib diisi'
  if (!emailValid(isian.email)) galat.email = 'Masukkan email yang valid'
  if (!noWaValid(normalisasiNoWa(isian.noWa))) galat.noWa = 'Nomor WA diawali 8, contoh 81234567890'
  const galatPassword = cekPassword(isian.password)
  if (galatPassword) galat.password = galatPassword
  if (isian.ulangi !== isian.password) galat.ulangi = 'Password tidak sama'
  if (!isian.setujuSk) galat.setujuSk = 'Wajib disetujui untuk membuat akun'
  if (!isian.setujuWa) galat.setujuWa = 'Akun ini hanya dipakai untuk peringatan WhatsApp'
  return galat
}

// Ringkasan syarat & kebijakan privasi dalam dialog
function DialogKetentuan({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} judul="Syarat & Kebijakan Privasi">
      <ul className="daftar-ketentuan">
        <li>Hasil di situs ini adalah prediksi model, bukan peringatan resmi BMKG.</li>
        <li>Nama, email, dan nomor WhatsApp hanya dipakai untuk akun dan pengiriman peringatan dini.</li>
        <li>Peringatan dikirim pukul 12.00 WIB untuk periode esok hari, untuk maksimal 3 kelurahan pantauan.</li>
        <li>Notifikasi bisa dimatikan dan akun bisa dihapus kapan saja dari halaman Pengaturan.</li>
      </ul>
    </Dialog>
  )
}

// Halaman pendaftaran akun peringatan dini WhatsApp
export default function Daftar() {
  const { pengguna } = useAuth()
  const navigate = useNavigate()
  const [isian, setIsian] = useState(isianAwal)
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState('')
  const [memproses, setMemproses] = useState(false)
  const [ketentuanTerbuka, setKetentuanTerbuka] = useState(false)

  if (pengguna) return <Navigate to={berandaRole(pengguna.role)} replace />

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))
  const centang = (kunci) => (nilai) => setIsian((v) => ({ ...v, [kunci]: nilai }))

  async function kirim(e) {
    e.preventDefault()
    const hasilValidasi = validasi(isian)
    setGalat(hasilValidasi)
    setGalatServer('')
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
      navigate('/verifikasi-otp')
    } catch (err) {
      setGalatServer(err.message)
      setMemproses(false)
    }
  }

  return (
    <KartuAuth
      judul="Daftar Peringatan Dini"
      subjudul="Dapatkan peringatan cuaca ekstrem H-1 lewat WhatsApp untuk hingga 3 kelurahan."
      lebar="lebar"
      kaki={
        <p>
          Sudah punya akun? <Link to="/masuk">Masuk</Link>
        </p>
      }
    >
      {galatServer && <Pesan nada="galat">{galatServer}</Pesan>}

      <form className="auth-form" onSubmit={kirim} noValidate>
        <TextField label="Nama" autoComplete="name" value={isian.nama} onChange={ubah('nama')} galat={galat.nama} />
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
          label="No. WhatsApp"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          awalan="+62"
          placeholder="81234567890"
          value={isian.noWa}
          onChange={ubah('noWa')}
          onBlur={() => setIsian((v) => ({ ...v, noWa: normalisasiNoWa(v.noWa) }))}
          galat={galat.noWa}
          bantuan="Kode OTP akan dikirim ke nomor ini."
        />
        <div className="auth-dua-kolom">
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={isian.password}
            onChange={ubah('password')}
            galat={galat.password}
            bantuan={`Minimal ${PANJANG_PASSWORD_MIN} karakter, huruf dan angka.`}
          />
          <TextField
            label="Ulangi password"
            type="password"
            autoComplete="new-password"
            value={isian.ulangi}
            onChange={ubah('ulangi')}
            galat={galat.ulangi}
          />
        </div>

        <div className="auth-persetujuan">
          <Checkbox checked={isian.setujuSk} onCheckedChange={centang('setujuSk')} galat={galat.setujuSk}>
            Saya setuju dengan{' '}
            <button type="button" className="tautan-teks" onClick={() => setKetentuanTerbuka(true)}>
              Syarat & Kebijakan Privasi
            </button>
          </Checkbox>
          <Checkbox checked={isian.setujuWa} onCheckedChange={centang('setujuWa')} galat={galat.setujuWa}>
            Saya bersedia menerima pesan peringatan dini lewat WhatsApp
          </Checkbox>
        </div>

        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? 'Memproses…' : 'Daftar & Kirim OTP'}
        </Button>
      </form>

      <DialogKetentuan open={ketentuanTerbuka} onOpenChange={setKetentuanTerbuka} />
    </KartuAuth>
  )
}
