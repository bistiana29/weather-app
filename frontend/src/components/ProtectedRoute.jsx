import { Navigate, Outlet, useLocation } from 'react-router'
import { berandaRole, useAuth } from '../lib/auth'

const PESAN_MASUK = {
  admin: 'Silakan masuk dengan akun admin untuk membuka Panel Admin.',
  user: 'Silakan masuk untuk membuka halaman Pengaturan.',
}

const PESAN_DITOLAK = {
  admin: 'Halaman admin hanya untuk akun admin. Anda dialihkan ke Pengaturan.',
  user: 'Halaman Pengaturan hanya untuk akun pengguna. Anda dialihkan ke Panel Admin.',
}

// Batasi halaman untuk role tertentu; pengalihan selalu membawa pesan penjelasan
export default function ProtectedRoute({ role, children }) {
  const { pengguna } = useAuth()
  const lokasi = useLocation()

  if (!pengguna) {
    return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname + lokasi.search, pesan: PESAN_MASUK[role] }} />
  }
  if (role && pengguna.role !== role) {
    return <Navigate to={berandaRole(pengguna.role)} replace state={{ pesan: PESAN_DITOLAK[role] }} />
  }
  return children ?? <Outlet />
}
