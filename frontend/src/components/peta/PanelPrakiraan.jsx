import { Cpu, RotateCw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { formatNilai, PARAMETER, satuanTampil, warnaKategori } from '../../lib/kategori'
import { formatPanjang } from '../../lib/tanggal'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Skeleton from '../ui/Skeleton'
import GrafikPrakiraan from './GrafikPrakiraan'
import { ikonNilai } from './ikonCuaca'
import '../../styles/components/peta.css'

const titikJam = (jam) => jam.replace(':', '.')

// Deret prakiraan per jam yang bisa digeser horizontal
function DeretPerJam({ parameter, prediksi, jamMulai, jamSelesai, normal }) {
  const daftarRef = useRef(null)
  const nilai = prediksi.map((t) => t.nilai)
  const puncak = PARAMETER[parameter].jenisNilai === 'min' ? Math.min(...nilai) : Math.max(...nilai)
  const jamPuncak = prediksi[nilai.indexOf(puncak)].waktu

  // Geser otomatis ke awal periode kejadian, atau ke jam puncak jika tidak ada kejadian
  useEffect(() => {
    const daftar = daftarRef.current
    const target = daftar?.querySelector('.kejadian') ?? daftar?.querySelector('[data-puncak]')
    if (daftar && target) daftar.scrollLeft = target.offsetLeft - daftar.offsetLeft - 8
  }, [jamMulai, jamPuncak])

  return (
    <ol className="deret-jam" ref={daftarRef} aria-label="Prediksi per jam">
      {prediksi.map((t) => {
        const jam = t.waktu.slice(11, 16)
        const Ikon = ikonNilai(parameter, t.nilai, Number(jam.slice(0, 2)), { normal })
        const kejadian = jamMulai && jam >= jamMulai && jam < jamSelesai
        return (
          <li key={t.waktu} className={`deret-jam-item ${kejadian ? 'kejadian' : ''}`} data-puncak={t.waktu === jamPuncak || undefined}>
            <span className="deret-jam-waktu">{titikJam(jam)}</span>
            <Ikon size={22} aria-hidden="true" />
            <span className="deret-jam-nilai">{formatNilai(parameter, t.nilai, { denganSatuan: false })}</span>
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
  const konfig = PARAMETER[parameter]
  const adaPeriode = Boolean(prakiraan?.jam_mulai)

  return (
    <div className="panel-prakiraan" aria-busy={memuat}>
      <div className="panel-kepala">
        {properti ? (
          <div>
            <p className="teks-sekunder panel-kecamatan">Kec. {properti.kecamatan}</p>
            <h2 className="panel-nama">Kel. {properti.kelurahan}</h2>
          </div>
        ) : (
          <div className="panel-kepala-skeleton" aria-hidden="true">
            <Skeleton width={110} height={14} />
            <Skeleton width={180} height={26} />
          </div>
        )}
        <button type="button" className="tombol-ikon" aria-label="Tutup panel prakiraan" onClick={onTutup}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {(memuat || !properti) && <PanelSkeleton />}

      {galat && !memuat && properti && (
        <div className="panel-galat" role="alert">
          <p>Prakiraan gagal dimuat.</p>
          <Button variant="sekunder" ukuran="kecil" ikon={RotateCw} onClick={onMuatUlang}>
            Coba lagi
          </Button>
        </div>
      )}

      {prakiraan && !memuat && properti && (
        <div className="panel-isi">
          <div className="panel-nilai">
            {konfig.skala ? (
              <Badge nada="netral">Informasi nilai</Badge>
            ) : (
              <Badge warna={warnaKategori(parameter, prakiraan.kategori)}>{prakiraan.kategori}</Badge>
            )}
            <p className="panel-angka">
              <span className="angka-utama">{formatNilai(parameter, prakiraan.nilai, { denganSatuan: false })}</span>
              <span className="panel-satuan">{satuanTampil(parameter, prakiraan.nilai)}</span>
            </p>
            <p className="teks-sekunder">
              {konfig.jenisNilai === 'min' ? 'Minimum' : 'Puncak'} {konfig.judul.toLowerCase()} ·{' '}
              {adaPeriode ? (
                <strong className="panel-periode">
                  {titikJam(prakiraan.jam_mulai)}–{titikJam(prakiraan.jam_selesai)} WIB
                </strong>
              ) : (
                'tidak ada periode kejadian'
              )}
            </p>
            {parameter === 'suhu' && prakiraan.normal != null && (
              <p className="teks-sekunder">Normal setempat {formatNilai('suhu', prakiraan.normal)}</p>
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
              Model aktif <strong>{prakiraan.model.nama}</strong> · versi <strong>{prakiraan.model.versi}</strong> · dibuat{' '}
              {formatPanjang(prakiraan.dibuat.slice(0, 10))} {titikJam(prakiraan.dibuat.slice(11, 16))} WIB
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
