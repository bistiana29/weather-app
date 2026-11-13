import { useQuery } from '@tanstack/react-query'
import { FileUp, Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { getStasiunBmkg, unggahCsvBmkg } from '../../api/admin'
import Button from '../ui/Button'
import Pesan from '../ui/Pesan'
import Select from '../ui/Select'
import '../../styles/components/admin.css'

const UKURAN_MAKS_MB = 5
const KOLOM_BMKG = ['TANGGAL', 'TN', 'TX', 'TAVG', 'RH_AVG', 'RR', 'SS', 'FF_X', 'DDD_X', 'FF_AVG', 'DDD_CAR']

// Unggah CSV observasi harian BMKG per stasiun untuk validasi sumber data
export default function UnggahCsvBmkg() {
  const idBerkas = useId()
  const stasiunQuery = useQuery({ queryKey: ['admin', 'stasiun'], queryFn: getStasiunBmkg })
  const [idWmo, setIdWmo] = useState('')
  const [berkas, setBerkas] = useState(null)
  const [galat, setGalat] = useState('')
  const [hasil, setHasil] = useState(null)
  const [memproses, setMemproses] = useState(false)

  function pilihBerkas(e) {
    const file = e.target.files?.[0]
    setHasil(null)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setBerkas(null)
      return setGalat('Berkas harus berformat .csv')
    }
    if (file.size > UKURAN_MAKS_MB * 1024 * 1024) {
      setBerkas(null)
      return setGalat(`Ukuran berkas maksimal ${UKURAN_MAKS_MB} MB`)
    }
    setGalat('')
    setBerkas(file)
  }

  async function unggah() {
    if (!idWmo) return setGalat('Pilih stasiun terlebih dahulu')
    setGalat('')
    setMemproses(true)
    try {
      setHasil(await unggahCsvBmkg({ idWmo: Number(idWmo), file: berkas }))
    } catch (err) {
      setGalat(err.message)
    } finally {
      setMemproses(false)
    }
  }

  const kolomKurang = hasil ? KOLOM_BMKG.filter((k) => !hasil.kolom.map((c) => c.trim().toUpperCase()).includes(k)) : []

  return (
    <div className="unggah">
      <p className="teks-sekunder">Format ekspor dataonline BMKG dengan kolom {KOLOM_BMKG.join(', ')}.</p>
      <Select
        label="Stasiun"
        value={idWmo}
        onValueChange={setIdWmo}
        placeholder={stasiunQuery.isPending ? 'Memuat stasiun…' : 'Pilih stasiun BMKG'}
        options={(stasiunQuery.data ?? []).map((s) => ({ value: String(s.id_wmo), label: `${s.nama} (${s.id_wmo})` }))}
      />
      <div className="unggah-berkas">
        <input id={idBerkas} type="file" accept=".csv,text/csv" className="sr-only" onChange={pilihBerkas} />
        <label htmlFor={idBerkas} className="btn btn-sekunder btn-sedang">
          <FileUp size={18} aria-hidden="true" />
          Pilih berkas CSV
        </label>
        <span className="teks-sekunder unggah-nama">{berkas ? berkas.name : 'Belum ada berkas'}</span>
      </div>
      {galat && <Pesan nada="galat">{galat}</Pesan>}
      {hasil && (
        <Pesan nada={kolomKurang.length ? 'galat' : 'info'}>
          {hasil.nama_file}: {hasil.jumlah_baris.toLocaleString('id-ID')} baris diterima untuk stasiun {hasil.id_wmo}.
          {kolomKurang.length > 0 && ` Kolom tidak ditemukan: ${kolomKurang.join(', ')}.`}
        </Pesan>
      )}
      <Button ikon={Upload} disabled={!berkas || memproses} onClick={unggah} className="unggah-tombol">
        {memproses ? 'Mengunggah…' : 'Unggah'}
      </Button>
    </div>
  )
}
