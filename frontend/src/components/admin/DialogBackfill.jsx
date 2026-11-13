import { useState } from 'react'
import { mintaBackfill } from '../../api/admin'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import DatePicker from '../ui/DatePicker'
import Dialog, { DialogClose } from '../ui/Dialog'
import Pesan from '../ui/Pesan'
import { LABEL_SUMBER } from './label'
import '../../styles/components/admin.css'

const TANGGAL_MIN = '2022-01-01'
const TANGGAL_MAKS = '2026-11-11'

// Dialog meminta backfill hourly untuk sumber dan rentang tertentu
export default function DialogBackfill({ open, onOpenChange }) {
  const [sumber, setSumber] = useState({ nasa: true, openmeteo: true })
  const [mulai, setMulai] = useState(TANGGAL_MIN)
  const [akhir, setAkhir] = useState(TANGGAL_MAKS)
  const [galat, setGalat] = useState('')
  const [terkirim, setTerkirim] = useState(false)
  const [memproses, setMemproses] = useState(false)
  const dipilih = Object.keys(sumber).filter((s) => sumber[s])

  function ubahTerbuka(buka) {
    if (!buka) {
      setGalat('')
      setTerkirim(false)
    }
    onOpenChange(buka)
  }

  async function kirim(e) {
    e.preventDefault()
    if (!dipilih.length) return setGalat('Pilih minimal satu sumber')
    if (mulai > akhir) return setGalat('Tanggal mulai harus sebelum tanggal akhir')
    setGalat('')
    setMemproses(true)
    try {
      await mintaBackfill({ sumber: dipilih, mulai, akhir })
      setTerkirim(true)
    } catch (err) {
      setGalat(err.message)
    } finally {
      setMemproses(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={ubahTerbuka}
      judul="Minta backfill hourly"
      deskripsi="Mengambil ulang data hourly 153 kelurahan. Potongan yang sudah sukses dilewati, dan backfill memakai kuota Open-Meteo yang sama dengan jadwal otomatis."
    >
      {galat && <Pesan nada="galat">{galat}</Pesan>}
      {terkirim ? (
        <>
          <Pesan>Permintaan backfill diterima dan akan dijalankan oleh pipeline.</Pesan>
          <div className="dialog-aksi">
            <DialogClose asChild>
              <Button>Tutup</Button>
            </DialogClose>
          </div>
        </>
      ) : (
        <form className="dialog-form" onSubmit={kirim} noValidate>
          <fieldset className="backfill-sumber">
            <legend className="field-label">Sumber</legend>
            {Object.entries(LABEL_SUMBER).map(([kode, label]) => (
              <Checkbox key={kode} checked={sumber[kode]} onCheckedChange={(v) => setSumber((s) => ({ ...s, [kode]: v }))}>
                {label}
              </Checkbox>
            ))}
          </fieldset>
          <div className="backfill-rentang">
            <div className="field">
              <span className="field-label">Mulai</span>
              <DatePicker value={mulai} onChange={setMulai} min={TANGGAL_MIN} max={TANGGAL_MAKS} label="Tanggal mulai backfill" />
            </div>
            <div className="field">
              <span className="field-label">Akhir</span>
              <DatePicker value={akhir} onChange={setAkhir} min={TANGGAL_MIN} max={TANGGAL_MAKS} label="Tanggal akhir backfill" />
            </div>
          </div>
          <p className="teks-sekunder backfill-catatan">Rentang mengikuti batas backfill: 1 Jan 2022 00.00 sampai 11 Nov 2026 23.00 WIB.</p>
          <div className="dialog-aksi">
            <DialogClose asChild>
              <Button variant="sekunder">Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Mengirim…' : 'Minta backfill'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
