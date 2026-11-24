import { useQuery } from '@tanstack/react-query'
import { Accordion } from 'radix-ui'
import { ArrowRight, BrainCircuit, ChevronDown, CloudDownload, MapPinned, Send, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { getKelurahanGeojson, getRisiko } from '../api/publik'
import BantuanMock from '../components/BantuanMock'
import JudulHalaman from '../components/JudulHalaman'
import { IKON_PARAMETER } from '../components/peta/ikonCuaca'
import PetaMini from '../components/peta/PetaMini'
import PesanWA, { PesanWASkeleton } from '../components/PesanWA'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import Skeleton from '../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../lib/animasi'
import { useAuth } from '../lib/auth'
import { useFormat } from '../lib/format'
import { JENIS_KEJADIAN, PARAMETER, PARAMETER_PETA, ringkasanDari, risikoParameter, urlPeta, warnaKategori } from '../lib/kategori'
import { susunPesan } from '../lib/pesanWa'
import { hariIniWib, tambahHari } from '../lib/tanggal'
import { MEDIA, useMediaQuery } from '../lib/useMediaQuery'
import '../styles/pages/Landing.css'

const LANGKAH = [
  { kunci: 'kumpul', ikon: CloudDownload },
  { kunci: 'prediksi', ikon: BrainCircuit },
  { kunci: 'petakan', ikon: MapPinned },
  { kunci: 'kirim', ikon: Send },
]
const PERTANYAAN = ['resmi', 'akurasi', 'gratis', 'berhenti', 'data']
const muncul = { initial: 'awal', whileInView: 'tampil', viewport: { once: true, amount: 0.2 }, variants: VARIAN_GRID }

// Pop-up contoh di peta hero untuk kelurahan bernilai hujan tertinggi
function PopupHero({ properti, data, besok, onTutup }) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <div className="hero-popup" role="group" aria-label={t('peta.kel', { nama: properti.kelurahan })}>
      <div className="hero-popup-kepala">
        <p className="hero-popup-nama">{t('peta.kel', { nama: properti.kelurahan })}</p>
        <button type="button" className="hero-popup-tutup" aria-label={t('landing.hero.tutupPopup')} onClick={onTutup}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <Badge warna={warnaKategori('hujan', data.kategori)}>{f.kategori('hujan', data.kategori)}</Badge>
      <dl className="hero-popup-isi">
        <div>
          <dt>{t('parameter.hujan.judul')}</dt>
          <dd>{f.nilaiLengkap('hujan', data.nilai)}</dd>
        </div>
        <div>
          <dt>{t('peta.info.waktu')}</dt>
          <dd>{data.jam_mulai ? f.periode(data.jam_mulai, data.jam_selesai) : t('peta.tanpaPeriode')}</dd>
        </div>
      </dl>
      <Button as={Link} to={urlPeta({ color: 'hujan', kel: properti.kode_kel, date: besok })} ukuran="kecil" ikonKanan={ArrowRight} className="hero-popup-tombol">
        {t('landing.hero.lihatDetail')}
      </Button>
    </div>
  )
}

