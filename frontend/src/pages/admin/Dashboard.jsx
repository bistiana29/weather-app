import { useQuery } from '@tanstack/react-query'
import { BrainCircuit, ChevronRight, CircleCheck, Database, Send, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { getDriftParameter, getModelRegistry, getNotifikasiLog, getRunHarian, getStatusDataParameter, getStatusPengambilan } from '../../api/admin'
import BadgeStatus from '../../components/admin/BadgeStatus'
import BarisSkeleton from '../../components/admin/BarisSkeleton'
import KepalaAdmin from '../../components/admin/KepalaAdmin'
import { LABEL_SUMBER, LABEL_TAHAP_ALUR } from '../../components/admin/label'
import Card from '../../components/ui/Card'
import Skeleton from '../../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../../lib/animasi'
import { DAFTAR_PARAMETER, PARAMETER } from '../../lib/kategori'
import { formatPanjang, formatWaktuWib } from '../../lib/tanggal'
import '../../styles/pages/Admin.css'

const JAM_MS = 3600 * 1000
const AMBANG_NULL_7_HARI = 10

const jamDari = (iso) => (iso ? formatWaktuWib(iso).split(' ').slice(-2).join(' ') : '–')

// Rata-rata persen terisi kolom hourly per sumber dari status_data_parameter
function persenTerisi(statusParameter, sumber) {
  const baris = statusParameter.filter((b) => b.sumber === sumber && b.granularitas === 'hourly')
  const total = baris.reduce((n, b) => n + b.jumlah_baris, 0)
  const terisi = baris.reduce((n, b) => n + b.jumlah_terisi, 0)
  return total ? (terisi / total) * 100 : null
}

// Susun daftar hal yang perlu diperhatikan dari data status
function susunPerhatian({ pengambilan, run, drift }) {
  const daftar = []
  pengambilan?.forEach((s) => {
    const label = LABEL_SUMBER[s.sumber]
    if (s.run_gagal_24_jam_terakhir > 0) {
      daftar.push({ teks: `${label}: ${s.run_gagal_24_jam_terakhir} run gagal dalam 24 jam terakhir`, ke: '/admin/data' })
    }
    if (s.data_terbaru_wib && Date.now() - new Date(s.data_terbaru_wib) > 24 * JAM_MS) {
      daftar.push({ teks: `${label}: data terbaru masih ${formatWaktuWib(s.data_terbaru_wib)}`, ke: '/admin/data' })
    }
    if (s.persen_null_7_hari > AMBANG_NULL_7_HARI) {
      daftar.push({ teks: `${label}: ${s.persen_null_7_hari.toLocaleString('id-ID')}% sel kosong dalam 7 hari terakhir`, ke: '/admin/data' })
    }
  })
  run?.tahap
    .filter((t) => t.status === 'gagal' || t.status === 'peringatan')
    .forEach((t) => daftar.push({ teks: `${LABEL_TAHAP_ALUR[t.tahap]}: ${t.pesan}`, ke: t.tahap === 'kirim_wa' ? '/admin/notifikasi' : '/admin/data' }))
  Object.entries(drift ?? {})
    .filter(([, ada]) => ada)
    .forEach(([p]) => daftar.push({ teks: `Drift RMSE model ${PARAMETER[p].judul.toLowerCase()} melewati batas`, ke: '/admin/model' }))
  return daftar
}

// Kartu angka ringkas di baris atas dashboard
function KartuAngka({ ikon: Ikon, judul, memuat, children, className = '' }) {
  return (
    <motion.div variants={VARIAN_KARTU} className={className}>
      <Card className="admin-kartu admin-angka">
        <p className="admin-angka-judul">
          <Ikon size={18} aria-hidden="true" />
          {judul}
        </p>
        {memuat ? (
          <div className="admin-angka-isi" aria-hidden="true">
            <Skeleton width="60%" height={34} radius={10} />
            <Skeleton width="80%" height={14} />
          </div>
        ) : (
          <div className="admin-angka-isi">{children}</div>
        )}
      </Card>
    </motion.div>
  )
}

// Ringkasan sistem: status ETL, alur harian, perhatian, dan model produksi
export default function Dashboard() {
  const pengambilanQ = useQuery({ queryKey: ['admin', 'status-pengambilan'], queryFn: getStatusPengambilan })
  const parameterQ = useQuery({ queryKey: ['admin', 'status-data-parameter'], queryFn: getStatusDataParameter })
  const runQ = useQuery({ queryKey: ['admin', 'run-harian'], queryFn: getRunHarian })
  const registryQ = useQuery({ queryKey: ['admin', 'model-registry'], queryFn: getModelRegistry })
  const driftQ = useQuery({ queryKey: ['admin', 'drift'], queryFn: getDriftParameter })
  const notifQ = useQuery({ queryKey: ['admin', 'notifikasi-log'], queryFn: getNotifikasiLog })

  const tahap = Object.fromEntries((runQ.data?.tahap ?? []).map((t) => [t.tahap, t]))
  const terkirim = notifQ.data?.filter((n) => n.status === 'terkirim').length ?? 0
  const perhatian = susunPerhatian({ pengambilan: pengambilanQ.data, run: runQ.data, drift: driftQ.data })
  const memuatPerhatian = pengambilanQ.isPending || runQ.isPending || driftQ.isPending
  const produksi = DAFTAR_PARAMETER.map((p) => registryQ.data?.find((m) => m.parameter === p.slug && m.tahap === 'production'))

  return (
    <div className="admin">
      <KepalaAdmin judul="Ringkasan Sistem" deskripsi="Kesehatan pengambilan data, alur prediksi harian, dan model yang aktif." />

      <motion.div className="admin-grid" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <KartuAngka ikon={Database} judul="Pengambilan data" memuat={pengambilanQ.isPending} className="span-etl">
          <ul className="admin-sumber">
            {pengambilanQ.data?.map((s) => (
              <li key={s.sumber}>
                <span className="admin-sumber-nama">{LABEL_SUMBER[s.sumber]}</span>
                <BadgeStatus status={s.run_gagal_24_jam_terakhir > 0 ? 'peringatan' : 'sukses'} />
                <span className="teks-sekunder">Run sukses {formatWaktuWib(s.run_sukses_terakhir_wib)}</span>
              </li>
            ))}
          </ul>
        </KartuAngka>

        <KartuAngka ikon={CircleCheck} judul="Kelengkapan hourly" memuat={parameterQ.isPending} className="span-kecil">
          {Object.keys(LABEL_SUMBER).map((s) => {
            const persen = persenTerisi(parameterQ.data ?? [], s)
            return (
              <p key={s} className="admin-angka-baris">
                <span className="angka-utama">{persen == null ? '–' : persen.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%</span>
                <span className="teks-sekunder">{LABEL_SUMBER[s]}</span>
              </p>
            )
          })}
        </KartuAngka>

        <KartuAngka ikon={BrainCircuit} judul="Prediksi 12.00 WIB" memuat={runQ.isPending} className="span-kecil">
          <p className="admin-angka-baris">
            <span className="angka-utama">{jamDari(tahap.forecast?.selesai_at)}</span>
          </p>
          <BadgeStatus status={tahap.forecast?.status ?? 'menunggu'} />
          {runQ.data && <p className="teks-sekunder">Untuk {formatPanjang(runQ.data.tanggal_prakiraan)}</p>}
        </KartuAngka>

        <KartuAngka ikon={Send} judul="Pesan WA" memuat={notifQ.isPending} className="span-mini">
          <p className="admin-angka-baris">
            <span className="angka-utama">{terkirim}</span>
            <span className="teks-sekunder">dari {notifQ.data?.length ?? 0} terkirim</span>
          </p>
          <Link to="/admin/notifikasi" className="admin-tautan">Lihat log kiriman</Link>
        </KartuAngka>

        <motion.section variants={VARIAN_KARTU} className="span-penuh" aria-labelledby="alur-judul">
          <Card className="admin-kartu">
            <h2 id="alur-judul" className="admin-judul-kartu">Alur harian</h2>
            <ol className="alur">
              {Object.keys(LABEL_TAHAP_ALUR).map((kode, i) => (
                <li key={kode} className="alur-langkah">
                  <div className={`alur-kotak alur-${tahap[kode]?.status ?? 'menunggu'}`}>
                    <span className="alur-nama">{LABEL_TAHAP_ALUR[kode]}</span>
                    {runQ.isPending ? <Skeleton width={90} height={24} radius={999} /> : <BadgeStatus status={tahap[kode]?.status ?? 'menunggu'} />}
                    <span className="teks-sekunder alur-jam">{runQ.isPending ? ' ' : jamDari(tahap[kode]?.selesai_at)}</span>
                  </div>
                  {i < Object.keys(LABEL_TAHAP_ALUR).length - 1 && <ChevronRight size={20} aria-hidden="true" className="alur-panah" />}
                </li>
              ))}
            </ol>
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-setengah" aria-labelledby="perhatian-judul">
          <Card className="admin-kartu">
            <h2 id="perhatian-judul" className="admin-judul-kartu">
              <TriangleAlert size={20} aria-hidden="true" />
              Perlu perhatian
            </h2>
            {memuatPerhatian ? (
              <div className="perhatian" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={44} radius={12} />
                ))}
              </div>
            ) : perhatian.length ? (
              <ul className="perhatian">
                {perhatian.map((p) => (
                  <li key={p.teks}>
                    <Link to={p.ke} className="perhatian-item">
                      <TriangleAlert size={18} aria-hidden="true" />
                      <span>{p.teks}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="teks-sekunder">Tidak ada yang perlu ditindaklanjuti.</p>
            )}
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-setengah" aria-labelledby="model-judul">
          <Card className="admin-kartu">
            <h2 id="model-judul" className="admin-judul-kartu">
              <BrainCircuit size={20} aria-hidden="true" />
              Model produksi
            </h2>
            <div className="gulir-horizontal">
              <table className="tabel">
                <thead>
                  <tr>
                    <th scope="col">Parameter</th>
                    <th scope="col">Model</th>
                    <th scope="col">Versi</th>
                    <th scope="col">Sumber</th>
                  </tr>
                </thead>
                <tbody>
                  {registryQ.isPending ? (
                    <BarisSkeleton kolom={4} baris={5} />
                  ) : (
                    DAFTAR_PARAMETER.map((p, i) => (
                      <tr key={p.slug}>
                        <td>{p.label}</td>
                        <td>{produksi[i]?.jenis_model ?? '–'}</td>
                        <td>{produksi[i]?.versi ?? '–'}</td>
                        <td>{produksi[i] ? LABEL_SUMBER[produksi[i].sumber_data] : '–'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Link to="/admin/model" className="admin-tautan">Kelola model</Link>
          </Card>
        </motion.section>
      </motion.div>
    </div>
  )
}
