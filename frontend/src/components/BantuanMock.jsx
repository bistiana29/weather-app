import { Link } from 'react-router'
import { PAKAI_MOCK } from '../api/client'
import { AKUN_CONTOH, OTP_CONTOH, TOKEN_RESET_CONTOH } from '../mocks/akun'
import Badge from './ui/Badge'
import Pesan from './ui/Pesan'

// Petunjuk khusus mode data contoh; tidak dirender sama sekali saat VITE_USE_MOCK=false
export default function BantuanMock({ jenis, className }) {
  if (!PAKAI_MOCK) return null
  if (jenis === 'lencana') {
    return <Badge nada="info" className={className}>Data contoh</Badge>
  }
  if (jenis === 'akun') {
    return (
      <Pesan>
        Mode data contoh. Akun uji: {AKUN_CONTOH.map((a) => `${a.email} (${a.pengguna.role})`).join(', ')}, password{' '}
        <code>{AKUN_CONTOH[0].password}</code>.
      </Pesan>
    )
  }
  if (jenis === 'otp') {
    return (
      <Pesan>
        Mode data contoh: gunakan kode <code>{OTP_CONTOH}</code>.
      </Pesan>
    )
  }
  if (jenis === 'reset') {
    return (
      <Pesan>
        Mode data contoh: <Link to={`/reset-password?token=${TOKEN_RESET_CONTOH}`}>buka tautan reset contoh</Link>.
      </Pesan>
    )
  }
  return null
}
