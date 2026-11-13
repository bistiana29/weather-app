import { LayoutDashboard, LogIn, LogOut, Map as IkonPeta, Settings, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/auth'
import Button from '../ui/Button'
import Logo from './Logo'
import '../../styles/components/layout.css'

const KELAS_TAUTAN = ({ isActive }) => `navbar-tautan ${isActive ? 'aktif' : ''}`

// Daftar tautan navigasi sesuai status login
function tautanNavigasi(pengguna) {
  const peta = { to: '/peta-risiko/hujan', cocok: '/peta-risiko', label: 'Peta Risiko', labelPendek: 'Peta', ikon: IkonPeta }
  if (!pengguna) {
    return [peta, { to: '/masuk', label: 'Masuk', ikon: LogIn }, { to: '/daftar', label: 'Daftar', ikon: UserPlus }]
  }
  if (pengguna.role === 'admin') {
    return [peta, { to: '/admin', label: 'Panel Admin', labelPendek: 'Admin', ikon: LayoutDashboard }]
  }
  return [peta, { to: '/pengaturan', label: 'Pengaturan', ikon: Settings }]
}

// Layout area publik: navbar atas, footer disclaimer, navigasi bawah di mobile
export default function PublicLayout() {
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
      <header className="navbar">
        <Logo />
        <nav className="navbar-nav" aria-label="Navigasi utama">
          {tautan.map((t) =>
            t.to === '/daftar' ? (
              <Button key={t.to} as={NavLink} to={t.to} ukuran="kecil" className="navbar-daftar">
                {t.label}
              </Button>
            ) : (
              <NavLink
                key={t.to}
                to={t.to}
                className={() => KELAS_TAUTAN({ isActive: lokasi.pathname.startsWith(t.cocok ?? t.to) })}
              >
                {t.label}
              </NavLink>
            ),
          )}
          {pengguna && (
            <button type="button" className="navbar-tautan" onClick={tanganiKeluar}>
              Keluar
            </button>
          )}
        </nav>
      </header>

      <motion.main
        key={segmen}
        className="layout-publik-main"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.main>

      <footer className="footer">
        <p>© 2026 Pemetaan Cuaca Ekstrem Kota Surabaya</p>
        <p>Hasil prediksi model, bukan peringatan resmi BMKG.</p>
      </footer>

      <nav className="nav-bawah" aria-label="Navigasi utama">
        {tautan.map((t) => {
          const Ikon = t.ikon
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={() => `nav-bawah-item ${lokasi.pathname.startsWith(t.cocok ?? t.to) ? 'aktif' : ''}`}
            >
              <Ikon size={20} aria-hidden="true" />
              <span>{t.labelPendek ?? t.label}</span>
            </NavLink>
          )
        })}
        {pengguna && (
          <button type="button" className="nav-bawah-item" onClick={tanganiKeluar}>
            <LogOut size={20} aria-hidden="true" />
            <span>Keluar</span>
          </button>
        )}
      </nav>
    </div>
  )
}
