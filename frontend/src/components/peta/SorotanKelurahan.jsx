import { MousePointerClick } from 'lucide-react'
import { formatNilai, PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Skeleton from '../ui/Skeleton'
import '../../styles/components/peta.css'

const JUMLAH_SOROTAN = 5

// Kelurahan dengan nilai tertinggi (atau terendah untuk jarak pandang) dan ajakan memilih kelurahan
export default function SorotanKelurahan({ risiko, indeksKelurahan, parameter, memuat, labelTanggal, onPilih }) {
  const konfig = PARAMETER[parameter]
  const urut = Object.entries(risiko ?? {})
    .sort(([, a], [, b]) => (konfig.jenisNilai === 'min' ? a.nilai - b.nilai : b.nilai - a.nilai))
    .slice(0, JUMLAH_SOROTAN)

  return (
    <div className="sorotan">
      <div>
        <h2 className="sorotan-judul">Sorotan {labelTanggal}</h2>
        <p className="teks-sekunder">
          {konfig.jenisNilai === 'min' ? 'Jarak pandang terendah' : `${konfig.judul} tertinggi`} per kelurahan
        </p>
      </div>

      <ol className="sorotan-daftar" aria-busy={memuat}>
        {memuat &&
          Array.from({ length: JUMLAH_SOROTAN }, (_, i) => (
            <li key={i} className="sorotan-baris" aria-hidden="true">
              <Skeleton width="45%" height={18} />
              <Skeleton width={96} height={24} radius={999} />
            </li>
          ))}
        {!memuat &&
          urut.map(([kode, data]) => (
            <li key={kode}>
              <button type="button" className="sorotan-baris" onClick={() => onPilih(kode)}>
                <span className="sorotan-nama">
                  {indeksKelurahan[kode]?.kelurahan ?? kode}
                  <span className="teks-sekunder sorotan-nilai">{formatNilai(parameter, data.nilai)}</span>
                </span>
                {konfig.skala ? null : <Badge warna={warnaKategori(parameter, data.kategori)}>{data.kategori}</Badge>}
              </button>
            </li>
          ))}
      </ol>

      <p className="sorotan-ajakan">
        <MousePointerClick size={20} aria-hidden="true" />
        Klik kelurahan di peta atau gunakan kolom cari untuk melihat prakiraan 24 jam.
      </p>
    </div>
  )
}
