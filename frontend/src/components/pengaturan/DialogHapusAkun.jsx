import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hapusAkun } from '../../api/pengguna'
import { teksGalat } from '../../lib/galat'
import Button from '../ui/Button'
import Dialog, { DialogClose } from '../ui/Dialog'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'
import '../../styles/components/pengaturan.css'

// Dialog konfirmasi hapus akun permanen (wajib mengetik kata konfirmasi sesuai bahasa aktif)
export default function DialogHapusAkun({ open, onOpenChange, onTerhapus }) {
  const { t } = useTranslation()
  const [konfirmasi, setKonfirmasi] = useState('')
  const [galatServer, setGalatServer] = useState(null)
  const [memproses, setMemproses] = useState(false)
  const kata = t('pengaturan.hapus.kata')
  const cocok = konfirmasi.trim().toUpperCase() === kata

  function ubahTerbuka(buka) {
    if (!buka) {
      setKonfirmasi('')
      setGalatServer(null)
    }
    onOpenChange(buka)
  }

  async function kirim(e) {
    e.preventDefault()
    if (!cocok) return
    setMemproses(true)
    setGalatServer(null)
    try {
      await hapusAkun()
      onTerhapus()
    } catch (err) {
      setGalatServer(err)
      setMemproses(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={ubahTerbuka} judul={t('pengaturan.hapus.dialogJudul')} deskripsi={t('pengaturan.hapus.dialogTeks')}>
      {galatServer && <Pesan nada="galat">{teksGalat(t, galatServer)}</Pesan>}
      <form className="dialog-form" onSubmit={kirim} noValidate>
        <TextField
          label={t('pengaturan.hapus.ketik', { kata })}
          autoComplete="off"
          value={konfirmasi}
          onChange={(e) => setKonfirmasi(e.target.value)}
        />
        <div className="dialog-aksi">
          <DialogClose asChild>
            <Button variant="sekunder">{t('umum.batal')}</Button>
          </DialogClose>
          <Button type="submit" variant="bahaya" disabled={!cocok || memproses}>
            {memproses ? t('pengaturan.hapus.menghapus') : t('pengaturan.hapus.judul')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
