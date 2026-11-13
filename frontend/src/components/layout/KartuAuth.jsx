import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import Logo from './Logo'
import '../../styles/components/layout.css'

// Wadah kartu terpusat untuk halaman autentikasi
export default function KartuAuth({ judul, subjudul, children, kaki, lebar = 'sempit' }) {
  return (
    <div className="auth">
      <Logo />
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
      <Link to="/peta-risiko/hujan" className="auth-kembali">
        <ChevronLeft size={18} aria-hidden="true" />
        Kembali ke peta (tanpa akun)
      </Link>
    </div>
  )
}
