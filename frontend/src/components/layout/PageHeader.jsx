import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useKonteksLayout } from '../../lib/sidebar'
import PemilihBahasa from '../ui/PemilihBahasa'
import '../../styles/components/layout.css'

// Header konten bersama: tombol sidebar (jika ada), judul + subjudul di kiri, kontrol di kanan
export default function PageHeader({ judul, subjudul, children }) {
  const { t } = useTranslation()
  const { sidebar, tampilBahasa } = useKonteksLayout()
  const tampilToggle = sidebar && !sidebar.mobile
  const labelToggle = t(sidebar?.ciut ? 'umum.sidebar.lebarkan' : 'umum.sidebar.ciutkan')

  return (
    <header className="page-header">
      <div className="page-header-kiri">
        {tampilToggle && (
          <button
            type="button"
            className="tombol-ikon page-header-toggle"
            aria-label={labelToggle}
            title={labelToggle}
            aria-expanded={!sidebar.ciut}
            aria-controls="sidebar-utama"
            onClick={sidebar.toggle}
          >
            {sidebar.ciut ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          </button>
        )}
        <div className="page-header-teks">
          <h1 title={typeof judul === 'string' ? judul : undefined}>{judul}</h1>
          {subjudul && <div className="page-header-sub">{subjudul}</div>}
        </div>
      </div>
      {(children || tampilBahasa) && (
        <div className="page-header-kontrol">
          {children}
          {tampilBahasa && <PemilihBahasa />}
        </div>
      )}
    </header>
  )
}
