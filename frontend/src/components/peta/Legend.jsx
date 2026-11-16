import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER } from '../../lib/kategori'
import { MEDIA, useMediaQuery } from '../../lib/useMediaQuery'
import Skeleton from '../ui/Skeleton'
import '../../styles/components/peta.css'

// Kartu legenda mengambang di pojok peta, isinya mengikuti parameter aktif
export default function Legend({ parameter, memuat = false }) {
  const { t } = useTranslation()
  const f = useFormat()
  const mobile = useMediaQuery(MEDIA.mobile)
  const [terbuka, setTerbuka] = useState(false)
  const konfig = PARAMETER[parameter]
  const judul = (
    <span>
      {f.parameterJudul(parameter)} <span className="legend-satuan">({t(`satuan.${parameter}`)})</span>
    </span>
  )

  return (
    <div className={`legend ${!mobile || terbuka ? 'terbuka' : ''}`}>
      {mobile ? (
        <button type="button" className="legend-judul" aria-expanded={terbuka} onClick={() => setTerbuka((v) => !v)}>
          {judul}
          <ChevronDown size={16} aria-hidden="true" className="legend-panah" />
        </button>
      ) : (
        <p className="legend-judul">{judul}</p>
      )}

      <div className="legend-isi">
        {memuat && (
          <div className="legend-daftar" aria-hidden="true">
            {Array.from({ length: konfig.kategori.length || 2 }, (_, i) => (
              <Skeleton key={i} height={18} width="80%" />
            ))}
          </div>
        )}

        {!memuat && konfig.skala && (
          <div className="legend-skala">
            <span
              className="legend-gradasi"
              style={{ background: `linear-gradient(90deg, ${konfig.skala.warna[0]}, ${konfig.skala.warna[1]})` }}
            />
            <span className="legend-skala-label">
              <span>≤ {konfig.skala.min}%</span>
              <span>{konfig.skala.max}%</span>
            </span>
            <span className="legend-catatan">{t('peta.legend.tanpaAmbang')}</span>
          </div>
        )}

        {!memuat && !konfig.skala && (
          <ul className="legend-daftar">
            {konfig.kategori.map((k) => (
              <li key={k.label}>
                <span className="legend-warna" style={{ background: k.warna }} aria-hidden="true" />
                <span>
                  {f.kategori(parameter, k.label)}
                  <span className="legend-rentang"> · {f.rentang(k.rentang)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
