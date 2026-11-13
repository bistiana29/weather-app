import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BellRing, MapPinned, Layers } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { getKelurahanGeojson, getRisiko } from '../api/publik'
import BantuanMock from '../components/BantuanMock'
import { IKON_PARAMETER } from '../components/peta/ikonCuaca'
import PetaMini from '../components/peta/PetaMini'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../lib/animasi'
import { useAuth } from '../lib/auth'
import { DAFTAR_PARAMETER, PARAMETER } from '../lib/kategori'
import { formatPanjang, hariIniWib, tambahHari } from '../lib/tanggal'
import '../styles/pages/Landing.css'

// Tombol ajakan peringatan WA sesuai status login
function tautanPeringatan(pengguna) {
  if (!pengguna) return { to: '/daftar', label: 'Aktifkan Peringatan WA' }
  if (pengguna.role === 'user') return { to: '/pengaturan', label: 'Atur Peringatan WA' }
  return null
}

// Kartu ilustrasi peta hujan esok hari beserta legenda ringkas
function KartuPetaHero({ besok }) {
  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })
  const risikoQuery = useQuery({ queryKey: ['risiko', 'hujan', besok], queryFn: () => getRisiko('hujan', besok) })
  const siap = geojsonQuery.data && risikoQuery.data

  return (
    <Card className="hero-peta" aria-busy={!siap}>
      <div className="hero-peta-kepala">
        <div>
          <p className="hero-peta-judul">Prakiraan curah hujan</p>
          <p className="teks-sekunder">{formatPanjang(besok)}</p>
        </div>
        <BantuanMock jenis="lencana" />
      </div>
      <Link to={`/peta-risiko/hujan?tgl=${besok}`} className="hero-peta-gambar" aria-label="Buka peta risiko hujan">
        {siap ? (
          <PetaMini
            geojson={geojsonQuery.data}
            risiko={risikoQuery.data}
            parameter="hujan"
            label={`Peta kategori curah hujan per kelurahan untuk ${formatPanjang(besok)}`}
          />
        ) : (
          <Skeleton height="100%" radius={16} />
        )}
      </Link>
      <ul className="hero-legend" aria-label="Legenda curah hujan (mm/jam)">
        {PARAMETER.hujan.kategori.map((k) => (
          <li key={k.label}>
            <span className="hero-legend-warna" style={{ background: k.warna }} aria-hidden="true" />
            {k.label.replace('Hujan ', '')}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Halaman beranda publik
export default function Landing() {
  const { pengguna } = useAuth()
  const besok = tambahHari(hariIniWib(), 1)
  const peringatan = tautanPeringatan(pengguna)
  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })
  const fitur = geojsonQuery.data?.features
  const jumlahKecamatan = fitur && new Set(fitur.map((f) => f.properties.kecamatan)).size

  return (
    <div className="landing">
      <section className="hero">
        <motion.div className="hero-teks" variants={VARIAN_GRID} initial="awal" animate="tampil">
          <motion.div variants={VARIAN_KARTU}>
            <Badge nada="info" className="hero-lencana">
              <BellRing size={14} aria-hidden="true" />
              Sistem Peringatan Dini
            </Badge>
          </motion.div>
          <motion.h1 variants={VARIAN_KARTU}>
            Pemetaan Cuaca Ekstrem <span>Kota Surabaya</span>
          </motion.h1>
          <motion.p variants={VARIAN_KARTU} className="hero-deskripsi">
            Lihat risiko hujan lebat, suhu ekstrem, angin kencang, dan jarak pandang rendah untuk setiap kelurahan.
            Prakiraan dibuat setiap hari pukul 12.00 WIB untuk esok hari, dan bisa dikirim ke WhatsApp Anda.
          </motion.p>
          <motion.div variants={VARIAN_KARTU} className="hero-aksi">
            <Button as={Link} to="/peta-risiko/hujan" ukuran="besar" ikonKanan={ArrowRight}>
              Lihat Peta Risiko
            </Button>
            {peringatan && (
              <Button as={Link} to={peringatan.to} variant="sekunder" ukuran="besar" ikon={BellRing}>
                {peringatan.label}
              </Button>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-kanan"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <KartuPetaHero besok={besok} />
        </motion.div>
      </section>

      <motion.section className="fitur" aria-label="Fitur utama" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <motion.div variants={VARIAN_KARTU} className="fitur-kelurahan">
          <Card className="fitur-kartu">
            <span className="fitur-ikon" aria-hidden="true"><MapPinned size={22} /></span>
            <h2>Per kelurahan</h2>
            <p className="fitur-angka">
              {fitur ? <span className="angka-utama">{fitur.length}</span> : <Skeleton width={96} height={52} radius={10} />}
              <span className="teks-sekunder">
                kelurahan
                {jumlahKecamatan ? ` di ${jumlahKecamatan} kecamatan` : ''}
              </span>
            </p>
            <p className="teks-sekunder">Setiap kelurahan punya kategori risiko sendiri, bukan satu angka rata-rata untuk seluruh kota.</p>
          </Card>
        </motion.div>

        <motion.div variants={VARIAN_KARTU} className="fitur-parameter">
          <Card className="fitur-kartu">
            <span className="fitur-ikon" aria-hidden="true"><Layers size={22} /></span>
            <h2>Per parameter cuaca</h2>
            <p className="teks-sekunder">Setiap parameter dipetakan terpisah dengan ambang kategori BMKG.</p>
            <ul className="fitur-chip">
              {DAFTAR_PARAMETER.map((p) => {
                const Ikon = IKON_PARAMETER[p.slug]
                return (
                  <li key={p.slug}>
                    <Link to={`/peta-risiko/${p.slug}`} className="chip">
                      <Ikon size={16} aria-hidden="true" />
                      {p.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </motion.div>

        <motion.div variants={VARIAN_KARTU} className="fitur-wa">
          <Card variant="sorotan" className="fitur-kartu">
            <span className="fitur-ikon fitur-ikon-terang" aria-hidden="true"><BellRing size={22} /></span>
            <h2>Peringatan H-1 via WhatsApp</h2>
            <p className="fitur-angka">
              <span className="angka-utama">12.00</span>
              <span>WIB</span>
            </p>
            <p className="fitur-wa-teks">Dikirim sehari sebelumnya untuk periode 00.00–23.59, hingga 3 kelurahan pantauan.</p>
            {peringatan && (
              <Button as={Link} to={peringatan.to} variant="terang" ukuran="kecil">
                {pengguna ? 'Atur peringatan' : 'Daftar sekarang'}
              </Button>
            )}
          </Card>
        </motion.div>
      </motion.section>
    </div>
  )
}
