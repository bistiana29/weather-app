import { useState } from 'react'
import { ubahPassword } from '../../api/pengguna'
import { cekPassword, PANJANG_PASSWORD_MIN } from '../../lib/validasi'
import Button from '../ui/Button'
import Dialog, { DialogClose } from '../ui/Dialog'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'
import '../../styles/components/pengaturan.css'

const ISIAN_KOSONG = { lama: '', baru: '', ulangi: '' }

// Dialog ubah password dengan password lama sebagai konfirmasi
export default function DialogUbahPassword({ open, onOpenChange, onBerhasil }) {
  const [isian, setIsian] = useState(ISIAN_KOSONG)
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState('')
  const [memproses, setMemproses] = useState(false)

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))

  function ubahTerbuka(buka) {
    if (!buka) {
      setIsian(ISIAN_KOSONG)
      setGalat({})
      setGalatServer('')
    }
    onOpenChange(buka)
  }

  async function kirim(e) {
    e.preventDefault()
    const hasil = {}
    if (!isian.lama) hasil.lama = 'Password lama wajib diisi'
    const galatBaru = cekPassword(isian.baru)
    if (galatBaru) hasil.baru = galatBaru
    else if (isian.baru === isian.lama) hasil.baru = 'Password baru harus berbeda'
    if (isian.ulangi !== isian.baru) hasil.ulangi = 'Password tidak sama'
    setGalat(hasil)
    setGalatServer('')
    if (Object.keys(hasil).length) return
    setMemproses(true)
    try {
      await ubahPassword(isian.lama, isian.baru)
      ubahTerbuka(false)
      onBerhasil()
    } catch (err) {
      setGalatServer(err.message)
    } finally {
      setMemproses(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={ubahTerbuka} judul="Ubah password">
      {galatServer && <Pesan nada="galat">{galatServer}</Pesan>}
      <form className="dialog-form" onSubmit={kirim} noValidate>
        <TextField label="Password lama" type="password" autoComplete="current-password" value={isian.lama} onChange={ubah('lama')} galat={galat.lama} />
        <TextField
          label="Password baru"
          type="password"
          autoComplete="new-password"
          value={isian.baru}
          onChange={ubah('baru')}
          galat={galat.baru}
          bantuan={`Minimal ${PANJANG_PASSWORD_MIN} karakter, huruf dan angka.`}
        />
        <TextField label="Ulangi password baru" type="password" autoComplete="new-password" value={isian.ulangi} onChange={ubah('ulangi')} galat={galat.ulangi} />
        <div className="dialog-aksi">
          <DialogClose asChild>
            <Button variant="sekunder">Batal</Button>
          </DialogClose>
          <Button type="submit" disabled={memproses}>
            {memproses ? 'Menyimpan…' : 'Simpan password'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
