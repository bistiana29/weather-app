import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Tooltip } from 'radix-ui'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import AdminLayout from './components/layout/AdminLayout'
import PublicLayout from './components/layout/PublicLayout'
import UserLayout from './components/layout/UserLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './lib/auth'
import Daftar from './pages/Daftar'
import Landing from './pages/Landing'
import LupaPassword from './pages/LupaPassword'
import Masuk from './pages/Masuk'
import Pengaturan from './pages/Pengaturan'
import ResetPassword from './pages/ResetPassword'
import TidakDitemukan from './pages/TidakDitemukan'
import VerifikasiOtp from './pages/VerifikasiOtp'
import AdminDashboard from './pages/admin/Dashboard'
import AdminData from './pages/admin/Data'
import AdminModel from './pages/admin/Model'
import AdminNotifikasi from './pages/admin/Notifikasi'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
})

// Wadah halaman autentikasi tanpa navbar
function HalamanMandiri() {
  return (
    <div className="halaman-mandiri">
      <Outlet />
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    hydrateFallbackElement: <div className="halaman-mandiri" aria-busy="true" />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'peta-risiko', element: <Navigate to="/peta-risiko/hujan" replace /> },
      {
        path: 'peta-risiko/:parameter',
        lazy: () => import('./pages/PetaRisiko').then((m) => ({ Component: m.default })),
      },
      { path: '*', element: <TidakDitemukan /> },
    ],
  },
  {
    element: <HalamanMandiri />,
    children: [
      { path: 'masuk', element: <Masuk /> },
      { path: 'daftar', element: <Daftar /> },
      { path: 'verifikasi-otp', element: <VerifikasiOtp /> },
      { path: 'lupa-password', element: <LupaPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
    ],
  },
  {
    element: <ProtectedRoute role="user" />,
    children: [{ element: <UserLayout />, children: [{ path: 'pengaturan', element: <Pengaturan /> }] }],
  },
  {
    element: <ProtectedRoute role="admin" />,
    children: [
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'data', element: <AdminData /> },
          { path: 'model', element: <AdminModel /> },
          { path: 'notifikasi', element: <AdminNotifikasi /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <Tooltip.Provider>
            <RouterProvider router={router} />
          </Tooltip.Provider>
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  )
}
