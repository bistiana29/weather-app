import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PAKAI_MOCK } from '../api/client'
import { AKUN_CONTOH, OTP_CONTOH, TOKEN_RESET_CONTOH } from '../mocks/akun'
import Badge from './ui/Badge'
import Pesan from './ui/Pesan'

// Petunjuk khusus mode data contoh; tidak dirender sama sekali saat VITE_USE_MOCK=false
export default function BantuanMock({ jenis, className }) {
  const { t } = useTranslation()
  if (!PAKAI_MOCK) return null
  if (jenis === 'lencana') {
    return <Badge nada="info" className={className}>{t('umum.dataContoh')}</Badge>
  }
  if (jenis === 'akun-user' || jenis === 'akun-admin') {
    const akun = AKUN_CONTOH.find((a) => a.pengguna.role === (jenis === 'akun-admin' ? 'admin' : 'user'))
    return (
      <Pesan>
        <Trans i18nKey="mock.akun" values={{ email: akun.email, password: akun.password }} components={{ kode: <code /> }} />
      </Pesan>
    )
  }
  if (jenis === 'otp') {
    return (
      <Pesan>
        <Trans i18nKey="mock.otp" values={{ kode: OTP_CONTOH }} components={{ kode: <code /> }} />
      </Pesan>
    )
  }
  if (jenis === 'reset') {
    return (
      <Pesan>
        <Trans i18nKey="mock.reset" components={{ tautan: <Link to={`/reset-password?token=${TOKEN_RESET_CONTOH}`} /> }} />
      </Pesan>
    )
  }
  return null
}
