import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ubahPassword } from '../../api/pengguna'
import { teksGalat } from '../../lib/galat'
import { cekPassword, PANJANG_PASSWORD_MIN } from '../../lib/validasi'
import Button from '../ui/Button'
import Dialog, { DialogClose } from '../ui/Dialog'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'
import '../../styles/components/pengaturan.css'

const ISIAN_KOSONG = { lama: '', baru: '', ulangi: '' }

// Dialog ubah password dengan password lama sebagai konfirmasi
export default function DialogUbahPassword({ open, onOpenChange, onBerhasil }) {
  const { t } = useTranslation()
  const [isian, setIsian] = useState(ISIAN_KOSONG)
  const [galat, setGalat] = useState({})
  const [galatServer, setGalatServer] = useState(null)
  const [memproses, setMemproses] = useState(false)

  const ubah = (kunci) => (e) => setIsian((v) => ({ ...v, [kunci]: e.target.value }))
  const pesan = (kunci) => galat[kunci] && t(galat[kunci], { n: PANJANG_PASSWORD_MIN })

  function ubahTerbuka(buka) {
    if (!buka) {
      setIsian(ISIAN_KOSONG)
      setGalat({})
      setGalatServer(null)
    }
    onOpenChange(buka)
  }

  async function kirim(e) {
    e.preventDefault()
    const hasil = {}
    if (!isian.lama) hasil.lama = 'validasi.passwordLamaWajib'
    const galatBaru = cekPassword(isian.baru)
    if (galatBaru) hasil.baru = `validasi.${galatBaru}`
    else if (isian.baru === isian.lama) hasil.baru = 'validasi.passwordHarusBeda'
    if (isian.ulangi !== isian.baru) hasil.ulangi = 'validasi.passwordTidakSama'
    setGalat(hasil)
    setGalatServer(null)
    if (Object.keys(hasil).length) return
    setMemproses(true)
    try {
      await ubahPassword(isian.lama, isian.baru)
      ubahTerbuka(false)
      onBerhasil()
    } catch (err) {
      setGalatServer(err)
    } finally {
      setMemproses(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={ubahTerbuka} judul={t('pengaturan.password.judul')}>
      {galatServer && <Pesan nada="galat">{teksGalat(t, galatServer)}</Pesan>}
      <form className="dialog-form" onSubmit={kirim} noValidate>
        <TextField
          label={t('pengaturan.password.lama')}
          type="password"
          autoComplete="current-password"
          value={isian.lama}
          onChange={ubah('lama')}
          galat={pesan('lama')}
        />
        <TextField
          label={t('pengaturan.password.baru')}
          type="password"
          autoComplete="new-password"
          value={isian.baru}
          onChange={ubah('baru')}
          galat={pesan('baru')}
          bantuan={t('auth.passwordBantuan', { n: PANJANG_PASSWORD_MIN })}
        />
        <TextField
          label={t('pengaturan.password.ulangi')}
          type="password"
          autoComplete="new-password"
          value={isian.ulangi}
          onChange={ubah('ulangi')}
          galat={pesan('ulangi')}
        />
        <div className="dialog-aksi">
          <DialogClose asChild>
            <Button variant="sekunder">{t('umum.batal')}</Button>
          </DialogClose>
          <Button type="submit" disabled={memproses}>
            {memproses ? t('auth.reset.menyimpan') : t('pengaturan.password.tombol')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
