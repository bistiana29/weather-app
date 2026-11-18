import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from 'radix-ui'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useParams } from 'react-router'
import AdminLayout from './components/layout/AdminLayout'
import PublicLayout from './components/layout/PublicLayout'
import UserLayout from './components/layout/UserLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './lib/auth'
import Daftar from './pages/Daftar'
import Landing from './pages/Landing'
import LupaPassword from './pages/LupaPassword'
import Login from './pages/Login'
import LoginAdmin from './pages/LoginAdmin'
import Pengaturan from './pages/Pengaturan'
import ResetPassword from './pages/ResetPassword'
import TidakDitemukan from './pages/TidakDitemukan'
import VerifikasiOtp from './pages/VerifikasiOtp'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
})

// Muat halaman berat secara terpisah agar bundel awal tetap kecil
const halaman = (modul) => ({ Component: modul.default })

// Alihkan route lama /risk-map/:parameter ke format query baru (?color=), query lain dipertahankan
function AlihkanPetaLama() {
  const { parameter } = useParams()
  const lokasi = useLocation()
  const query = new URLSearchParams(lokasi.search)
  query.set('color', parameter)
  return <Navigate to={`/risk-map?${query.toString()}`} replace />
}

// Wadah halaman autentikasi tanpa navbar
function HalamanMandiri() {
  const { t } = useTranslation()
  return (
    <div className="halaman-mandiri">
      <a href="#konten" className="lewati">{t('umum.lewatiKonten')}</a>
      <main id="konten" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    hydrateFallbackElement: <div className="halaman-mandiri" aria-busy="true" />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'risk-map', lazy: () => import('./pages/PetaRisiko').then(halaman) },
      { path: 'risk-map/:parameter', element: <AlihkanPetaLama /> },
      { path: '*', element: <TidakDitemukan /> },
    ],
  },
  {
    element: <HalamanMandiri />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'login/dev', element: <LoginAdmin /> },
      { path: 'register', element: <Daftar /> },
      { path: 'verify-otp', element: <VerifikasiOtp /> },
      { path: 'forgot-password', element: <LupaPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
    ],
  },
  {
    element: <ProtectedRoute role="user" />,
    hydrateFallbackElement: <div className="halaman-mandiri" aria-busy="true" />,
    children: [{ element: <UserLayout />, children: [{ path: 'settings', element: <Pengaturan /> }] }],
  },
  {
    element: <ProtectedRoute role="admin" />,
    hydrateFallbackElement: <div className="halaman-mandiri" aria-busy="true" />,
    children: [
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, lazy: () => import('./pages/admin/Dashboard').then(halaman) },
          { path: 'data', lazy: () => import('./pages/admin/Data').then(halaman) },
          { path: 'model', lazy: () => import('./pages/admin/Model').then(halaman) },
          { path: 'notifications', lazy: () => import('./pages/admin/Notifikasi').then(halaman) },
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