// Kartu peta hero: kategori hujan esok hari, pop-up otomatis (di bawah peta pada mobile), dan legenda ringkas
function KartuPetaHero({ geojson, risikoHujan, indeks, besok }) {
  const { t } = useTranslation()
  const f = useFormat()
  const mobile = useMediaQuery(MEDIA.mobile)
  const [popupTerbuka, setPopupTerbuka] = useState(true)
  const teratas = Object.entries(risikoHujan ?? {}).sort(([, a], [, b]) => b.nilai - a.nilai)[0]
  const siap = geojson && risikoHujan
  const properti = indeks[teratas?.[0]]
  const popup = siap && popupTerbuka && properti && (
    <PopupHero properti={properti} data={teratas[1]} besok={besok} onTutup={() => setPopupTerbuka(false)} />
  )

  return (
    <Card className="hero-peta" aria-busy={!siap}>
      <div className="hero-peta-kepala">
        <p className="hero-peta-judul">{t('landing.peta.judul', { tanggal: f.tanggalHari(besok) })}</p>
        <BantuanMock jenis="lencana" />
      </div>
      <div className="hero-peta-gambar">
        {siap ? (
          <PetaMini
            geojson={geojson}
            risiko={risikoHujan}
            parameter="hujan"
            label={t('landing.peta.alt', { tanggal: f.tanggalPanjang(besok) })}
            sorot={popupTerbuka ? teratas?.[0] : null}
          >
            {!mobile && popup}
          </PetaMini>
        ) : (
          <Skeleton height="100%" radius={16} />
        )}
      </div>
      {mobile && popup}
      <ul className="hero-legend" aria-label={t('landing.peta.legenda', { satuan: t('satuan.hujan') })}>
        {PARAMETER.hujan.kategori.map((k) => (
          <li key={k.label}>
            <span className="hero-legend-warna" style={{ background: k.warna }} aria-hidden="true" />
            {f.kategori('hujan', k.label)}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Kartu satu parameter: ikon, nama, satuan, dan kategori Tabel 2.1 (hujan tampil sebagai skala 6 tingkat)
function KartuParameter({ parameter, besok }) {
  const { t } = useTranslation()
  const f = useFormat()
  const Ikon = IKON_PARAMETER[parameter]
  return (
    <Card as="article" className="kartu-parameter">
      <div className="kartu-parameter-kepala">
        <span className="kartu-parameter-ikon" aria-hidden="true">
          <Ikon size={22} />
        </span>
        <div>
          <h3>{f.parameterJudul(parameter)}</h3>
          <p className="teks-sekunder">{t('landing.parameter.satuan', { satuan: t(`satuan.${parameter}`) })}</p>
        </div>
      </div>
      <ol className="skala-kategori" aria-label={t('landing.parameter.kategori')}>
        {PARAMETER[parameter].kategori.map((k) => (
          <li key={k.label}>
            <span className="skala-warna" style={{ background: k.warna }} aria-hidden="true" />
            <span className="skala-label">{f.kategori(parameter, k.label)}</span>
            <span className="skala-rentang">{f.rentang(k.rentang)}</span>
          </li>
        ))}
      </ol>
      {parameter === 'hujan' && <p className="kartu-parameter-catatan">{t('landing.parameter.catatanHujan')}</p>}
      <Link to={urlPeta({ color: parameter, date: besok })} className="kartu-parameter-tautan">
        {t('landing.parameter.lihatPeta')}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </Card>
  )
}

// Halaman beranda publik
export default function Landing() {
  const { t, i18n } = useTranslation()
  const f = useFormat()
  const { pengguna } = useAuth()
  const navigate = useNavigate()
  const besok = tambahHari(hariIniWib(), 1)
  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })
  const risikoQuery = useQuery({ queryKey: ['risiko', besok], queryFn: () => getRisiko(besok) })

  const fitur = geojsonQuery.data?.features
  const indeks = useMemo(() => Object.fromEntries((fitur ?? []).map((ft) => [ft.properties.kode_kel, ft.properties])), [fitur])
  const itemCari = useMemo(
    () =>
      Object.values(indeks)
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: t('peta.kec', { nama: p.kecamatan }) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeks, t],
  )
  const jumlahKelurahan = fitur?.length
  const jumlahKecamatan = fitur && new Set(fitur.map((ft) => ft.properties.kecamatan)).size
  const risikoHujan = risikoParameter(risikoQuery.data, 'hujan')
  const ringkasan = ringkasanDari(risikoQuery.data)

  // Contoh pesan WA dari dua kelurahan bernilai hujan tertinggi
  const contohPantauan = Object.entries(risikoHujan ?? {})
    .sort(([, a], [, b]) => b.nilai - a.nilai)
    .slice(0, 2)
    .map(([kode]) => kode)
  const contohPesan = risikoQuery.data && fitur ? susunPesan(risikoQuery.data, contohPantauan, indeks, besok) : null
  const ajakan = pengguna?.role === 'user' ? { to: '/settings', label: t('landing.wa.atur') } : pengguna ? null : { to: '/register', label: t('landing.wa.daftar') }

  return (
    <div className="landing">
      <JudulHalaman />

      <section className="hero" aria-labelledby="hero-judul">
        <motion.div className="hero-teks" variants={VARIAN_GRID} initial="awal" animate="tampil">
          <motion.h1 id="hero-judul" variants={VARIAN_KARTU}>
            <Trans i18nKey="landing.hero.judul" components={{ aksen: <span className="hero-aksen" /> }} />
          </motion.h1>
          <motion.p variants={VARIAN_KARTU} className="hero-deskripsi">
            {t('landing.hero.deskripsi')}
          </motion.p>
          <motion.div variants={VARIAN_KARTU} className="hero-cari">
            <SearchInput
              items={itemCari}
              onSelect={(item) => navigate(urlPeta({ kel: item.value, date: besok }))}
              placeholder={t('landing.hero.cariPlaceholder')}
              label={t('landing.hero.cariLabel')}
            />
            <Button as={Link} to={urlPeta({ date: besok })} ukuran="besar" ikonKanan={ArrowRight}>
              {t('landing.hero.bukaPeta')}
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-kanan"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <KartuPetaHero geojson={geojsonQuery.data} risikoHujan={risikoHujan} indeks={indeks} besok={besok} />
        </motion.div>
      </section>

      <section className="strip-ringkasan" aria-label={t('landing.ringkasan.label')} aria-busy={!ringkasan}>
        <p className="strip-ringkasan-tanggal">{t('landing.ringkasan.tanggal', { tanggal: f.tanggalHari(besok) })}</p>
        <ul className="strip-ringkasan-daftar">
          {JENIS_KEJADIAN.map((j) => {
            const Ikon = IKON_PARAMETER[j.parameter]
            return (
              <li key={j.kunci}>
                <Link to={urlPeta({ color: j.parameter, date: besok })} className="strip-ringkasan-item">
                  <Ikon size={18} aria-hidden="true" />
                  {ringkasan ? <strong>{f.angka(ringkasan[j.kunci])}</strong> : <Skeleton width={24} height={18} />}
                  <span>{t(`kejadian.${j.kunci}.kalimat`)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <motion.section className="tentang" aria-labelledby="tentang-judul" {...muncul}>
        <motion.div variants={VARIAN_KARTU} className="bagian-kepala-landing tentang-kepala">
          <h2 id="tentang-judul">{t('landing.tentang.judul')}</h2>
          <p className="teks-sekunder">{t('landing.tentang.teks')}</p>
        </motion.div>
        <motion.div variants={VARIAN_KARTU} className="tentang-cakupan">
          <Card variant="sorotan" className="tentang-kartu">
            <h3>{t('landing.tentang.cakupanJudul')}</h3>
            <div className="tentang-angka">
              <p>
                {jumlahKelurahan ? <span className="angka-utama">{jumlahKelurahan}</span> : <Skeleton width={96} height={56} radius={10} />}
                <span>{t('landing.tentang.kelurahan')}</span>
              </p>
              <p>
                {jumlahKecamatan ? <span className="angka-utama">{jumlahKecamatan}</span> : <Skeleton width={64} height={56} radius={10} />}
                <span>{t('landing.tentang.kecamatan')}</span>
              </p>
            </div>
            <p className="tentang-cakupan-teks">{t('landing.tentang.cakupanTeks')}</p>
          </Card>
        </motion.div>
        <motion.div variants={VARIAN_KARTU} className="tentang-sumber">
          <Card className="tentang-kartu">
            <h3>{t('landing.tentang.sumberJudul')}</h3>
            <p className="teks-sekunder">{t('landing.tentang.sumberTeks')}</p>
            <ul className="tentang-label">
              <li>NASA POWER</li>
              <li>Open-Meteo</li>
              <li>{t('landing.tentang.stasiunBmkg')}</li>
            </ul>
          </Card>
        </motion.div>
        <motion.div variants={VARIAN_KARTU} className="tentang-batas">
          <Card className="tentang-kartu">
            <h3>{t('landing.tentang.batasJudul')}</h3>
            <p className="teks-sekunder">{t('landing.tentang.batasTeks')}</p>
          </Card>
        </motion.div>
      </motion.section>

      <section className="cara-kerja" aria-labelledby="cara-judul">
        <h2 id="cara-judul">{t('landing.cara.judul')}</h2>
        <motion.ol className="cara-kerja-langkah" {...muncul}>
          {LANGKAH.map(({ kunci, ikon: Ikon }, i) => (
            <motion.li key={kunci} variants={VARIAN_KARTU} className="langkah">
              <div className="langkah-kepala">
                <span className="langkah-nomor" aria-hidden="true">{i + 1}</span>
                <Ikon size={24} aria-hidden="true" className="langkah-ikon" />
              </div>
              <h3>{t(`landing.cara.${kunci}.judul`)}</h3>
              <p>{t(`landing.cara.${kunci}.teks`)}</p>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      <motion.section className="parameter" aria-labelledby="parameter-judul" {...muncul}>
        <motion.div variants={VARIAN_KARTU} className="bagian-kepala-landing">
          <h2 id="parameter-judul">{t('landing.parameter.judul')}</h2>
          <p className="teks-sekunder">{t('landing.parameter.teks')}</p>
        </motion.div>
        <div className="parameter-grid">
          {PARAMETER_PETA.map((p) => (
            <motion.div key={p} variants={VARIAN_KARTU} className={`parameter-sel parameter-sel-${p}`}>
              <KartuParameter parameter={p} besok={besok} />
            </motion.div>
          ))}
        </div>
      </motion.section>

      <section className="peringatan" aria-labelledby="peringatan-judul">
        <div className="peringatan-teks">
          <h2 id="peringatan-judul">{t('landing.wa.judul')}</h2>
          <p className="teks-sekunder">{t('landing.wa.teks')}</p>
          <ol className="peringatan-langkah">
            {['pilih', 'verifikasi', 'terima'].map((k) => (
              <li key={k}>{t(`landing.wa.langkah.${k}`)}</li>
            ))}
          </ol>
          {i18n.language !== 'id' && <p className="teks-sekunder peringatan-catatan">{t('landing.wa.catatanBahasa')}</p>}
          {ajakan && (
            <Button as={Link} to={ajakan.to} ukuran="besar" ikonKanan={ArrowRight}>
              {ajakan.label}
            </Button>
          )}
        </div>
        <div className="peringatan-pesan">
          {contohPesan ? <PesanWA pesan={contohPesan} tgl={besok} label={t('landing.wa.contohAria')} /> : <PesanWASkeleton />}
        </div>
      </section>

      <motion.section className="faq" aria-labelledby="faq-judul" {...muncul}>
        <motion.div variants={VARIAN_KARTU} className="bagian-kepala-landing">
          <h2 id="faq-judul">{t('landing.faq.judul')}</h2>
        </motion.div>
        <motion.div variants={VARIAN_KARTU}>
          <Accordion.Root type="single" collapsible className="faq-daftar">
            {PERTANYAAN.map((k) => (
              <Accordion.Item key={k} value={k} className="faq-item">
                <Accordion.Header asChild>
                  <h3>
                    <Accordion.Trigger className="faq-pemicu">
                      {t(`landing.faq.${k}.tanya`)}
                      <ChevronDown size={20} aria-hidden="true" className="faq-panah" />
                    </Accordion.Trigger>
                  </h3>
                </Accordion.Header>
                <Accordion.Content className="faq-jawab">
                  <p>{t(`landing.faq.${k}.jawab`)}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </motion.div>
      </motion.section>
    </div>
  )
}
