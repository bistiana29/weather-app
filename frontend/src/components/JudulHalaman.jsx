const NAMA_PRODUK = 'Pemetaan Cuaca Ekstrem Surabaya'

// Judul tab per halaman; React 19 memindahkan <title> dan <meta> ke <head>
export default function JudulHalaman({ judul, tanpaIndeks = false }) {
  return (
    <>
      <title>{judul ? `${judul} · ${NAMA_PRODUK}` : NAMA_PRODUK}</title>
      {tanpaIndeks && <meta name="robots" content="noindex" />}
    </>
  )
}
