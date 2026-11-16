import { MousePointerClick } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Skeleton from '../ui/Skeleton'
import '../../styles/components/peta.css'

const JUMLAH_SOROTAN = 5

// Kelurahan dengan nilai tertinggi (atau terendah untuk jarak pandang) dan ajakan memilih kelurahan
export default function SorotanKelurahan({ risiko, indeksKelurahan, parameter, memuat, labelTanggal, onPilih }) {
  const { t } = useTranslation()
  const f = useFormat()
  const konfig = PARAMETER[parameter]
  const urut = Object.entries(risiko ?? {})
    .sort(([, a], [, b]) => (konfig.jenisNilai === 'min' ? a.nilai - b.nilai : b.nilai - a.nilai))
    .slice(0, JUMLAH_SOROTAN)

  return (
    <div className="sorotan">
      <div>
        <h2 className="sorotan-judul">{t('peta.sorotan.judul', { tanggal: labelTanggal })}</h2>
        <p className="teks-sekunder">
          {t(konfig.jenisNilai === 'min' ? 'peta.sorotan.terendah' : 'peta.sorotan.tertinggi', { parameter: f.parameterJudul(parameter) })}
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
                  <span className="teks-sekunder sorotan-nilai">{f.nilaiLengkap(parameter, data.nilai)}</span>
                </span>
                {konfig.skala ? null : <Badge warna={warnaKategori(parameter, data.kategori)}>{f.kategori(parameter, data.kategori)}</Badge>}
              </button>
            </li>
          ))}
      </ol>

      <p className="sorotan-ajakan">
        <MousePointerClick size={20} aria-hidden="true" />
        {t('peta.sorotan.ajakan')}
      </p>
    </div>
  )
}
