import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import JudulHalaman from '../components/JudulHalaman'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

// Halaman untuk alamat yang tidak dikenal
export default function TidakDitemukan() {
  const { t } = useTranslation()
  return (
    <Card className="halaman-sementara">
      <JudulHalaman judul={t('umum.tidakDitemukan.judul')} />
      <h1>{t('umum.tidakDitemukan.judul')}</h1>
      <p className="teks-sekunder">{t('umum.tidakDitemukan.teks')}</p>
      <Button as={Link} to="/risk-map">{t('umum.tidakDitemukan.tombol')}</Button>
    </Card>
  )
}
