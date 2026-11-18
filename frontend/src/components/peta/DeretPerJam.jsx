import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { kategoriDari, masukPeringatan, warnaRisiko } from '../../lib/kategori'
import Skeleton from '../ui/Skeleton'
import { ikonNilai } from './ikonCuaca'
import '../../styles/components/peta.css'

const GESER_PX = 300

// Deret 24 jam prakiraan parameter pewarna untuk kelurahan terpilih, bisa digeser horizontal
export default function DeretPerJam({ namaKelurahan, parameter, prakiraan, memuat }) {
  const { t } = useTranslation()
  const f = useFormat()
  const daftarRef = useRef(null)
  const normal = prakiraan?.normal

  // Geser otomatis ke jam kejadian ekstrem pertama saat data berganti
  useEffect(() => {
    const daftar = daftarRef.current
    const target = daftar?.querySelector('.ekstrem')
    if (daftar) daftar.scrollLeft = target ? target.offsetLeft - daftar.offsetLeft - 8 : 0
  }, [prakiraan])

  const geser = (arah) => daftarRef.current?.scrollBy({ left: arah * GESER_PX, behavior: 'smooth' })

  return (
    <section className="deret" aria-labelledby="deret-judul" aria-busy={memuat}>
      <div className="deret-kepala">
        <h2 id="deret-judul" className="deret-judul">
          {t('peta.jam.judul')}
          {namaKelurahan && <span className="teks-sekunder"> · {namaKelurahan} · {f.parameterLabel(parameter)}</span>}
        </h2>
        <div className="deret-geser">
          <button type="button" className="tombol-ikon" aria-label={t('peta.jam.sebelumnya')} onClick={() => geser(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="tombol-ikon" aria-label={t('peta.jam.berikutnya')} onClick={() => geser(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ol className="deret-jam" ref={daftarRef} aria-label={t('peta.panel.perJam')}>
        {memuat || !prakiraan
          ? Array.from({ length: 12 }, (_, i) => (
              <li key={i} className="deret-jam-item" aria-hidden="true">
                <Skeleton width={36} height={12} />
                <Skeleton width={24} height={24} radius={8} />
                <Skeleton width={32} height={16} />
              </li>
            ))
          : prakiraan.prediksi.map((titik) => {
              const jam = titik.waktu.slice(11, 16)
              const kategori = kategoriDari(parameter, titik.nilai, { normal })
              const ekstrem = masukPeringatan(parameter, kategori)
              const Ikon = ikonNilai(parameter, titik.nilai, Number(jam.slice(0, 2)), { normal })
              return (
                <li key={titik.waktu} className={`deret-jam-item ${ekstrem ? 'ekstrem' : ''}`}>
                  <span className="deret-jam-waktu">{f.jam(jam)}</span>
                  <Ikon size={22} aria-hidden="true" />
                  <span className="deret-jam-nilai">{f.nilai(parameter, titik.nilai)}</span>
                  <span className="deret-jam-titik" style={{ background: warnaRisiko(parameter, { nilai: titik.nilai, kategori }) }} aria-hidden="true" />
                  {ekstrem && <span className="sr-only">{t('peta.jam.ekstrem')}</span>}
                </li>
              )
            })}
      </ol>
    </section>
  )
}
