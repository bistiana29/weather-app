import { useQueries } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createElement, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getPrakiraan } from '../../api/publik'
import { useFormat } from '../../lib/format'
import { kategoriDari, masukPeringatan, warnaRisiko } from '../../lib/kategori'
import Skeleton from '../ui/Skeleton'
import { IKON_PARAMETER, ikonNilai } from './ikonCuaca'
import '../../styles/components/peta.css'

const GESER_PX = 300
const JAM_SKELETON = 12

// Jarak pandang selalu dalam km agar satu baris memakai satu satuan
function nilaiSel(f, parameter, nilai) {
  return parameter === 'jarak-pandang' ? f.angka(nilai / 1000, 1) : f.nilai(parameter, nilai)
}

// Deret 24 jam prakiraan, satu baris per parameter tercentang (pewarna di baris pertama), digeser bersama
export default function DeretPerJam({ kodeKel, namaKelurahan, color, params, tgl }) {
  const { t } = useTranslation()
  const f = useFormat()
  const gulirRef = useRef(null)
  const urutan = [color, ...params.filter((p) => p !== color)]
  const queries = useQueries({
    queries: urutan.map((p) => ({
      queryKey: ['prakiraan', kodeKel, p, tgl],
      queryFn: () => getPrakiraan(kodeKel, p, tgl),
      enabled: Boolean(kodeKel),
    })),
  })
  const prakiraan = Object.fromEntries(urutan.map((p, i) => [p, queries[i].data]))
  const memuat = !kodeKel
  const jam = urutan.map((p) => prakiraan[p]).find(Boolean)?.prediksi.map((titik) => titik.waktu.slice(11, 16))
  const lengkap = !memuat && urutan.every((p) => prakiraan[p])
  const kunciUrutan = urutan.join(',')

  // Geser otomatis ke jam kejadian ekstrem paling awal di semua baris saat data berganti
  useEffect(() => {
    const gulir = gulirRef.current
    if (!gulir || !lengkap) return
    const kiri = gulir.getBoundingClientRect().left + (gulir.querySelector('.deret-label')?.offsetWidth ?? 0)
    const posisi = [...gulir.querySelectorAll('.ekstrem')].map((el) => el.getBoundingClientRect().left - kiri + gulir.scrollLeft)
    gulir.scrollLeft = posisi.length ? Math.min(...posisi) - 8 : 0
  }, [lengkap, namaKelurahan, kunciUrutan])

  const geser = (arah) => gulirRef.current?.scrollBy({ left: arah * GESER_PX, behavior: 'smooth' })

  return (
    <section className="deret" aria-labelledby="deret-judul" aria-busy={!lengkap}>
      <div className="deret-kepala">
        <h2 id="deret-judul" className="deret-judul">
          {t('peta.jam.judul')}
          {namaKelurahan && <span className="teks-sekunder"> · {namaKelurahan}</span>}
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

      <div className="deret-gulir" ref={gulirRef}>
        <table className="deret-tabel">
          <caption className="sr-only">{t('peta.panel.perJam')}</caption>
          <thead>
            <tr>
              <th scope="col" className="deret-label">
                <span className="sr-only">{t('peta.parameter.label')}</span>
              </th>
              {(jam ?? Array.from({ length: JAM_SKELETON }, () => null)).map((j, i) => (
                <th key={j ?? i} scope="col" className="deret-waktu">
                  {j ? f.jam(j) : <Skeleton width={36} height={12} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {urutan.map((p) => {
              const data = !memuat && prakiraan[p]
              return (
                <tr key={p}>
                  <th scope="row" className="deret-label">
                    <span className="deret-label-nama">
                      {createElement(IKON_PARAMETER[p], { size: 16, 'aria-hidden': true })}
                      {f.parameterLabel(p)}
                    </span>
                    <span className="deret-label-satuan">{t(p === 'jarak-pandang' ? 'satuan.km' : `satuan.${p}`)}</span>
                  </th>
                  {data
                    ? data.prediksi.map((titik) => {
                        const kategori = kategoriDari(p, titik.nilai, { normal: data.normal })
                        const ekstrem = masukPeringatan(p, kategori)
                        return (
                          <td key={titik.waktu} className="deret-sel">
                            <div className={`deret-kotak ${ekstrem ? 'ekstrem' : ''}`}>
                              {createElement(ikonNilai(p, titik.nilai, Number(titik.waktu.slice(11, 13)), { normal: data.normal }), {
                                size: 20,
                                'aria-hidden': true,
                              })}
                              <span className="deret-nilai">{nilaiSel(f, p, titik.nilai)}</span>
                              <span className="deret-titik" style={{ background: warnaRisiko(p, { nilai: titik.nilai, kategori }) }} aria-hidden="true" />
                              {ekstrem && <span className="sr-only">{t('peta.jam.ekstrem')}</span>}
                            </div>
                          </td>
                        )
                      })
                    : Array.from({ length: jam?.length ?? JAM_SKELETON }, (_, i) => (
                        <td key={i} className="deret-sel" aria-hidden="true">
                          <div className="deret-kotak">
                            <Skeleton width={22} height={22} radius={8} />
                            <Skeleton width={32} height={16} />
                          </div>
                        </td>
                      ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
