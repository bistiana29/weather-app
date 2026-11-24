import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { getPengaturan } from '../api/pengguna'
import { getKelurahanGeojson, getPrakiraan, getRisiko } from '../api/publik'
import BantuanMock from '../components/BantuanMock'
import JudulHalaman from '../components/JudulHalaman'
import PageHeader from '../components/layout/PageHeader'
import BottomSheet from '../components/peta/BottomSheet'
import DeretPerJam from '../components/peta/DeretPerJam'
import DialogGrafik from '../components/peta/DialogGrafik'
import KartuFokus from '../components/peta/KartuFokus'
import PetaKelurahan from '../components/peta/PetaKelurahan'
import PilihParameter from '../components/peta/PilihParameter'
import RingkasanKejadian from '../components/peta/RingkasanKejadian'
import SorotanKelurahan from '../components/peta/SorotanKelurahan'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import DatePicker from '../components/ui/DatePicker'
import SearchInput from '../components/ui/SearchInput'
import Skeleton from '../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../lib/animasi'
import { useAuth } from '../lib/auth'
import { useFormat } from '../lib/format'
import { PARAMETER, PARAMETER_PETA, parameterDariUrl, ringkasanDari, risikoParameter } from '../lib/kategori'
import { hariIniWib, isoValid, tambahHari } from '../lib/tanggal'
import { MEDIA, MEDIA_SENTUH, useMediaQuery } from '../lib/useMediaQuery'
import '../styles/pages/PetaRisiko.css'

const RENTANG_HARI_LALU = 30
const RENTANG_HARI_DEPAN = 5

// Label tanggal relatif ("esok hari", "hari ini") atau tanggal ringkas
function labelTanggal(tgl, hariIni, t, f) {
  if (tgl === tambahHari(hariIni, 1)) return t('peta.esokHari')
  if (tgl === hariIni) return t('peta.hariIni')
  return f.tanggalRingkas(tgl)
}

// Baca daftar parameter dari query "params" (slug URL); kosong atau tidak valid berarti semua
function bacaParams(teks) {
  const daftar = (teks ?? '').split(',').map(parameterDariUrl).filter(Boolean)
  return daftar.length ? PARAMETER_PETA.filter((p) => daftar.includes(p)) : PARAMETER_PETA
}

// Kelurahan dengan nilai tertinggi (terendah untuk jarak pandang) menurut satu parameter
function kelurahanTeratas(risiko, parameter) {
  const urut = Object.entries(risiko ?? {}).sort(([, a], [, b]) =>
    PARAMETER[parameter].jenisNilai === 'min' ? a.nilai - b.nilai : b.nilai - a.nilai,
  )
  return urut[0]?.[0] ?? null
}

