import { motion } from 'motion/react'
import { VARIAN_KARTU } from '../../lib/animasi'
import { JENIS_KEJADIAN } from '../../lib/kategori'
import Skeleton from '../ui/Skeleton'
import { IKON_PARAMETER } from './ikonCuaca'
import '../../styles/components/peta.css'

// Ubin jumlah kelurahan per jenis kejadian; klik untuk membuka parameternya di peta
export default function RingkasanKejadian({ ringkasan, memuat, totalKelurahan, parameterAktif, labelTanggal, onPilihParameter }) {
  return (
    <section className="ringkasan" aria-label={`Ringkasan ${labelTanggal}`} aria-busy={memuat}>
      <h2 className="ringkasan-judul">Ringkasan {labelTanggal}</h2>
      {JENIS_KEJADIAN.map((j) => {
        const Ikon = IKON_PARAMETER[j.parameter]
        const aktif = j.parameter === parameterAktif
        const jumlah = ringkasan?.[j.kunci]
        return (
          <motion.button
            key={j.kunci}
            type="button"
            variants={VARIAN_KARTU}
            className={`ubin ubin-${j.kunci} ${aktif ? 'aktif' : ''}`}
            aria-current={aktif ? 'true' : undefined}
            aria-label={memuat ? `${j.label}, memuat` : `${j.label}: ${jumlah} kelurahan. Tampilkan di peta`}
            onClick={() => onPilihParameter(j.parameter)}
          >
            <span className="ubin-kepala">
              <Ikon size={18} aria-hidden="true" />
              {j.labelPendek}
            </span>
            <span className="ubin-angka-baris">
              {memuat ? (
                <Skeleton width={56} height={40} radius={10} />
              ) : (
                <span className="angka-utama ubin-angka">{jumlah}</span>
              )}
              <span className="teks-sekunder ubin-satuan">kel.</span>
            </span>
            <span className="ubin-proporsi" aria-hidden="true">
              <span className="ubin-bar">
                <span style={{ width: memuat || !totalKelurahan ? 0 : `${(jumlah / totalKelurahan) * 100}%` }} />
              </span>
              <span className="teks-sekunder">dari {totalKelurahan || '–'} kelurahan</span>
            </span>
          </motion.button>
        )
      })}
    </section>
  )
}
