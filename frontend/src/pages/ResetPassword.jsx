import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { resetPassword } from '../api/auth'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { cekPassword, PANJANG_PASSWORD_MIN } from '../lib/validasi'

// Halaman atur password baru dari tautan email (?token=)
export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [isian, setIsian] = useState({ password: '', ulangi: '' })
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState('')
  const [memproses, setMemproses] = useState(false)

  if (!token) {
    return (
      <KartuAuth judul="Tautan tidak valid" subjudul="Tautan reset tidak lengkap atau sudah tidak berlaku.">
        <Button as={Link} to="/lupa-password" ukuran="besar">
          Minta tautan baru
        </Button>
      </KartuAuth>
    )
  }

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))

  async function kirim(e) {
    e.preventDefault()
    const hasil = {}
    const galatPassword = cekPassword(isian.password)
    if (galatPassword) hasil.password = galatPassword
    if (isian.ulangi !== isian.password) hasil.ulangi = 'Password tidak sama'
    setGalat(hasil)
    setGalatServer('')
    if (Object.keys(hasil).length) return
    setMemproses(true)
    try {
      await resetPassword(token, isian.password)
      navigate('/masuk', { replace: true, state: { pesan: 'Password berhasil diubah. Silakan masuk dengan password baru.' } })
    } catch (err) {
      setGalatServer(err.message)
      setMemproses(false)
    }
  }

  return (
    <KartuAuth judul="Atur Password Baru" subjudul="Tautan ini berlaku dalam waktu terbatas.">
      {galatServer && (
        <Pesan nada="galat">
          {galatServer}. <Link to="/lupa-password">Minta tautan baru</Link>
        </Pesan>
      )}
      <form className="auth-form" onSubmit={kirim} noValidate>
        <TextField
          label="Password baru"
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
        <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
          {memproses ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>
    </KartuAuth>
  )
}
