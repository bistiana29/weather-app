import { useQuery } from '@tanstack/react-query'
import { BellOff, MapPinned, MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getRisiko } from '../../api/publik'
import { susunPesan } from '../../lib/pesanWa'
import BantuanMock from '../BantuanMock'
import PesanWA, { PesanWASkeleton } from '../PesanWA'
import '../../styles/components/pengaturan.css'

// Pratinjau pesan peringatan WA berdasarkan pilihan saat ini (belum tentu tersimpan)
export default function SimulasiPesan({ memuatPengaturan, aktif, pantauan, indeksKelurahan, tgl }) {
  const { t, i18n } = useTranslation()
  const risikoQuery = useQuery({ queryKey: ['risiko', tgl], queryFn: () => getRisiko(tgl) })
  const memuat = memuatPengaturan || risikoQuery.isPending || !Object.keys(indeksKelurahan).length
  const pesan = memuat || !pantauan.length ? null : susunPesan(risikoQuery.data, pantauan, indeksKelurahan, tgl)

  return (
    <section className="simulasi" aria-labelledby="simulasi-judul" aria-busy={memuat}>
      <div className="simulasi-kepala">
        <h2 id="simulasi-judul">
          <MessageSquareText size={20} aria-hidden="true" />
          {t('pengaturan.simulasi.judul')}
        </h2>
        <BantuanMock jenis="lencana" />
      </div>
      <p className="teks-sekunder simulasi-catatan">{t('pengaturan.simulasi.catatan')}</p>
      {i18n.language !== 'id' && <p className="teks-sekunder simulasi-catatan">{t('landing.wa.catatanBahasa')}</p>}

      <div className="simulasi-layar">
        {memuatPengaturan && <PesanWASkeleton />}
        {!memuatPengaturan && !aktif && (
          <p className="simulasi-kosong">
            <BellOff size={20} aria-hidden="true" />
            {t('pengaturan.simulasi.nonaktif')}
          </p>
        )}
        {!memuatPengaturan && aktif && !pantauan.length && (
          <p className="simulasi-kosong">
            <MapPinned size={20} aria-hidden="true" />
            {t('pengaturan.simulasi.kosong')}
          </p>
        )}
        {!memuatPengaturan && aktif && pantauan.length > 0 && memuat && <PesanWASkeleton />}
        {aktif && pesan && <PesanWA pesan={pesan} tgl={tgl} />}
      </div>
    </section>
  )
}
