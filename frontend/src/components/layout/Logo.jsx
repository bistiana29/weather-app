import { CloudSun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import '../../styles/components/layout.css'

// Logo aplikasi; teks bisa disembunyikan untuk rail
export default function Logo({ to = '/', tampilTeks = true, terang = false }) {
  const { t } = useTranslation()
  return (
    <Link to={to} className={`logo ${terang ? 'logo-terang' : ''}`} aria-label={t('umum.logo.label')}>
      <span className="logo-tanda" aria-hidden="true">
        <CloudSun size={22} />
      </span>
      {tampilTeks && (
        <span className="logo-teks">
          {t('umum.logo.nama')}
          <span className="logo-sub">{t('umum.logo.sub')}</span>
        </span>
      )}
    </Link>
  )
}
