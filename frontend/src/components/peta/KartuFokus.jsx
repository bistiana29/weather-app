import { ChartLine, X } from 'lucide-react'
import { createElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Skeleton from '../ui/Skeleton'
import { ikonNilai } from './ikonCuaca'
import '../../styles/components/peta.css'

// Kerangka kartu fokus saat data dimuat
function FokusSkeleton() {
  return (
    <div className="fokus" aria-hidden="true">
      <Skeleton width={120} height={14} />
      <Skeleton width={190} height={26} />
      <Skeleton width={170} height={64} radius={12} />
      <Skeleton width={140} height={26} radius={999} />
      <div className="fokus-chip-daftar">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={48} radius={14} />
        ))}
      </div>
    </div>
  )
}

// Kartu kelurahan terpilih: nilai besar parameter pewarna, kategori, periode, chip parameter lain, tombol grafik
export default function KartuFokus({ properti, data, color, params, alasan, dipilih, memuat, onTutup, onGrafik }) {
  const { t } = useTranslation()
  const f = useFormat()
  if (memuat || !properti || !data) return <FokusSkeleton />

  const utama = data[PARAMETER[color].slugUrl]
  const lainnya = params.filter((p) => p !== color)

  return (
    <article className="fokus" aria-labelledby="fokus-nama">
      <div className="fokus-kepala">
        <div className="fokus-nama-blok">
          <p className="fokus-alasan">{dipilih ? t('peta.kec', { nama: properti.kecamatan }) : t(`peta.fokus.${alasan}`)}</p>
          <h2 id="fokus-nama" className="fokus-nama">{t('peta.kel', { nama: properti.kelurahan })}</h2>
          {!dipilih && <p className="teks-sekunder fokus-kec">{t('peta.kec', { nama: properti.kecamatan })}</p>}
        </div>
        {dipilih && (
          <button type="button" className="tombol-ikon" aria-label={t('peta.fokus.tutup')} onClick={onTutup}>
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="fokus-nilai">
        <p className="fokus-angka">
          <span className="angka-utama">{f.nilai(color, utama.nilai)}</span>
          <span className="fokus-satuan">{f.satuan(color, utama.nilai)}</span>
        </p>
        {createElement(ikonNilai(color, utama.nilai, 13), { size: 40, strokeWidth: 1.5, 'aria-hidden': true, className: 'fokus-ikon' })}
      </div>
      <div className="fokus-kategori">
        <Badge warna={warnaKategori(color, utama.kategori)}>{f.kategori(color, utama.kategori)}</Badge>
        <span className="teks-sekunder">
          {t(PARAMETER[color].jenisNilai === 'min' ? 'peta.panel.minimumDari' : 'peta.panel.puncakDari', { parameter: f.parameterJudul(color) })}
          {' · '}
          {utama.jam_mulai ? <strong className="fokus-periode">{f.periode(utama.jam_mulai, utama.jam_selesai)}</strong> : t('peta.tanpaPeriode')}
        </span>
      </div>

      {lainnya.length > 0 && (
        <ul className="fokus-chip-daftar" aria-label={t('peta.fokus.lainnya')}>
          {lainnya.map((p) => {
            const isi = data[PARAMETER[p].slugUrl]
            return (
              <li key={p} className="fokus-chip">
                <span className="fokus-chip-label">
                  <span className="fokus-chip-titik" style={{ background: warnaKategori(p, isi.kategori) }} aria-hidden="true" />
                  {f.parameterLabel(p)}
                </span>
                <span className="fokus-chip-nilai">{f.nilaiLengkap(p, isi.nilai)}</span>
                <span className="teks-sekunder fokus-chip-kategori">{f.kategori(p, isi.kategori)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <Button variant="sekunder" ikon={ChartLine} onClick={onGrafik} className="fokus-tombol">
        {t('peta.fokus.grafik')}
      </Button>
    </article>
  )
}
