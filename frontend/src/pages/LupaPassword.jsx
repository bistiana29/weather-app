import { useState } from 'react'
import { Link } from 'react-router'
import { lupaPassword } from '../api/auth'
import BantuanMock from '../components/BantuanMock'
import KartuAuth from '../components/layout/KartuAuth'
import Button from '../components/ui/Button'
import Pesan from '../components/ui/Pesan'
import TextField from '../components/ui/TextField'
import { emailValid } from '../lib/validasi'

// Halaman minta tautan reset; pesan sukses dibuat samar agar tidak membocorkan email terdaftar
export default function LupaPassword() {
  const [email, setEmail] = useState('')
  const [galat, setGalat] = useState('')
  const [galatServer, setGalatServer] = useState('')
  const [terkirim, setTerkirim] = useState(false)
  const [memproses, setMemproses] = useState(false)

  async function kirim(e) {
    e.preventDefault()
    setGalatServer('')
    if (!emailValid(email)) {
      setGalat('Masukkan email yang valid')
      return
    }
    setGalat('')
    setMemproses(true)
    try {
      await lupaPassword(email.trim().toLowerCase())
      setTerkirim(true)
    } catch (err) {
      setGalatServer(err.message)
    } finally {
      setMemproses(false)
    }
  }

  return (
    <KartuAuth
      judul="Lupa Password"
      subjudul="Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur password baru."
      kaki={
        <p>
          Ingat password? <Link to="/masuk">Masuk</Link>
        </p>
      }
    >
      {galatServer && <Pesan nada="galat">{galatServer}</Pesan>}

      {terkirim ? (
        <>
          <Pesan>
            Jika email tersebut terdaftar, tautan reset sudah dikirim. Periksa kotak masuk atau folder spam. Tautan hanya
            berlaku dalam waktu terbatas.
          </Pesan>
          <Button variant="sekunder" onClick={() => setTerkirim(false)}>
            Kirim ke email lain
          </Button>
          <BantuanMock jenis="reset" />
        </>
      ) : (
        <form className="auth-form" onSubmit={kirim} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            galat={galat}
          />
          <Button type="submit" ukuran="besar" disabled={memproses} className="auth-tombol">
            {memproses ? 'Mengirim…' : 'Kirim Tautan Reset'}
          </Button>
        </form>
      )}
    </KartuAuth>
  )
}
