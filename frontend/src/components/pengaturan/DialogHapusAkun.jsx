import { useState } from 'react'
import { hapusAkun } from '../../api/pengguna'
import Button from '../ui/Button'
import Dialog, { DialogClose } from '../ui/Dialog'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'
import '../../styles/components/pengaturan.css'

const KATA_KONFIRMASI = 'HAPUS'

// Dialog konfirmasi hapus akun permanen (wajib mengetik kata konfirmasi)
export default function DialogHapusAkun({ open, onOpenChange, onTerhapus }) {
  const [konfirmasi, setKonfirmasi] = useState('')
  const [galatServer, setGalatServer] = useState('')
  const [memproses, setMemproses] = useState(false)
  const cocok = konfirmasi.trim().toUpperCase() === KATA_KONFIRMASI

  function ubahTerbuka(buka) {
    if (!buka) {
      setKonfirmasi('')
      setGalatServer('')
    }
    onOpenChange(buka)
  }

  async function kirim(e) {
    e.preventDefault()
    if (!cocok) return
    setMemproses(true)
    setGalatServer('')
    try {
      await hapusAkun()
      onTerhapus()
    } catch (err) {
      setGalatServer(err.message)
      setMemproses(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={ubahTerbuka}
      judul="Hapus akun?"
      deskripsi="Akun, nomor WhatsApp, dan kelurahan pantauan akan dihapus permanen. Peringatan WA berhenti dikirim dan tindakan ini tidak bisa dibatalkan."
    >
      {galatServer && <Pesan nada="galat">{galatServer}</Pesan>}
      <form className="dialog-form" onSubmit={kirim} noValidate>
        <TextField
          label={`Ketik ${KATA_KONFIRMASI} untuk konfirmasi`}
          autoComplete="off"
          value={konfirmasi}
          onChange={(e) => setKonfirmasi(e.target.value)}
        />
        <div className="dialog-aksi">
          <DialogClose asChild>
            <Button variant="sekunder">Batal</Button>
          </DialogClose>
          <Button type="submit" variant="bahaya" disabled={!cocok || memproses}>
            {memproses ? 'Menghapus…' : 'Hapus akun'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
