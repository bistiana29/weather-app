import { useState } from 'react'
import { PANJANG_ALASAN_MIN, ubahTahapModel } from '../../api/admin'
import { useAuth } from '../../lib/auth'
import { PARAMETER } from '../../lib/kategori'
import Button from '../ui/Button'
import Dialog, { DialogClose } from '../ui/Dialog'
import Pesan from '../ui/Pesan'
import TextField from '../ui/TextField'
import '../../styles/components/admin.css'

// Dialog konfirmasi promosi atau rollback model dengan alasan wajib
export default function DialogAksiModel({ aksi, model, produksi, onTutup, onBerhasil }) {
  const { pengguna } = useAuth()
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState('')
  const [memproses, setMemproses] = useState(false)
  const promosi = aksi === 'promosi'
  const namaModel = model ? `${model.jenis_model} ${model.versi}` : ''
  const parameter = model ? PARAMETER[model.parameter].judul.toLowerCase() : ''

  async function kirim(e) {
    e.preventDefault()
    if (alasan.trim().length < PANJANG_ALASAN_MIN) return setGalat(`Alasan wajib diisi, minimal ${PANJANG_ALASAN_MIN} karakter`)
    setGalat('')
    setMemproses(true)
    try {
      await ubahTahapModel({ modelId: model.id, aksi, alasan, admin: pengguna?.email })
      onBerhasil(`${namaModel} sekarang menjadi model produksi ${parameter}.`)
    } catch (err) {
      setGalat(err.message)
      setMemproses(false)
    }
  }

  return (
    <Dialog
      open={Boolean(model)}
      onOpenChange={(buka) => !buka && onTutup()}
      judul={promosi ? `Promosikan ${namaModel}?` : `Rollback ke ${namaModel}?`}
      deskripsi={`Model ${parameter} yang aktif saat ini${produksi ? ` (${produksi.jenis_model} ${produksi.versi})` : ''} akan diarsipkan. Prediksi berikutnya pukul 12.00 WIB memakai ${namaModel}.`}
    >
      {galat && <Pesan nada="galat">{galat}</Pesan>}
      <form className="dialog-form" onSubmit={kirim} noValidate>
        <TextField
          label="Alasan"
          baris={3}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          bantuan={`Wajib, minimal ${PANJANG_ALASAN_MIN} karakter. Dicatat di riwayat model.`}
        />
        <div className="dialog-aksi">
          <DialogClose asChild>
            <Button variant="sekunder">Batal</Button>
          </DialogClose>
          <Button type="submit" variant={promosi ? 'utama' : 'bahaya'} disabled={memproses}>
            {memproses ? 'Memproses…' : promosi ? 'Promosikan' : 'Rollback'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
