import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER } from '../../lib/kategori'
import { MEDIA, useMediaQuery } from '../../lib/useMediaQuery'
import Skeleton from '../ui/Skeleton'
import '../../styles/components/peta.css'

// Kartu legenda di pojok peta (bisa dilipat di bawah 1280 px): pilihan "Warnai peta" (parameter tercentang) dan kategori parameter pewarna
export default function Legend({ parameter, opsi, onWarnai, memuat = false }) {
  const { t } = useTranslation()
  const f = useFormat()
  const lipat = !useMediaQuery(MEDIA.desktop)
  const [terbuka, setTerbuka] = useState(false)
  const konfig = PARAMETER[parameter]
  const judul = (
    <span>
      {f.parameterJudul(parameter)} <span className="legend-satuan">({t(`satuan.${parameter}`)})</span>
    </span>
  )

  return (
    <div className={`legend ${lipat ? 'bisa-lipat' : ''} ${!lipat || terbuka ? 'terbuka' : ''}`}>
      {lipat ? (
        <button type="button" className="legend-judul" aria-expanded={terbuka} onClick={() => setTerbuka((v) => !v)}>
          {judul}
          <ChevronDown size={16} aria-hidden="true" className="legend-panah" />
        </button>
      ) : (
        <p className="legend-judul">{judul}</p>
      )}

      <div className="legend-isi">
        {opsi.length > 1 && (
          <div className="legend-warnai" role="radiogroup" aria-label={t('peta.legend.warnai')}>
            <span className="legend-warnai-label">{t('peta.legend.warnai')}</span>
            <div className="legend-warnai-opsi">
              {opsi.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  role="radio"
                  aria-checked={slug === parameter}
                  className="legend-warnai-tombol"
                  onClick={() => onWarnai(slug)}
                >
                  {f.parameterLabel(slug)}
                </button>
              ))}
            </div>
          </div>
        )}

        {memuat ? (
          <div className="legend-daftar" aria-hidden="true">
            {konfig.kategori.map((k) => (
              <Skeleton key={k.label} height={18} width="80%" />
            ))}
          </div>
        ) : (
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
