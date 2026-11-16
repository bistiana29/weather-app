// Teks galat dari kode API/mock lewat kamus `galat.*`; jatuh ke pesan server lalu pesan umum
export function teksGalat(t, err) {
  if (err?.kode) return t(`galat.${err.kode}`, { defaultValue: err.message || t('galat.umum') })
  return err?.message || t('galat.umum')
}
