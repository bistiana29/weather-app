import { Cpu, RotateCw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER, warnaKategori } from '../../lib/kategori'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Skeleton from '../ui/Skeleton'
import GrafikPrakiraan from './GrafikPrakiraan'
import { ikonNilai } from './ikonCuaca'
import '../../styles/components/peta.css'

// Deret prakiraan per jam yang bisa digeser horizontal
function DeretPerJam({ parameter, prediksi, jamMulai, jamSelesai, normal }) {
  const { t } = useTranslation()
  const f = useFormat()
  const daftarRef = useRef(null)
  const nilai = prediksi.map((titik) => titik.nilai)
  const puncak = PARAMETER[parameter].jenisNilai === 'min' ? Math.min(...nilai) : Math.max(...nilai)
  const jamPuncak = prediksi[nilai.indexOf(puncak)].waktu

  // Geser otomatis ke awal periode kejadian, atau ke jam puncak jika tidak ada kejadian
  useEffect(() => {
    const daftar = daftarRef.current
    const target = daftar?.querySelector('.kejadian') ?? daftar?.querySelector('[data-puncak]')
    if (daftar && target) daftar.scrollLeft = target.offsetLeft - daftar.offsetLeft - 8
  }, [jamMulai, jamPuncak])

  return (
    <ol className="deret-jam" ref={daftarRef} aria-label={t('peta.panel.perJam')}>
      {prediksi.map((titik) => {
        const jam = titik.waktu.slice(11, 16)
        const Ikon = ikonNilai(parameter, titik.nilai, Number(jam.slice(0, 2)), { normal })
        const kejadian = jamMulai && jam >= jamMulai && jam < jamSelesai
        return (
          <li key={titik.waktu} className={`deret-jam-item ${kejadian ? 'kejadian' : ''}`} data-puncak={titik.waktu === jamPuncak || undefined}>
            <span className="deret-jam-waktu">{f.jam(jam)}</span>
            <Ikon size={22} aria-hidden="true" />
            <span className="deret-jam-nilai">{f.nilai(parameter, titik.nilai)}</span>
          </li>
        )
      })}
    </ol>
  )
}

// Kerangka panel saat data prakiraan dimuat
function PanelSkeleton() {
  return (
    <div className="panel-isi" aria-hidden="true">
      <div className="panel-nilai">
        <Skeleton width={140} height={26} radius={999} />
        <Skeleton width={160} height={56} radius={12} />
        <Skeleton width={190} height={18} />
      </div>
      <div className="deret-jam">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} width={64} height={96} radius={18} style={{ flexShrink: 0 }} />
        ))}
      </div>
      <div className="grafik">
        <Skeleton width="70%" height={16} />
        <Skeleton className="grafik-area" height="auto" radius={16} />
      </div>
      <Skeleton width="85%" height={16} />
    </div>
  )
}

// Panel prakiraan satu kelurahan: kategori, nilai puncak, periode, grafik, info model
export default function PanelPrakiraan({ properti, parameter, prakiraan, memuat, galat, onMuatUlang, onTutup }) {
  const { t } = useTranslation()
  const f = useFormat()
  const konfig = PARAMETER[parameter]
  const adaPeriode = Boolean(prakiraan?.jam_mulai)

  return (
    <div className="panel-prakiraan" aria-busy={memuat}>
      <div className="panel-kepala">
        {properti ? (
          <div>
            <p className="teks-sekunder panel-kecamatan">{t('peta.kec', { nama: properti.kecamatan })}</p>
            <h2 className="panel-nama">{t('peta.kel', { nama: properti.kelurahan })}</h2>
          </div>
        ) : (
          <div className="panel-kepala-skeleton" aria-hidden="true">
            <Skeleton width={110} height={14} />
            <Skeleton width={180} height={26} />
          </div>
        )}
        <button type="button" className="tombol-ikon" aria-label={t('peta.panel.tutup')} onClick={onTutup}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {(memuat || !properti) && <PanelSkeleton />}

      {galat && !memuat && properti && (
        <div className="panel-galat" role="alert">
          <p>{t('peta.panel.gagal')}</p>
          <Button variant="sekunder" ukuran="kecil" ikon={RotateCw} onClick={onMuatUlang}>
            {t('umum.cobaLagi')}
          </Button>
        </div>
      )}

      {prakiraan && !memuat && properti && (
        <div className="panel-isi">
          <div className="panel-nilai">
            {konfig.skala ? (
              <Badge nada="netral">{t('peta.informasiNilai')}</Badge>
            ) : (
              <Badge warna={warnaKategori(parameter, prakiraan.kategori)}>{f.kategori(parameter, prakiraan.kategori)}</Badge>
            )}
            <p className="panel-angka">
              <span className="angka-utama">{f.nilai(parameter, prakiraan.nilai)}</span>
              <span className="panel-satuan">{f.satuan(parameter, prakiraan.nilai)}</span>
            </p>
            <p className="teks-sekunder">
              {t(konfig.jenisNilai === 'min' ? 'peta.panel.minimumDari' : 'peta.panel.puncakDari', { parameter: f.parameterJudul(parameter) })} ·{' '}
              {adaPeriode ? (
                <strong className="panel-periode">{f.periode(prakiraan.jam_mulai, prakiraan.jam_selesai)}</strong>
              ) : (
                t('peta.tanpaPeriode')
              )}
            </p>
            {parameter === 'suhu' && prakiraan.normal != null && (
              <p className="teks-sekunder">{t('peta.panel.normal', { nilai: f.nilaiLengkap('suhu', prakiraan.normal) })}</p>
            )}
          </div>

          <DeretPerJam
            parameter={parameter}
            prediksi={prakiraan.prediksi}
            jamMulai={prakiraan.jam_mulai}
            jamSelesai={prakiraan.jam_selesai}
            normal={prakiraan.normal}
          />

          <GrafikPrakiraan
            parameter={parameter}
            observasi={prakiraan.observasi}
            prediksi={prakiraan.prediksi}
            ambang={prakiraan.ambang}
          />

          <p className="panel-model">
            <Cpu size={16} aria-hidden="true" />
            <span>
              <Trans
                i18nKey="peta.panel.model"
                values={{
                  nama: prakiraan.model.nama,
                  versi: prakiraan.model.versi,
                  tanggal: f.tanggalPanjang(prakiraan.dibuat.slice(0, 10)),
                  jam: f.jam(prakiraan.dibuat.slice(11, 16)),
                }}
                components={{ tebal: <strong /> }}
              />
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