// Halaman Peta Risiko: peta satu parameter pewarna, kartu fokus, deret per jam, ringkasan, dan sorotan
export default function PetaRisiko() {
  const { t } = useTranslation()
  const f = useFormat()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pengguna } = useAuth()
  const mobile = useMediaQuery(MEDIA.mobile)
  const sentuh = useMediaQuery(MEDIA_SENTUH)
  const [sheetTerbuka, setSheetTerbuka] = useState(false)
  const [grafikTerbuka, setGrafikTerbuka] = useState(false)

  const hariIni = hariIniWib()
  const besok = tambahHari(hariIni, 1)
  const tglMin = tambahHari(hariIni, -RENTANG_HARI_LALU)
  const tglMaks = tambahHari(hariIni, RENTANG_HARI_DEPAN)
  const tglUrl = searchParams.get('date')
  const tgl = isoValid(tglUrl) && tglUrl >= tglMin && tglUrl <= tglMaks ? tglUrl : besok
  const params = bacaParams(searchParams.get('params'))
  const colorUrl = parameterDariUrl(searchParams.get('color'))
  const color = params.includes(colorUrl) ? colorUrl : params.includes('hujan') ? 'hujan' : params[0]
  const kelUrl = searchParams.get('kel')

  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })
  const risikoQuery = useQuery({ queryKey: ['risiko', tgl], queryFn: () => getRisiko(tgl) })
  const pengaturanQuery = useQuery({ queryKey: ['pengaturan'], queryFn: getPengaturan, enabled: pengguna?.role === 'user' })

  const indeksKelurahan = useMemo(
    () => Object.fromEntries((geojsonQuery.data?.features ?? []).map((ft) => [ft.properties.kode_kel, ft.properties])),
    [geojsonQuery.data],
  )
  const itemCari = useMemo(
    () =>
      Object.values(indeksKelurahan)
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: t('peta.kec', { nama: p.kecamatan }) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeksKelurahan, t],
  )
  const risikoWarna = useMemo(() => risikoParameter(risikoQuery.data, color), [risikoQuery.data, color])
  const ringkasan = useMemo(() => ringkasanDari(risikoQuery.data), [risikoQuery.data])

  // Kelurahan fokus: pilihan di URL, lalu kelurahan pantauan pertama (login), lalu nilai tertinggi pewarna
  const kelDipilih = indeksKelurahan[kelUrl] ? kelUrl : null
  const pantauanPertama = pengaturanQuery.data?.kelurahan?.find((k) => indeksKelurahan[k])
  const kelFokus = kelDipilih ?? pantauanPertama ?? kelurahanTeratas(risikoWarna, color)
  const alasanFokus = pantauanPertama && !kelDipilih ? 'pantauan' : 'tertinggi'
  const namaFokus = indeksKelurahan[kelFokus]?.kelurahan

  const prakiraanQuery = useQuery({
    queryKey: ['prakiraan', kelFokus, color, tgl],
    queryFn: () => getPrakiraan(kelFokus, color, tgl),
    enabled: Boolean(kelFokus),
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

  // Ubah query URL tanpa menambah riwayat
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
  const tutupFokus = () => ubahQuery((q) => q.delete('kel'))
  const gantiTanggal = (tanggal) => ubahQuery((q) => q.set('date', tanggal))
  const gantiWarna = (p) => ubahQuery((q) => q.set('color', PARAMETER[p].slugUrl))

  // Centang parameter; jika pewarna dihapus, pewarna pindah ke parameter tercentang pertama
  function gantiParams(baru) {
    ubahQuery((q) => {
      if (baru.length === PARAMETER_PETA.length) q.delete('params')
      else q.set('params', baru.map((p) => PARAMETER[p].slugUrl).join(','))
      if (!baru.includes(color)) q.set('color', PARAMETER[baru[0]].slugUrl)
    })
  }

  // Layar sentuh: memilih kelurahan dari pop-up membuka bottom sheet berisi deret per jam
  function pilihDariPeta(kode) {
    pilihKelurahan(kode)
    if (sentuh && mobile) setSheetTerbuka(true)
  }

  const label = labelTanggal(tgl, hariIni, t, f)
  // Lebih dari H+1 belum ada observasi sehari sebelumnya, grafik hanya berisi 24 jam prediksi
  const jamGrafik = tgl > besok ? 24 : 48
  const memuatData = risikoQuery.isPending || geojsonQuery.isPending
  const deret = <DeretPerJam namaKelurahan={namaFokus} parameter={color} prakiraan={prakiraanQuery.data} memuat={prakiraanQuery.isPending} />

  return (
    <div className="peta-halaman">
      <JudulHalaman judul={t('peta.judul')} />
      <PageHeader
        judul={t('peta.judul')}
        subjudul={
          <>
            <span>{t('peta.prediksiTanggal', { tanggal: f.tanggalPanjang(tgl) })}</span>
            <BantuanMock jenis="lencana" className="badge-mock" />
          </>
        }
      >
        <SearchInput
          items={itemCari}
          onSelect={(item) => pilihKelurahan(item.value)}
          placeholder={t('peta.cariPlaceholder')}
          label={t('peta.cariLabel')}
          className="peta-cari"
        />
        <PilihParameter dipilih={params} onUbah={gantiParams} />
        <DatePicker value={tgl} onChange={gantiTanggal} min={tglMin} max={tglMaks} label={t('peta.tanggalPrediksi')} />
      </PageHeader>

      <motion.div className="bento" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <motion.div variants={VARIAN_KARTU} className="bento-peta">
          <Card className="kartu-peta">
            {geojsonQuery.data ? (
              <PetaKelurahan
                geojson={geojsonQuery.data}
                risiko={risikoQuery.data}
                color={color}
                params={params}
                tgl={tgl}
                terpilih={kelFokus}
                onPilih={pilihDariPeta}
                onWarnai={gantiWarna}
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

        <motion.div variants={VARIAN_KARTU} className="bento-fokus">
          <Card className="kartu-fokus">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${kelFokus}-${color}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <KartuFokus
                  properti={indeksKelurahan[kelFokus]}
                  data={risikoQuery.data?.[kelFokus]}
                  color={color}
                  params={params}
                  alasan={alasanFokus}
                  labelTanggal={label}
                  jamGrafik={jamGrafik}
                  dipilih={Boolean(kelDipilih)}
                  memuat={memuatData}
                  onTutup={tutupFokus}
                  onGrafik={() => setGrafikTerbuka(true)}
                />
              </motion.div>
            </AnimatePresence>
          </Card>
        </motion.div>

        {!mobile && (
          <motion.div variants={VARIAN_KARTU} className="bento-jam">
            <Card className="kartu-jam">{deret}</Card>
          </motion.div>
        )}

        <motion.div variants={VARIAN_KARTU} className="bento-ringkasan">
          <RingkasanKejadian
            ringkasan={ringkasan}
            memuat={risikoQuery.isPending}
            totalKelurahan={itemCari.length}
            params={params}
            parameterAktif={color}
            labelTanggal={label}
            onPilihParameter={gantiWarna}
          />
        </motion.div>

        <motion.div variants={VARIAN_KARTU} className="bento-sorotan">
          <Card className="kartu-sorotan-daftar">
            <SorotanKelurahan
              risiko={risikoWarna}
              indeksKelurahan={indeksKelurahan}
              parameter={color}
              memuat={memuatData}
              labelTanggal={label}
              onPilih={pilihKelurahan}
            />
          </Card>
        </motion.div>
      </motion.div>

      <DialogGrafik
        open={grafikTerbuka}
        onOpenChange={setGrafikTerbuka}
        namaKelurahan={namaFokus}
        parameter={color}
        jamGrafik={jamGrafik}
        prakiraan={prakiraanQuery.data}
        memuat={prakiraanQuery.isPending}
      />

      {mobile && (
        <BottomSheet terbuka={sheetTerbuka} label={t('peta.sheet.label')} onTutup={() => setSheetTerbuka(false)}>
          {deret}
        </BottomSheet>
      )}
    </div>
  )
}
