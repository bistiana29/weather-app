import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BellRing, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { getKelurahanGeojson, getRingkasan, getRisiko } from '../api/publik'
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
import { DAFTAR_PARAMETER, formatNilai, JENIS_KEJADIAN, masukPeringatan, PARAMETER } from '../lib/kategori'
import { formatPanjang, hariIniWib, tambahHari } from '../lib/tanggal'
import '../styles/components/pengaturan.css'
import '../styles/pages/Landing.css'

const titikJam = (jam) => jam.replace(':', '.')

// Kalimat status esok hari dari ringkasan jumlah kelurahan per jenis kejadian
function StatusEsok({ ringkasan, memuat, besok }) {
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
      <span className="hero-status-tanggal">Prakiraan {formatPanjang(besok)}:</span>{' '}
      {kejadian.length === 0
        ? 'tidak ada kelurahan dengan kejadian ekstrem.'
        : kejadian.map((j, i) => (
            <span key={j.kunci}>
              <strong>{ringkasan[j.kunci]}</strong> kelurahan {j.label.toLowerCase()}
              {i < kejadian.length - 1 ? ', ' : '.'}
            </span>
          ))}{' '}
      <BantuanMock jenis="lencana" />
    </p>
  )
}

// Kartu peta hujan esok hari beserta legenda kategori
function KartuPetaHero({ besok, geojson, risiko }) {
  const siap = geojson && risiko
  return (
    <Card className="hero-peta" aria-busy={!siap}>
      <div className="hero-peta-kepala">
        <h2 className="hero-peta-judul">Curah hujan esok hari</h2>
        <p className="teks-sekunder">{formatPanjang(besok)}</p>
      </div>
      <Link to={`/peta-risiko/hujan?tgl=${besok}`} className="hero-peta-gambar" aria-label="Buka peta risiko curah hujan">
        {siap ? (
          <PetaMini geojson={geojson} risiko={risiko} parameter="hujan" label={`Peta kategori curah hujan per kelurahan untuk ${formatPanjang(besok)}`} />
        ) : (
          <Skeleton height="100%" radius={16} />
        )}
      </Link>
      <ul className="hero-legend" aria-label="Legenda curah hujan (mm/jam)">
        {PARAMETER.hujan.kategori.map((k) => (
          <li key={k.label}>
            <span className="hero-legend-warna" style={{ background: k.warna }} aria-hidden="true" />
            <span>
              {k.label.replace('Hujan ', '')}
              <span className="teks-sekunder"> {k.rentang}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Contoh pesan WA dari kelurahan dengan risiko hujan tertinggi esok hari
function PratinjauPesan({ besok, risiko, indeks }) {
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
    <article className="pesan-wa" aria-label="Contoh pesan peringatan WhatsApp">
      <p className="pesan-wa-judul">Info Cuaca SBY</p>
      <p className="pesan-wa-sub">Peringatan dini untuk {formatPanjang(besok)}, 00.00–23.59 WIB</p>
      <div className="pesan-wa-kel">
        <p className="pesan-wa-nama">{indeks[kode].kelurahan}:</p>
        {masukPeringatan('hujan', data.kategori) ? (
          <ul>
            <li>
              {data.kategori} {formatNilai('hujan', data.nilai)}
              {data.jam_mulai && `, ${titikJam(data.jam_mulai)}–${titikJam(data.jam_selesai)} WIB`}
            </li>
          </ul>
        ) : (
          <p className="pesan-wa-aman">Tidak ada kejadian ekstrem.</p>
        )}
      </div>
      <p className="pesan-wa-kaki">Hasil prediksi model, bukan peringatan resmi BMKG.</p>
      <span className="pesan-wa-jam">12.00</span>
    </article>
  )
}

// Halaman beranda publik: cari kelurahan, status esok hari, parameter, dan peringatan WA
export default function Landing() {
  const { pengguna } = useAuth()
  const navigate = useNavigate()
  const besok = tambahHari(hariIniWib(), 1)
  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })
  const risikoQuery = useQuery({ queryKey: ['risiko', 'hujan', besok], queryFn: () => getRisiko('hujan', besok) })
  const ringkasanQuery = useQuery({ queryKey: ['ringkasan', besok], queryFn: () => getRingkasan(besok) })

  const indeks = useMemo(
    () => Object.fromEntries((geojsonQuery.data?.features ?? []).map((f) => [f.properties.kode_kel, f.properties])),
    [geojsonQuery.data],
  )
  const itemCari = useMemo(
    () =>
      Object.values(indeks)
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: `Kec. ${p.kecamatan}` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeks],
  )
  const jumlahPerParameter = Object.fromEntries(JENIS_KEJADIAN.map((j) => [j.parameter, j]))
  const ajakanWa = !pengguna ? { to: '/daftar', label: 'Aktifkan peringatan' } : pengguna.role === 'user' ? { to: '/pengaturan', label: 'Atur peringatan' } : null

  return (
    <div className="landing">
      <JudulHalaman />
      <section className="hero" aria-labelledby="hero-judul">
        <motion.div className="hero-teks" variants={VARIAN_GRID} initial="awal" animate="tampil">
          <motion.h1 id="hero-judul" variants={VARIAN_KARTU}>
            Cek risiko cuaca ekstrem di kelurahan Anda, sehari sebelumnya.
          </motion.h1>
          <motion.p variants={VARIAN_KARTU} className="hero-deskripsi">
            Peta risiko hujan lebat, suhu ekstrem, angin kencang, dan jarak pandang rendah untuk {itemCari.length || 153} kelurahan
            di Surabaya, dari prediksi model yang diperbarui setiap hari pukul 12.00 WIB.
          </motion.p>
          <motion.div variants={VARIAN_KARTU}>
            <StatusEsok ringkasan={ringkasanQuery.data} memuat={ringkasanQuery.isPending} besok={besok} />
          </motion.div>
          <motion.div variants={VARIAN_KARTU} className="hero-cari">
            <SearchInput
              items={itemCari}
              onSelect={(item) => navigate(`/peta-risiko/hujan?kel=${item.value}&tgl=${besok}`)}
              placeholder="Cari kelurahan Anda, mis. Ketintang"
              label="Cari kelurahan Anda"
            />
            <Button as={Link} to="/peta-risiko/hujan" ukuran="besar" ikonKanan={ArrowRight}>
              Buka peta risiko
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-kanan"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <KartuPetaHero besok={besok} geojson={geojsonQuery.data} risiko={risikoQuery.data} />
        </motion.div>
      </section>

      <motion.section className="landing-bento" aria-label="Parameter dan peringatan" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <motion.div variants={VARIAN_KARTU} className="landing-parameter">
          <Card className="landing-kartu">
            <h2>Lima parameter, dipetakan terpisah</h2>
            <p className="teks-sekunder">
              Setiap kelurahan dinilai dengan ambang kategori BMKG (Tabel 2.1). Angka menunjukkan jumlah kelurahan berisiko esok hari.
            </p>
            <ul className="daftar-parameter">
              {DAFTAR_PARAMETER.map((p) => {
                const Ikon = IKON_PARAMETER[p.slug]
                const jenis = jumlahPerParameter[p.slug]
                return (
                  <li key={p.slug}>
                    <Link to={`/peta-risiko/${p.slug}?tgl=${besok}`} className="baris-parameter">
                      <Ikon size={20} aria-hidden="true" />
                      <span className="baris-parameter-nama">{p.judul}</span>
                      <span className="baris-parameter-nilai">
                        {!jenis ? (
                          <span className="teks-sekunder">Informasi nilai</span>
                        ) : ringkasanQuery.isPending ? (
                          <Skeleton width={72} height={18} />
                        ) : (
                          <>
                            <strong>{ringkasanQuery.data?.[jenis.kunci] ?? '–'}</strong>
                            <span className="teks-sekunder baris-parameter-unit"> kel. {jenis.labelPendek.toLowerCase()}</span>
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
              Peringatan H-1 lewat WhatsApp
            </h2>
            <p className="teks-sekunder">
              Pilih hingga 3 kelurahan. Pesan dikirim pukul 12.00 WIB untuk periode esok hari 00.00–23.59 WIB.
            </p>
            <div className="landing-pesan">
              <PratinjauPesan besok={besok} risiko={risikoQuery.data} indeks={indeks} />
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
