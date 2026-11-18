import { LayoutDashboard, LogIn, LogOut, Map as IkonPeta, Settings, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/auth'
import KartuPeringatanWA from '../KartuPeringatanWA'
import Button from '../ui/Button'
import PemilihBahasa from '../ui/PemilihBahasa'
import Logo from './Logo'
import '../../styles/components/layout.css'

const KELAS_TAUTAN = ({ isActive }) => `navbar-tautan ${isActive ? 'aktif' : ''}`

// Daftar tautan navigasi sesuai status login (label berupa kunci kamus)
function tautanNavigasi(pengguna) {
  const peta = { to: '/risk-map', cocok: '/risk-map', label: 'umum.nav.petaRisiko', labelPendek: 'umum.nav.peta', ikon: IkonPeta }
  if (!pengguna) {
    return [peta, { to: '/login', label: 'umum.nav.masuk', ikon: LogIn }, { to: '/register', label: 'umum.nav.daftar', ikon: UserPlus }]
  }
  if (pengguna.role === 'admin') {
    return [peta, { to: '/admin', label: 'umum.nav.panelAdmin', labelPendek: 'umum.nav.admin', ikon: LayoutDashboard }]
  }
  return [peta, { to: '/settings', label: 'umum.nav.pengaturan', ikon: Settings }]
}

// Layout area publik: navbar atas, footer disclaimer, navigasi bawah di mobile
export default function PublicLayout() {
  const { t } = useTranslation()
  const { pengguna, keluar } = useAuth()
  const lokasi = useLocation()
  const navigate = useNavigate()
  const tautan = tautanNavigasi(pengguna)
  const segmen = lokasi.pathname.split('/')[1]

  function tanganiKeluar() {
    keluar()
    navigate('/')
  }

  return (
    <div className="layout-publik">
      <a href="#konten" className="lewati">{t('umum.lewatiKonten')}</a>
      <header className="navbar">
        <Logo />
        <div className="navbar-kanan">
          <nav className="navbar-nav" aria-label={t('umum.nav.navigasiUtama')}>
            {tautan.map((item) =>
              item.to === '/register' ? (
                <Button key={item.to} as={NavLink} to={item.to} ukuran="kecil" className="navbar-daftar">
                  {t(item.label)}
                </Button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={() => KELAS_TAUTAN({ isActive: lokasi.pathname.startsWith(item.cocok ?? item.to) })}
                >
                  {t(item.label)}
                </NavLink>
              ),
            )}
            {pengguna && (
              <button type="button" className="navbar-tautan" onClick={tanganiKeluar}>
                {t('umum.nav.keluar')}
              </button>
            )}
          </nav>
          <PemilihBahasa />
        </div>
      </header>

      <motion.main
        key={segmen}
        id="konten"
        tabIndex={-1}
        className="layout-publik-main"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.main>

      <footer className="footer">
        <p>{t('umum.hakCipta')}</p>
        <p>{t('umum.disclaimer')}</p>
      </footer>

      <KartuPeringatanWA />

      <nav className="nav-bawah" aria-label={t('umum.nav.navigasiUtama')}>
        {tautan.map((item) => {
          const Ikon = item.ikon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={() => `nav-bawah-item ${lokasi.pathname.startsWith(item.cocok ?? item.to) ? 'aktif' : ''}`}
            >
              <Ikon size={20} aria-hidden="true" />
              <span>{t(item.labelPendek ?? item.label)}</span>
            </NavLink>
          )
        })}
        {pengguna && (
          <button type="button" className="nav-bawah-item" onClick={tanganiKeluar}>
            <LogOut size={20} aria-hidden="true" />
            <span>{t('umum.nav.keluar')}</span>
          </button>
        )}
      </nav>
    </div>
  )
}
