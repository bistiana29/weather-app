import { useTranslation } from 'react-i18next'
import { DAFTAR_BAHASA } from '../../i18n'
import '../../styles/components/ui.css'

// Tombol ganti bahasa ID | EN tanpa memuat ulang halaman
export default function PemilihBahasa({ className = '' }) {
  const { t, i18n } = useTranslation()
  return (
    <div className={`pilih-bahasa ${className}`} role="group" aria-label={t('umum.bahasa.label')}>
      {DAFTAR_BAHASA.map((kode) => (
        <button
          key={kode}
          type="button"
          lang={kode}
          className="pilih-bahasa-tombol"
          aria-pressed={i18n.language === kode}
          aria-label={t(`umum.bahasa.${kode}`)}
          onClick={() => i18n.changeLanguage(kode)}
        >
          {kode.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
