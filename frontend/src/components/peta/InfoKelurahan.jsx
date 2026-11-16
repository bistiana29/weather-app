import { ArrowRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import '../../styles/components/peta.css'

// Isi pop-up kelurahan: nama, kategori, nilai beserta satuan, dan periode jam kejadian
export default function InfoKelurahan({ properti, data, parameter, memuat, modeTap, onTutup, onLihat }) {
  const { t } = useTranslation()
  const f = useFormat()
  const konfig = PARAMETER[parameter]
  const judulId = `info-${properti.kode_kel}`

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
          {konfig.skala ? (
            <Badge nada="netral">{t('peta.informasiNilai')}</Badge>
          ) : (
            <Badge warna={warnaKategori(parameter, data.kategori)}>{f.kategori(parameter, data.kategori)}</Badge>
          )}
          <p className="info-nilai">
            <span className="info-nilai-label">{t(konfig.jenisNilai === 'min' ? 'peta.minimum' : 'peta.puncak')}</span>
            <span className="angka-utama">{f.nilai(parameter, data.nilai)}</span>
            <span className="info-satuan">{f.satuan(parameter, data.nilai)}</span>
          </p>
          {!konfig.skala && (
            <p className="info-periode">
              {data.jam_mulai ? f.periode(data.jam_mulai, data.jam_selesai) : t('peta.tanpaPeriode')}
            </p>
          )}
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
