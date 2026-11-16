import { BrainCircuit, Database, Globe, LayoutDashboard, LogOut, Send, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'
import i18n, { i18nAdmin } from '../../i18n'
import { useAuth } from '../../lib/auth'
import Pesan from '../ui/Pesan'
import Sidebar from './Sidebar'
import '../../styles/components/layout.css'

const ITEMS = [
  { to: '/admin', end: true, label: 'Dashboard', ikon: LayoutDashboard },
  { to: '/admin/data', label: 'Data (ETL)', labelPendek: 'Data', ikon: Database },
  { to: '/admin/model', label: 'Model / MLOps', labelPendek: 'Model', ikon: BrainCircuit },
  { to: '/admin/notifications', label: 'Notifikasi', ikon: Send },
]

// Judul panel admin di kepala sidebar
function JudulAdmin({ ciut }) {
  return (
    <div className="judul-admin">
      <span className="judul-admin-ikon" aria-hidden="true">
        <ShieldCheck size={20} />
      </span>
      <span className={ciut ? 'sr-only' : 'judul-admin-teks'}>Panel Admin</span>
    </div>
  )
}

// Layout admin dengan sidebar navy; seluruh panel admin berbahasa Indonesia
export default function AdminLayout() {
  const { keluar } = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()

  // Atribut lang dikunci ke Indonesia selama berada di panel admin
  useEffect(() => {
    document.documentElement.lang = 'id'
    return () => {
      document.documentElement.lang = i18n.language
    }
  }, [])

  const itemsBawah = [
    { to: '/', label: 'Situs publik', ikon: Globe },
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
    <I18nextProvider i18n={i18nAdmin}>
    <div className="layout-sidebar">
      <a href="#konten" className="lewati">Lewati ke konten</a>
      <Sidebar
        items={ITEMS}
        itemsBawah={itemsBawah}
        storageKey="pce-sidebar-admin"
        nada="gelap"
        judulMobile={<JudulAdmin ciut={false} />}
        kepala={(ciut) => <JudulAdmin ciut={ciut} />}
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
        {lokasi.state?.pesan && (
          <div className="layout-pesan">
            <Pesan nada="galat">{i18nAdmin.t(lokasi.state.pesan)}</Pesan>
          </div>
        )}
        <Outlet />
      </motion.main>
    </div>
    </I18nextProvider>
  )
}
