import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import PemilihBahasa from '../ui/PemilihBahasa'
import Logo from './Logo'
import '../../styles/components/layout.css'

// Wadah kartu terpusat untuk halaman autentikasi; varian admin memakai identitas panel admin
export default function KartuAuth({ judul, subjudul, children, kaki, lebar = 'sempit', varian = 'publik' }) {
  const { t } = useTranslation()
  const admin = varian === 'admin'
  return (
    <div className={`auth ${admin ? 'auth-admin' : ''}`}>
      <div className="auth-bahasa">
        <PemilihBahasa />
      </div>
      {admin ? (
        <p className="auth-tanda-admin">
          <span className="judul-admin-ikon" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          {t('auth.panelAdmin')}
        </p>
      ) : (
        <Logo />
      )}
      <motion.section
        className={`auth-kartu auth-${lebar}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        aria-labelledby="auth-judul"
      >
        <div className="auth-kepala">
          <h1 id="auth-judul">{judul}</h1>
          {subjudul && <p className="teks-sekunder">{subjudul}</p>}
        </div>
        {children}
        {kaki && <div className="auth-kaki">{kaki}</div>}
      </motion.section>
      <Link to="/" className="auth-kembali">
        <ChevronLeft size={18} aria-hidden="true" />
        {t(admin ? 'auth.kembaliSitusPublik' : 'auth.kembaliBeranda')}
      </Link>
    </div>
  )
}
