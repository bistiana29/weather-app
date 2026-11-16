import { LogOut, Map as IkonPeta, Settings } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/auth'
import Logo from './Logo'
import PemilihBahasa from '../ui/PemilihBahasa'
import Pesan from '../ui/Pesan'
import Sidebar from './Sidebar'
import '../../styles/components/layout.css'

const ITEMS = [
  { to: '/risk-map/rain', label: 'umum.nav.petaRisiko', labelPendek: 'umum.nav.peta', ikon: IkonPeta },
  { to: '/settings', label: 'umum.nav.pengaturan', ikon: Settings },
]

function inisial(nama = '') {
  return nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()
}

// Layout pengguna dengan sidebar
export default function UserLayout() {
  const { t } = useTranslation()
  const { pengguna, keluar } = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()

  const itemsBawah = [
    {
      label: t('umum.nav.keluar'),
      ikon: LogOut,
      onClick: () => {
        keluar()
        navigate('/')
      },
    },
  ]

  return (
    <div className="layout-sidebar">
      <a href="#konten" className="lewati">{t('umum.lewatiKonten')}</a>
      <Sidebar
        items={ITEMS.map((item) => ({ ...item, label: t(item.label), labelPendek: t(item.labelPendek ?? item.label) }))}
        itemsBawah={itemsBawah}
        storageKey="pce-sidebar-pengguna"
        judulMobile={<Logo tampilTeks={false} />}
        kepala={(ciut) => (
          <>
            <Logo tampilTeks={!ciut} />
            <div className={`sidebar-profil ${ciut ? 'ciut' : ''}`}>
              <span className="avatar" aria-hidden="true">{inisial(pengguna?.nama)}</span>
              <span className={ciut ? 'sr-only' : 'sidebar-profil-nama'}>{pengguna?.nama}</span>
            </div>
          </>
        )}
      />
      <motion.main
        key={lokasi.pathname}
        id="konten"
        tabIndex={-1}
        className="layout-sidebar-main"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="layout-alat">
          <PemilihBahasa />
        </div>
        {lokasi.state?.pesan && (
          <div className="layout-pesan">
            <Pesan nada="galat">{t(lokasi.state.pesan)}</Pesan>
          </div>
        )}
        <Outlet />
      </motion.main>
    </div>
  )
}
