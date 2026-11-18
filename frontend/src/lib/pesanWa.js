import { JENIS_KEJADIAN, masukPeringatan, risikoParameter, urlPeta } from './kategori'

const PARAMETER_PERINGATAN = JENIS_KEJADIAN.map((j) => j.parameter)

// Susun isi pesan WA dari risiko gabungan: kejadian per kelurahan pantauan, jumlah kelurahan lain berisiko, dan tautan peta
export function susunPesan(gabungan, pantauan, indeksKelurahan, tgl) {
  const perParameter = Object.fromEntries(PARAMETER_PERINGATAN.map((p) => [p, risikoParameter(gabungan, p) ?? {}]))
  const kelurahan = pantauan.map((kode) => ({
    kode,
    nama: indeksKelurahan[kode]?.kelurahan ?? kode,
    kejadian: PARAMETER_PERINGATAN.filter((p) => masukPeringatan(p, perParameter[p][kode]?.kategori)).map((p) => ({
      parameter: p,
      ...perParameter[p][kode],
    })),
  }))
  const lainnya = new Set()
  PARAMETER_PERINGATAN.forEach((p) =>
    Object.entries(perParameter[p]).forEach(([kode, data]) => {
      if (!pantauan.includes(kode) && masukPeringatan(p, data.kategori)) lainnya.add(kode)
    }),
  )
  const pertama = kelurahan.find((k) => k.kejadian.length)
  const tautan = urlPeta({ color: pertama?.kejadian[0].parameter ?? 'hujan', kel: pertama?.kode ?? pantauan[0], date: tgl })
  return { kelurahan, jumlahLainnya: lainnya.size, tautan }
}
