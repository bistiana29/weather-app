import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import FormMasuk from '../components/auth/FormMasuk'
import JudulHalaman from '../components/JudulHalaman'
import KartuAuth from '../components/layout/KartuAuth'

// Halaman masuk pengguna umum (akun peringatan WhatsApp)
export default function Login() {
  const { t } = useTranslation()
  return (
    <KartuAuth
      judul={t('auth.login.judul')}
      subjudul={t('auth.login.subjudul')}
      kaki={
        <p>
          {t('auth.login.belumPunyaAkun')} <Link to="/register">{t('umum.nav.daftar')}</Link>
        </p>
      }
    >
      <JudulHalaman judul={t('auth.login.judul')} />
      <FormMasuk role="user" tampilLupa />
    </KartuAuth>
  )
}
