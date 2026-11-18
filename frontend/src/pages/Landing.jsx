import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BellRing, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { getKelurahanGeojson, getRisiko } from '../api/publik'
import BantuanMock from '../components/BantuanMock'
import JudulHalaman from '../components/JudulHalaman'
import { IKON_PARAMETER } from '../components/peta/ikonCuaca'
import PetaMini from '../components/peta/PetaMini'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import Skeleton from '../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../lib/animasi'
import { useAuth } from '../lib/auth'
import { buatFormat, useFormat } from '../lib/format'
import { JENIS_KEJADIAN, masukPeringatan, PARAMETER, PARAMETER_PETA, ringkasanDari, risikoParameter, urlPeta } from '../lib/kategori'
import { hariIniWib, tambahHari } from '../lib/tanggal'
import '../styles/components/pengaturan.css'
import '../styles/pages/Landing.css'

// Kalimat status esok hari dari ringkasan jumlah kelurahan per jenis kejadian
function StatusEsok({ ringkasan, memuat, besok }) {
  const { t } = useTranslation()
  const f = useFormat()
  if (memuat) {
    return (
      <div className="hero-status" aria-hidden="true">
        <Skeleton width="92%" height={18} />
        <Skeleton width="64%" height={18} />
      </div>
    )
  }
  const kejadian = JENIS_KEJADIAN.filter((j) => ringkasan?.[j.kunci] > 0)
  return (
    <p className="hero-status">
      <span className="hero-status-tanggal">{t('landing.status.tanggal', { tanggal: f.tanggalPanjang(besok) })}</span>{' '}
      {kejadian.length === 0
        ? t('landing.status.tidakAda')
        : kejadian.map((j, i) => (
            <span key={j.kunci}>
              <Trans
                i18nKey="landing.status.item"
                values={{ jumlah: f.angka(ringkasan[j.kunci]), kejadian: t(`kejadian.${j.kunci}.kalimat`) }}
                components={{ tebal: <strong /> }}
              />
              {i < kejadian.length - 1 ? ', ' : '.'}
            </span>
          ))}{' '}
      <BantuanMock jenis="lencana" />
    </p>
  )
}

