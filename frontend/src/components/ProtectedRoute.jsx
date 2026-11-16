import { Navigate, Outlet, useLocation } from 'react-router'
import { berandaRole, useAuth } from '../lib/auth'

// Kunci kamus pesan pengalihan; diterjemahkan oleh halaman tujuan
const PESAN_MASUK = {
  admin: 'auth.pesan.masukAdmin',
  user: 'auth.pesan.masukPengguna',
}

const PESAN_DITOLAK = {
  admin: 'auth.pesan.ditolakAdmin',
  user: 'auth.pesan.ditolakPengguna',
}

// Batasi halaman untuk role tertentu; pengalihan selalu membawa pesan penjelasan
export default function ProtectedRoute({ role, children }) {
  const { pengguna } = useAuth()
  const lokasi = useLocation()

  if (!pengguna) {
    const halamanLogin = role === 'admin' ? '/login/dev' : '/login'
    return <Navigate to={halamanLogin} replace state={{ dari: lokasi.pathname + lokasi.search, pesan: PESAN_MASUK[role] }} />
  }
  if (role && pengguna.role !== role) {
    return <Navigate to={berandaRole(pengguna.role)} replace state={{ pesan: PESAN_DITOLAK[role] }} />
  }
  return children ?? <Outlet />
}
