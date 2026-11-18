import { useTranslation } from 'react-i18next'
import Dialog from './ui/Dialog'

const POIN_KETENTUAN = ['prediksi', 'data', 'jadwal', 'kendali']

// Ringkasan Syarat & Kebijakan Privasi dalam dialog (dipakai form Daftar dan footer)
export default function DialogKetentuan({ open, onOpenChange }) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange} judul={t('auth.daftar.ketentuan.judul')}>
      <ul className="daftar-ketentuan">
        {POIN_KETENTUAN.map((kunci) => (
          <li key={kunci}>{t(`auth.daftar.ketentuan.${kunci}`)}</li>
        ))}
      </ul>
    </Dialog>
  )
}