// Kartu peta hujan esok hari beserta legenda kategori
function KartuPetaHero({ besok, geojson, risiko }) {
  const { t } = useTranslation()
  const f = useFormat()
  const siap = geojson && risiko
  return (
    <Card className="hero-peta" aria-busy={!siap}>
      <div className="hero-peta-kepala">
        <h2 className="hero-peta-judul">{t('landing.peta.judul')}</h2>
        <p className="teks-sekunder">{f.tanggalPanjang(besok)}</p>
      </div>
      <Link to={urlPeta({ date: besok })} className="hero-peta-gambar" aria-label={t('landing.peta.buka')}>
        {siap ? (
          <PetaMini geojson={geojson} risiko={risiko} parameter="hujan" label={t('landing.peta.alt', { tanggal: f.tanggalPanjang(besok) })} />
        ) : (
          <Skeleton height="100%" radius={16} />
        )}
      </Link>
      <ul className="hero-legend" aria-label={t('landing.peta.legenda', { satuan: t('satuan.hujan') })}>
        {PARAMETER.hujan.kategori.map((k) => (
          <li key={k.label}>
            <span className="hero-legend-warna" style={{ background: k.warna }} aria-hidden="true" />
            <span>
              {f.kategori('hujan', k.label)}
              <span className="teks-sekunder"> {f.rentang(k.rentang)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Contoh pesan WA (selalu berbahasa Indonesia, sama seperti pesan yang dikirim)
function PratinjauPesan({ besok, risiko, indeks }) {
  const { t, i18n } = useTranslation()
  const tId = i18n.getFixedT('id')
  const fId = buatFormat(tId, 'id')
  const teratas = Object.entries(risiko ?? {}).sort(([, a], [, b]) => b.nilai - a.nilai)[0]
  if (!teratas || !indeks[teratas[0]]) {
    return (
      <div className="pesan-wa" aria-hidden="true">
        <Skeleton width="50%" height={16} />
        <Skeleton width="80%" height={14} />
        <Skeleton width="70%" height={14} style={{ marginTop: 10 }} />
      </div>
    )
  }
  const [kode, data] = teratas
  return (
    <article className="pesan-wa" lang="id" aria-label={t('landing.wa.contohAria')}>
      <p className="pesan-wa-judul">{tId('pesanWa.judul')}</p>
      <p className="pesan-wa-sub">{tId('pesanWa.sub', { tanggal: fId.tanggalPanjang(besok) })}</p>
      <div className="pesan-wa-kel">
        <p className="pesan-wa-nama">{indeks[kode].kelurahan}:</p>
        {masukPeringatan('hujan', data.kategori) ? (
          <ul>
            <li>
              {fId.kategori('hujan', data.kategori)} {fId.nilaiLengkap('hujan', data.nilai)}
              {data.jam_mulai && `, ${fId.periode(data.jam_mulai, data.jam_selesai)}`}
            </li>
          </ul>
        ) : (
          <p className="pesan-wa-aman">{tId('pesanWa.aman')}</p>
        )}
      </div>
      <p className="pesan-wa-kaki">{tId('umum.disclaimer')}</p>
      <span className="pesan-wa-jam">12.00</span>
    </article>
  )
}

// Halaman beranda publik: cari kelurahan, status esok hari, parameter, dan peringatan WA
export default function Landing() {
  const { t, i18n } = useTranslation()
  const { pengguna } = useAuth()
  const navigate = useNavigate()
  const besok = tambahHari(hariIniWib(), 1)
  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })
  const risikoQuery = useQuery({ queryKey: ['risiko', besok], queryFn: () => getRisiko(besok) })
  const risikoHujan = risikoParameter(risikoQuery.data, 'hujan')
  const ringkasanQuery = { data: ringkasanDari(risikoQuery.data), isPending: risikoQuery.isPending }

  const indeks = useMemo(
    () => Object.fromEntries((geojsonQuery.data?.features ?? []).map((f) => [f.properties.kode_kel, f.properties])),
    [geojsonQuery.data],
  )
  const itemCari = useMemo(
    () =>
      Object.values(indeks)
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: t('peta.kec', { nama: p.kecamatan }) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeks, t],
  )
  const jumlahPerParameter = Object.fromEntries(JENIS_KEJADIAN.map((j) => [j.parameter, j]))
  const ajakanWa = !pengguna ? { to: '/register', label: t('landing.wa.aktifkan') } : pengguna.role === 'user' ? { to: '/settings', label: t('landing.wa.atur') } : null

  return (
    <div className="landing">
      <JudulHalaman />
      <section className="hero" aria-labelledby="hero-judul">
        <motion.div className="hero-teks" variants={VARIAN_GRID} initial="awal" animate="tampil">
          <motion.h1 id="hero-judul" variants={VARIAN_KARTU}>
            {t('landing.hero.judul')}
          </motion.h1>
          <motion.p variants={VARIAN_KARTU} className="hero-deskripsi">
            {t('landing.hero.deskripsi', { jumlah: itemCari.length || 153 })}
          </motion.p>
          <motion.div variants={VARIAN_KARTU}>
            <StatusEsok ringkasan={ringkasanQuery.data} memuat={ringkasanQuery.isPending} besok={besok} />
          </motion.div>
          <motion.div variants={VARIAN_KARTU} className="hero-cari">
            <SearchInput
              items={itemCari}
              onSelect={(item) => navigate(urlPeta({ kel: item.value, date: besok }))}
              placeholder={t('landing.hero.cariPlaceholder')}
              label={t('landing.hero.cariLabel')}
            />
            <Button as={Link} to={urlPeta()} ukuran="besar" ikonKanan={ArrowRight}>
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
          <KartuPetaHero besok={besok} geojson={geojsonQuery.data} risiko={risikoHujan} />
        </motion.div>
      </section>

      <motion.section className="landing-bento" aria-label={t('landing.bentoLabel')} variants={VARIAN_GRID} initial="awal" animate="tampil">
        <motion.div variants={VARIAN_KARTU} className="landing-parameter">
          <Card className="landing-kartu">
            <h2>{t('landing.parameter.judul')}</h2>
            <p className="teks-sekunder">{t('landing.parameter.teks')}</p>
            <ul className="daftar-parameter">
              {PARAMETER_PETA.map((slug) => PARAMETER[slug]).map((p) => {
                const Ikon = IKON_PARAMETER[p.slug]
                const jenis = jumlahPerParameter[p.slug]
                return (
                  <li key={p.slug}>
                    <Link to={urlPeta({ color: p.slug, date: besok })} className="baris-parameter">
                      <Ikon size={20} aria-hidden="true" />
                      <span className="baris-parameter-nama">{t(`parameter.${p.slug}.judul`)}</span>
                      <span className="baris-parameter-nilai">
                        {!jenis ? (
                          <span className="teks-sekunder">{t('peta.informasiNilai')}</span>
                        ) : ringkasanQuery.isPending ? (
                          <Skeleton width={72} height={18} />
                        ) : (
                          <>
                            <strong>{ringkasanQuery.data?.[jenis.kunci] ?? '–'}</strong>
                            <span className="teks-sekunder baris-parameter-unit">
                              {' '}
                              {t('peta.kelSingkat')} {t(`kejadian.${jenis.kunci}.kalimat`)}
                            </span>
                          </>
                        )}
                      </span>
                      <ChevronRight size={18} aria-hidden="true" className="baris-parameter-panah" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </motion.div>

        <motion.div variants={VARIAN_KARTU} className="landing-wa">
          <Card className="landing-kartu">
            <h2>
              <BellRing size={20} aria-hidden="true" />
              {t('landing.wa.judul')}
            </h2>
            <p className="teks-sekunder">{t('landing.wa.teks')}</p>
            {i18n.language !== 'id' && <p className="teks-sekunder catatan-bahasa-wa">{t('landing.wa.catatanBahasa')}</p>}
            <div className="landing-pesan">
              <PratinjauPesan besok={besok} risiko={risikoHujan} indeks={indeks} />
            </div>
            {ajakanWa && (
              <Button as={Link} to={ajakanWa.to} className="landing-wa-tombol">
                {ajakanWa.label}
              </Button>
            )}
          </Card>
        </motion.div>
      </motion.section>
    </div>
  )
}
