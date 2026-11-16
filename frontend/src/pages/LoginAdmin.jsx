import { useTranslation } from 'react-i18next'
import FormMasuk from '../components/auth/FormMasuk'
import JudulHalaman from '../components/JudulHalaman'
import KartuAuth from '../components/layout/KartuAuth'

// Halaman masuk khusus admin; tidak ditautkan dari halaman publik dan tidak diindeks mesin pencari
export default function LoginAdmin() {
  const { t } = useTranslation()
  return (
    <KartuAuth varian="admin" judul={t('auth.loginAdmin.judul')} subjudul={t('auth.loginAdmin.subjudul')}>
      <JudulHalaman judul={t('auth.loginAdmin.judul')} tanpaIndeks />
      <FormMasuk role="admin" />
    </KartuAuth>
  )
}
