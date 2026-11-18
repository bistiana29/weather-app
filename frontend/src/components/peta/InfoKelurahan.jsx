import { ArrowRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import '../../styles/components/peta.css'

// Isi pop-up kelurahan: satu baris per parameter tercentang (pewarna di urutan pertama) dan periode jam pewarna
export default function InfoKelurahan({ properti, data, urutan, memuat, modeTap, onTutup, onLihat }) {
  const { t } = useTranslation()
  const f = useFormat()
  const judulId = `info-${properti.kode_kel}`
  const pewarna = data?.[PARAMETER[urutan[0]].slugUrl]

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
        <dl className="info-baris">
          {urutan.map((slug) => {
            const isi = data[PARAMETER[slug].slugUrl]
            return (
              <div key={slug} className="info-param">
                <dt>{f.parameterLabel(slug)}</dt>
                <dd className="info-param-isi">
                  <span className="info-param-nilai">{f.nilaiLengkap(slug, isi?.nilai)}</span>
                  <Badge warna={warnaKategori(slug, isi?.kategori)}>{f.kategori(slug, isi?.kategori)}</Badge>
                </dd>
              </div>
            )
          })}
          <div className="info-param info-waktu">
            <dt>{t('peta.info.waktu')}</dt>
            <dd>{pewarna?.jam_mulai ? f.periode(pewarna.jam_mulai, pewarna.jam_selesai) : t('peta.tanpaPeriode')}</dd>
          </div>
        </dl>
      )}

      {modeTap && (
        <Button ukuran="kecil" ikonKanan={ArrowRight} onClick={onLihat} className="info-tombol">
          {t('peta.info.lihat')}
        </Button>
      )}
    </section>
  )
}
