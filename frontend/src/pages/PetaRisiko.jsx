import { useQuery } from '@tanstack/react-query'
import { BellRing, CalendarClock, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { getKelurahanGeojson, getPrakiraan, getRingkasan, getRisiko } from '../api/publik'
import BantuanMock from '../components/BantuanMock'
import BottomSheet from '../components/peta/BottomSheet'
import PanelPrakiraan from '../components/peta/PanelPrakiraan'
import PetaKelurahan from '../components/peta/PetaKelurahan'
import RingkasanKejadian from '../components/peta/RingkasanKejadian'
import SorotanKelurahan from '../components/peta/SorotanKelurahan'
import TabParameter from '../components/peta/TabParameter'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import DatePicker from '../components/ui/DatePicker'
import SearchInput from '../components/ui/SearchInput'
import Skeleton from '../components/ui/Skeleton'
import { Tabs, TabsContent } from '../components/ui/Tabs'
import { VARIAN_GRID, VARIAN_KARTU } from '../lib/animasi'
import { useAuth } from '../lib/auth'
import { parameterValid } from '../lib/kategori'
import { formatPanjang, formatRingkas, hariIniWib, isoValid, tambahHari } from '../lib/tanggal'
import { MEDIA, useMediaQuery } from '../lib/useMediaQuery'
import '../styles/pages/PetaRisiko.css'

const RENTANG_HARI_LALU = 30

function labelTanggal(tgl, hariIni) {
  if (tgl === tambahHari(hariIni, 1)) return 'esok hari'
  if (tgl === hariIni) return 'hari ini'
  return formatRingkas(tgl)
}

// Kartu ajakan aktifkan peringatan WA (tamu) atau info jadwal pembaruan (sudah login)
function KartuPeringatan({ pengguna }) {
  if (!pengguna) {
    return (
      <Card variant="sorotan" className="kartu-peringatan">
        <div className="kartu-peringatan-teks">
          <h2>
            <BellRing size={22} aria-hidden="true" />
            Mau diingatkan lewat WhatsApp?
          </h2>
          <p>Buat akun, verifikasi nomor, lalu pilih hingga 3 kelurahan. Peringatan dikirim pukul 12.00 WIB sehari sebelumnya.</p>
        </div>
        <Button as={Link} to="/daftar" variant="terang">
          Aktifkan Peringatan
        </Button>
      </Card>
    )
  }
  const tautan = pengguna.role === 'admin' ? { to: '/admin', label: 'Buka Panel Admin' } : { to: '/pengaturan', label: 'Atur kelurahan pantauan' }
  return (
    <Card className="kartu-peringatan">
      <div className="kartu-peringatan-teks">
        <h2>
          <CalendarClock size={22} aria-hidden="true" />
          Jadwal pembaruan
        </h2>
        <p className="teks-sekunder">Prediksi diperbarui setiap hari pukul 12.00 WIB untuk periode esok hari 00.00–23.59 WIB.</p>
      </div>
      <Button as={Link} to={tautan.to} variant="sekunder">
        {tautan.label}
      </Button>
    </Card>
  )
}

// Halaman Peta Risiko: tab parameter, peta choropleth, ringkasan, dan panel prakiraan
export default function PetaRisiko() {
  const { parameter } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pengguna } = useAuth()
  const mobile = useMediaQuery(MEDIA.mobile)
  const [cariTerbuka, setCariTerbuka] = useState(false)

  const hariIni = hariIniWib()
  const besok = tambahHari(hariIni, 1)
  const tglMin = tambahHari(hariIni, -RENTANG_HARI_LALU)
  const tglUrl = searchParams.get('tgl')
  const tgl = isoValid(tglUrl) && tglUrl >= tglMin && tglUrl <= besok ? tglUrl : besok
  const kelUrl = searchParams.get('kel')
  const parameterOk = parameterValid(parameter)

  const geojsonQuery = useQuery({
    queryKey: ['geojson'],
    queryFn: getKelurahanGeojson,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const indeksKelurahan = useMemo(
    () => Object.fromEntries((geojsonQuery.data?.features ?? []).map((f) => [f.properties.kode_kel, f.properties])),
    [geojsonQuery.data],
  )
  const itemCari = useMemo(
    () =>
      Object.values(indeksKelurahan)
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: `Kec. ${p.kecamatan}` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeksKelurahan],
  )
  const kel = indeksKelurahan[kelUrl] ? kelUrl : null
  const kelMenunggu = Boolean(kelUrl) && geojsonQuery.isPending

  const risikoQuery = useQuery({
    queryKey: ['risiko', parameter, tgl],
    queryFn: () => getRisiko(parameter, tgl),
    enabled: parameterOk,
  })
  const ringkasanQuery = useQuery({
    queryKey: ['ringkasan', tgl],
    queryFn: () => getRingkasan(tgl),
  })
  const prakiraanQuery = useQuery({
    queryKey: ['prakiraan', kel, parameter, tgl],
    queryFn: () => getPrakiraan(kel, parameter, tgl),
    enabled: parameterOk && Boolean(kel),
  })

  // Tulis tanggal default ke URL agar tautan selalu lengkap
  useEffect(() => {
    if (tglUrl !== tgl) {
      setSearchParams(
        (lama) => {
          const baru = new URLSearchParams(lama)
          baru.set('tgl', tgl)
          return baru
        },
        { replace: true },
      )
    }
  }, [tglUrl, tgl, setSearchParams])

  if (!parameterOk) {
    return <Navigate to={{ pathname: '/peta-risiko/hujan', search: searchParams.toString() }} replace />
  }

  function ubahQuery(ubah) {
    setSearchParams(
      (lama) => {
        const baru = new URLSearchParams(lama)
        ubah(baru)
        return baru
      },
      { replace: true },
    )
  }

  const pilihKelurahan = (kode) => ubahQuery((q) => q.set('kel', kode))
  const tutupPanel = () => ubahQuery((q) => q.delete('kel'))
  const gantiTanggal = (t) => ubahQuery((q) => q.set('tgl', t))
  const gantiParameter = (p) => navigate({ pathname: `/peta-risiko/${p}`, search: searchParams.toString() })

  const label = labelTanggal(tgl, hariIni)
  const panelPrakiraan = (kel || kelMenunggu) && (
    <PanelPrakiraan
      properti={indeksKelurahan[kel]}
      parameter={parameter}
      prakiraan={prakiraanQuery.data}
      memuat={prakiraanQuery.isPending}
      galat={prakiraanQuery.isError}
      onMuatUlang={() => prakiraanQuery.refetch()}
      onTutup={tutupPanel}
    />
  )
  const sorotan = (
    <SorotanKelurahan
      risiko={risikoQuery.data}
      indeksKelurahan={indeksKelurahan}
      parameter={parameter}
      memuat={risikoQuery.isPending || geojsonQuery.isPending}
      labelTanggal={label}
      onPilih={pilihKelurahan}
    />
  )
  const kolomCari = (
    <SearchInput
      items={itemCari}
      onSelect={(item) => {
        pilihKelurahan(item.value)
        setCariTerbuka(false)
      }}
      placeholder="Cari kelurahan…"
      label="Cari kelurahan"
      autoFocus={mobile}
      className="peta-cari"
    />
  )

  return (
    <div className="peta-halaman">
      <header className="peta-kepala">
        <div className="peta-judul">
          <h1>Peta Risiko</h1>
          <p className="teks-sekunder">
            Prediksi {formatPanjang(tgl)} · 00.00–23.59 WIB
            <BantuanMock jenis="lencana" className="badge-mock" />
          </p>
        </div>
        <div className="peta-kontrol">
          {mobile ? (
            <button
              type="button"
              className="tombol-ikon tombol-cari-mobile"
              aria-label={cariTerbuka ? 'Tutup pencarian' : 'Cari kelurahan'}
              aria-expanded={cariTerbuka}
              onClick={() => setCariTerbuka((v) => !v)}
            >
              {cariTerbuka ? <X size={20} aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
            </button>
          ) : (
            kolomCari
          )}
          <DatePicker value={tgl} onChange={gantiTanggal} min={tglMin} max={besok} label="Tanggal prediksi" ringkas={mobile} />
        </div>
        {mobile && cariTerbuka && kolomCari}
      </header>

      <Tabs value={parameter} onValueChange={gantiParameter}>
        <TabParameter />

        <TabsContent value={parameter}>
          <motion.div className="bento" variants={VARIAN_GRID} initial="awal" animate="tampil">
            <motion.div variants={VARIAN_KARTU} className="bento-peta">
              <Card className="kartu-peta">
                {geojsonQuery.data ? (
                  <PetaKelurahan
                    geojson={geojsonQuery.data}
                    risiko={risikoQuery.data}
                    parameter={parameter}
                    tgl={tgl}
                    terpilih={kel}
                    onPilih={pilihKelurahan}
                    memuatRisiko={risikoQuery.isPending}
                  />
                ) : geojsonQuery.isError ? (
                  <div className="peta-galat" role="alert">
                    <p>Batas kelurahan gagal dimuat.</p>
                    <Button variant="sekunder" ukuran="kecil" onClick={() => geojsonQuery.refetch()}>
                      Coba lagi
                    </Button>
                  </div>
                ) : (
                  <Skeleton className="peta-skeleton" height="100%" radius={20} />
                )}
              </Card>
            </motion.div>

            <motion.div variants={VARIAN_KARTU} className="bento-panel">
              <Card className="kartu-panel">
                {mobile ? (
                  sorotan
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={kel || kelMenunggu ? 'panel' : 'sorotan'}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {panelPrakiraan || sorotan}
                    </motion.div>
                  </AnimatePresence>
                )}
              </Card>
            </motion.div>

            <RingkasanKejadian
              ringkasan={ringkasanQuery.data}
              memuat={ringkasanQuery.isPending}
              totalKelurahan={itemCari.length}
              parameterAktif={parameter}
              labelTanggal={label}
              onPilihParameter={gantiParameter}
            />

            <motion.div variants={VARIAN_KARTU} className="bento-peringatan">
              <KartuPeringatan pengguna={pengguna} />
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>

      <p className="peta-disclaimer">Hasil prediksi model, bukan peringatan resmi BMKG.</p>

      {mobile && (
        <BottomSheet terbuka={Boolean(kel || kelMenunggu)} label="Panel prakiraan kelurahan" onTutup={tutupPanel}>
          {panelPrakiraan}
        </BottomSheet>
      )}
    </div>
  )
}
