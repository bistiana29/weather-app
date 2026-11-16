import { useTranslation } from 'react-i18next'

// Judul tab per halaman; React 19 memindahkan <title> dan <meta> ke <head>
export default function JudulHalaman({ judul, tanpaIndeks = false }) {
  const { t } = useTranslation()
  const nama = t('umum.namaProduk')
  return (
    <>
      <title>{judul ? `${judul} · ${nama}` : nama}</title>
      {tanpaIndeks && <meta name="robots" content="noindex" />}
    </>
  )
}
