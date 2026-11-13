import { Navigate, Outlet, useLocation } from 'react-router'
import { berandaRole, useAuth } from '../lib/auth'

// Batasi halaman hanya untuk pengguna login dengan role tertentu
export default function ProtectedRoute({ role, children }) {
  const { pengguna } = useAuth()
  const lokasi = useLocation()

  if (!pengguna) {
    return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname + lokasi.search }} />
  }
  if (role && pengguna.role !== role) {
    return <Navigate to={berandaRole(pengguna.role)} replace />
  }
  return children ?? <Outlet />
}
