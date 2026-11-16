import { useQuery } from '@tanstack/react-query'
import { BellRing, CalendarClock, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { getKelurahanGeojson, getPrakiraan, getRingkasan, getRisiko } from '../api/publik'
import BantuanMock from '../components/BantuanMock'
import JudulHalaman from '../components/JudulHalaman'
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
import { useFormat } from '../lib/format'
import { PARAMETER, parameterDariUrl } from '../lib/kategori'
import { hariIniWib, isoValid, tambahHari } from '../lib/tanggal'
import { MEDIA, useMediaQuery } from '../lib/useMediaQuery'
import '../styles/pages/PetaRisiko.css'

const RENTANG_HARI_LALU = 30

// Label tanggal relatif ("esok hari", "hari ini") atau tanggal ringkas
function labelTanggal(tgl, hariIni, t, f) {
  if (tgl === tambahHari(hariIni, 1)) return t('peta.esokHari')
  if (tgl === hariIni) return t('peta.hariIni')
  return f.tanggalRingkas(tgl)
}

// Kartu ajakan aktifkan peringatan WA (tamu) atau info jadwal pembaruan (sudah login)
function KartuPeringatan({ pengguna }) {
  const { t } = useTranslation()
  if (!pengguna) {
    return (
      <Card variant="sorotan" className="kartu-peringatan">
        <div className="kartu-peringatan-teks">
          <h2>
            <BellRing size={22} aria-hidden="true" />
            {t('peta.peringatan.judulTamu')}
          </h2>
          <p>{t('peta.peringatan.teksTamu')}</p>
        </div>
        <Button as={Link} to="/register" variant="terang">
          {t('peta.peringatan.tombolTamu')}
        </Button>
      </Card>
    )
  }
  const tautan = pengguna.role === 'admin' ? { to: '/admin', label: t('peta.peringatan.bukaAdmin') } : { to: '/settings', label: t('peta.peringatan.aturPantauan') }
  return (
    <Card className="kartu-peringatan">
      <div className="kartu-peringatan-teks">
        <h2>
          <CalendarClock size={22} aria-hidden="true" />
          {t('peta.peringatan.judulJadwal')}
        </h2>
        <p className="teks-sekunder">{t('peta.peringatan.teksJadwal')}</p>
      </div>
      <Button as={Link} to={tautan.to} variant="sekunder">
        {tautan.label}
      </Button>
    </Card>
  )
}

// Halaman Peta Risiko: tab parameter, peta choropleth, ringkasan, dan panel prakiraan
export default function PetaRisiko() {
  const { t } = useTranslation()
  const f = useFormat()
  const { parameter: slugUrl } = useParams()
  const parameter = parameterDariUrl(slugUrl)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pengguna } = useAuth()
  const mobile = useMediaQuery(MEDIA.mobile)
  const [cariTerbuka, setCariTerbuka] = useState(false)

  const hariIni = hariIniWib()
  const besok = tambahHari(hariIni, 1)
  const tglMin = tambahHari(hariIni, -RENTANG_HARI_LALU)
  const tglUrl = searchParams.get('date')
  const tgl = isoValid(tglUrl) && tglUrl >= tglMin && tglUrl <= besok ? tglUrl : besok
  const kelUrl = searchParams.get('kel')
  const parameterOk = Boolean(parameter)

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
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: t('peta.kec', { nama: p.kecamatan }) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeksKelurahan, t],
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
          baru.set('date', tgl)
          return baru
        },
        { replace: true },
      )
    }
  }, [tglUrl, tgl, setSearchParams])

  if (!parameterOk) {
    return <Navigate to={{ pathname: '/risk-map/rain', search: searchParams.toString() }} replace />
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
  const gantiTanggal = (tanggal) => ubahQuery((q) => q.set('date', tanggal))
  const gantiParameter = (p) => navigate({ pathname: `/risk-map/${PARAMETER[p].slugUrl}`, search: searchParams.toString() })

  const label = labelTanggal(tgl, hariIni, t, f)
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
      placeholder={t('peta.cariPlaceholder')}
      label={t('peta.cariLabel')}
      autoFocus={mobile}
      className="peta-cari"
    />
  )

  return (
    <div className="peta-halaman">
      <JudulHalaman judul={t('peta.judulTab', { parameter: f.parameterJudul(parameter) })} />
      <header className="peta-kepala">
        <div className="peta-judul">
          <h1>{t('peta.judul')}</h1>
          <p className="teks-sekunder">
            {t('peta.prediksiTanggal', { tanggal: f.tanggalPanjang(tgl) })}
            <BantuanMock jenis="lencana" className="badge-mock" />
          </p>
        </div>
        <div className="peta-kontrol">
          {mobile ? (
            <button
              type="button"
              className="tombol-ikon tombol-cari-mobile"
              aria-label={t(cariTerbuka ? 'peta.tutupCari' : 'peta.cariLabel')}
              aria-expanded={cariTerbuka}
              onClick={() => setCariTerbuka((v) => !v)}
            >
              {cariTerbuka ? <X size={20} aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
            </button>
          ) : (
            kolomCari
          )}
          <DatePicker value={tgl} onChange={gantiTanggal} min={tglMin} max={besok} label={t('peta.tanggalPrediksi')} />
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
                    <p>{t('peta.gagalBatas')}</p>
                    <Button variant="sekunder" ukuran="kecil" onClick={() => geojsonQuery.refetch()}>
                      {t('umum.cobaLagi')}
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

      {mobile && (
        <BottomSheet terbuka={Boolean(kel || kelMenunggu)} label={t('peta.sheet.label')} onTutup={tutupPanel}>
          {panelPrakiraan}
        </BottomSheet>
      )}
    </div>
  )
}
