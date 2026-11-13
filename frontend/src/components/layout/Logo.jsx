import { CloudSun } from 'lucide-react'
import { Link } from 'react-router'
import '../../styles/components/layout.css'

// Logo aplikasi; teks bisa disembunyikan untuk rail
export default function Logo({ to = '/', tampilTeks = true, terang = false }) {
  return (
    <Link to={to} className={`logo ${terang ? 'logo-terang' : ''}`} aria-label="Pemetaan Cuaca Ekstrem Surabaya, beranda">
      <span className="logo-tanda" aria-hidden="true">
        <CloudSun size={22} />
      </span>
      {tampilTeks && (
        <span className="logo-teks">
          Pemetaan Cuaca Ekstrem
          <span className="logo-sub">Kota Surabaya</span>
        </span>
      )}
    </Link>
  )
}
