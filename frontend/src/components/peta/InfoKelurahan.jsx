import { ArrowRight, Clock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import '../../styles/components/peta.css'

// Isi pop-up kelurahan: satu baris per parameter tercentang (pewarna di urutan pertama), masing-masing dengan periode jam kejadiannya sendiri
export default function InfoKelurahan({ properti, data, urutan, memuat, modeTap, onTutup, onLihat }) {
  const { t } = useTranslation()
  const f = useFormat()
  const judulId = `info-${properti.kode_kel}`
  const adaPeriode = urutan.some((slug) => data?.[PARAMETER[slug].slugUrl]?.jam_mulai)

  return (
    <section className="info-kelurahan" role={modeTap ? 'dialog' : 'tooltip'} aria-labelledby={judulId}>
      <div className="info-kepala">
        <div>
          <p id={judulId} className="info-nama">{t('peta.kel', { nama: properti.kelurahan })}</p>
          <p className="info-kecamatan">{t('peta.kec', { nama: properti.kecamatan })}</p>
        </div>
        {modeTap && (
          <button type="button" className="tombol-ikon info-tutup" aria-label={t('peta.info.tutup')} onClick={onTutup}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {memuat || !data ? (
        <p className="teks-sekunder info-memuat">{t('umum.memuat')}</p>
      ) : (
        <>
          <dl className="info-baris">
            {urutan.map((slug) => {
              const isi = data[PARAMETER[slug].slugUrl]
              return (
                <div key={slug} className="info-param">
                  <dt>{f.parameterLabel(slug)}</dt>
                  <dd className="info-param-isi">
                    <span className="info-param-nilai">{f.nilaiLengkap(slug, isi?.nilai)}</span>
                    <Badge warna={warnaKategori(slug, isi?.kategori)}>{f.kategori(slug, isi?.kategori)}</Badge>
                    {isi?.jam_mulai && (
                      <span className="info-param-periode">
                        <Clock size={13} aria-hidden="true" />
                        <span className="sr-only">{t('peta.info.waktu')}:</span>
                        {f.periode(isi.jam_mulai, isi.jam_selesai)}
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
          {!adaPeriode && <p className="info-tanpa-periode">{t('peta.tanpaPeriode')}</p>}
        </>
      )}

      {modeTap && (
        <Button ukuran="kecil" ikonKanan={ArrowRight} onClick={onLihat} className="info-tombol">
          {t('peta.info.lihat')}
        </Button>
      )}
    </section>
  )
}
