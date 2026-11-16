import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { kunciKategori } from './kategori'
import { keDate } from './tanggal'

const LOKAL = { id: 'id-ID', en: 'en-US' }
const ZONA = 'Asia/Jakarta'

// Kumpulan fungsi format angka, satuan, tanggal, jam, dan label yang mengikuti bahasa aktif
export function buatFormat(t, bahasa) {
  const kode = LOKAL[bahasa] ?? LOKAL.id
  const tanggal = (opsi) => (iso) => new Intl.DateTimeFormat(kode, opsi).format(keDate(iso))

  const angka = (n, desimal = 0) => (n == null ? '–' : Number(n).toLocaleString(kode, { maximumFractionDigits: desimal }))

  const nilai = (parameter, n) => {
    if (n == null) return '–'
    if (parameter === 'jarak-pandang') return n >= 1000 ? angka(n / 1000, 1) : angka(Math.round(n))
    return angka(n, parameter === 'hujan' || parameter === 'suhu' ? 1 : 0)
  }

  const satuan = (parameter, n) => {
    if (parameter === 'jarak-pandang') return t(n >= 1000 ? 'satuan.km' : 'satuan.m')
    return t(`satuan.${parameter}`)
  }

  const jam = (hhmm) => (bahasa === 'en' ? hhmm : hhmm.replace(':', '.'))

  return {
    bahasa,
    angka,
    nilai,
    satuan,
    nilaiLengkap: (parameter, n) => (n == null ? '–' : `${nilai(parameter, n)} ${satuan(parameter, n)}`),
    kategori: (parameter, label) => {
      const kunci = kunciKategori(parameter, label)
      return kunci ? t(`kategori.${kunci}`) : label
    },
    rentang: ({ kunci, nilai: isi }) => t(`rentang.${kunci}`, Object.fromEntries(Object.entries(isi).map(([k, v]) => [k, angka(v)]))),
    parameterLabel: (parameter) => t(`parameter.${parameter}.label`),
    parameterJudul: (parameter) => t(`parameter.${parameter}.judul`),
    jam,
    periode: (mulai, selesai) => t('umum.periodeWib', { mulai: jam(mulai), selesai: jam(selesai) }),
    tanggalPanjang: tanggal({ weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    tanggalRingkas: tanggal({ day: 'numeric', month: 'short' }),
    tanggalAngka: tanggal({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    hariPendek: tanggal({ weekday: 'short' }),
    bulanTahun: (tahun, bulan) => new Intl.DateTimeFormat(kode, { month: 'long', year: 'numeric' }).format(new Date(tahun, bulan, 1)),
    waktuWib: (iso) =>
      iso
        ? `${new Intl.DateTimeFormat(kode, { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))} WIB`
        : '–',
  }
}

export function useFormat() {
  const { t, i18n } = useTranslation()
  return useMemo(() => buatFormat(t, i18n.language), [t, i18n.language])
}
