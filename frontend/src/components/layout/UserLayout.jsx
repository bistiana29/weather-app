import { LogOut, Map as IkonPeta, Settings } from 'lucide-react'
import { motion } from 'motion/react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/auth'
import Logo from './Logo'
import Pesan from '../ui/Pesan'
import Sidebar from './Sidebar'
import '../../styles/components/layout.css'

const ITEMS = [
  { to: '/peta-risiko/hujan', label: 'Peta Risiko', labelPendek: 'Peta', ikon: IkonPeta },
  { to: '/pengaturan', label: 'Pengaturan', ikon: Settings },
]

function inisial(nama = '') {
  return nama.split(' ').slice(0, 2).map((k) => k[0]).join('').toUpperCase()
}

// Layout pengguna dengan sidebar
export default function UserLayout() {
  const { pengguna, keluar } = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()

  const itemsBawah = [
    {
      label: 'Keluar',
      ikon: LogOut,
      onClick: () => {
        keluar()
        navigate('/')
      },
    },
  ]

  return (
    <div className="layout-sidebar">
      <Sidebar
        items={ITEMS}
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
        className="layout-sidebar-main"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {lokasi.state?.pesan && (
          <div className="layout-pesan">
            <Pesan nada="galat">{lokasi.state.pesan}</Pesan>
          </div>
        )}
        <Outlet />
      </motion.main>
    </div>
  )
}
