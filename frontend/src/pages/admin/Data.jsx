import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Database, FileUp, History, MapPin, Table2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { getIngestionLog, getKelengkapanHarian, getKelurahan, getStasiunBmkg, getStatusDataParameter, getStatusPengambilan } from '../../api/admin'
import BadgeStatus from '../../components/admin/BadgeStatus'
import BarisSkeleton from '../../components/admin/BarisSkeleton'
import DialogBackfill from '../../components/admin/DialogBackfill'
import HeatmapKelengkapan from '../../components/admin/HeatmapKelengkapan'
import KepalaAdmin from '../../components/admin/KepalaAdmin'
import { LABEL_GRANULARITAS, LABEL_SUMBER } from '../../components/admin/label'
import UnggahCsvBmkg from '../../components/admin/UnggahCsvBmkg'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../../lib/animasi'
import { formatDurasi, formatWaktuWib } from '../../lib/tanggal'
import '../../styles/pages/Admin.css'

const angka = (n) => (n == null ? '–' : Number(n).toLocaleString('id-ID'))
const tanggalSaja = (iso) => (iso ? formatWaktuWib(iso).split(' ').slice(0, 3).join(' ') : '–')

// Bagian halaman dengan kartu dan judul ber-ikon
function Bagian({ ikon: Ikon, judul, aksi, className = '', children }) {
  return (
    <motion.section variants={VARIAN_KARTU} className={className} aria-label={judul}>
      <Card className="admin-kartu">
        <div className="admin-kartu-kepala">
          <h2 className="admin-judul-kartu">
            <Ikon size={20} aria-hidden="true" />
            {judul}
          </h2>
          {aksi}
        </div>
        {children}
      </Card>
    </motion.section>
  )
}

// Halaman data ETL: status pengambilan, kelengkapan, inventaris kolom, titik, log job, backfill, unggah CSV
export default function Data() {
  const [granularitas, setGranularitas] = useState('hourly')
  const [dialogBackfill, setDialogBackfill] = useState(false)
  const pengambilanQ = useQuery({ queryKey: ['admin', 'status-pengambilan'], queryFn: getStatusPengambilan })
  const kelengkapanQ = useQuery({ queryKey: ['admin', 'kelengkapan-harian'], queryFn: getKelengkapanHarian })
  const parameterQ = useQuery({ queryKey: ['admin', 'status-data-parameter'], queryFn: getStatusDataParameter })
  const logQ = useQuery({ queryKey: ['admin', 'ingestion-log'], queryFn: () => getIngestionLog(50) })
  const kelurahanQ = useQuery({ queryKey: ['admin', 'kelurahan'], queryFn: getKelurahan })
  const stasiunQ = useQuery({ queryKey: ['admin', 'stasiun'], queryFn: getStasiunBmkg })

  const desaPerId = useMemo(() => Object.fromEntries((kelurahanQ.data ?? []).map((k) => [k.kelurahan_id, k.desa])), [kelurahanQ.data])
  const metodeTitik = useMemo(() => {
    const hitung = {}
    kelurahanQ.data?.forEach((k) => {
      hitung[k.metode_titik] = (hitung[k.metode_titik] ?? 0) + 1
    })
    return hitung
  }, [kelurahanQ.data])
  const polylabel = kelurahanQ.data?.filter((k) => k.metode_titik === 'polylabel') ?? []
  const inventaris = parameterQ.data?.filter((b) => b.granularitas === granularitas) ?? []

  return (
    <div className="admin">
      <KepalaAdmin
        judul="Data (ETL)"
        deskripsi="Cakupan data NASA POWER dan Open-Meteo, riwayat job, dan unggah observasi BMKG."
        aksi={
          <Button ikon={CalendarRange} onClick={() => setDialogBackfill(true)}>
            Backfill
          </Button>
        }
      />

      <motion.div className="admin-grid" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <Bagian ikon={Database} judul="Status pengambilan data" className="span-penuh">
          <div className="gulir-horizontal">
            <table className="tabel">
              <thead>
                <tr>
                  <th scope="col">Sumber</th>
                  <th scope="col">Granularitas</th>
                  <th scope="col">Run sukses terakhir</th>
                  <th scope="col">Data terbaru</th>
                  <th scope="col">Run gagal 24 jam</th>
                  <th scope="col">Kosong 7 hari</th>
                </tr>
              </thead>
              <tbody>
                {pengambilanQ.isPending ? (
                  <BarisSkeleton kolom={6} baris={2} />
                ) : (
                  pengambilanQ.data.map((s) => (
                    <tr key={s.sumber}>
                      <td>{LABEL_SUMBER[s.sumber]}</td>
                      <td>{s.granularitas}</td>
                      <td>{formatWaktuWib(s.run_sukses_terakhir_wib)}</td>
                      <td>{formatWaktuWib(s.data_terbaru_wib)}</td>
                      <td>{s.run_gagal_24_jam_terakhir > 0 ? <BadgeStatus status="peringatan" /> : null} {s.run_gagal_24_jam_terakhir}</td>
                      <td>{s.persen_null_7_hari == null ? '–' : `${s.persen_null_7_hari.toLocaleString('id-ID')}%`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Bagian>

        <Bagian ikon={Table2} judul="Kelengkapan 14 hari terakhir" className="span-penuh">
          <p className="teks-sekunder admin-catatan">Persen sel terisi per hari WIB (153 kelurahan × 24 jam). Hari tanpa baris berarti belum diambil.</p>
          <HeatmapKelengkapan data={kelengkapanQ.data} memuat={kelengkapanQ.isPending} />
        </Bagian>

        <Bagian
          ikon={Database}
          judul="Inventaris kolom"
          className="span-penuh"
          aksi={
            <div className="admin-filter">
              <Select
                label="Granularitas"
                sembunyikanLabel
                value={granularitas}
                onValueChange={setGranularitas}
                options={Object.entries(LABEL_GRANULARITAS).map(([value, label]) => ({ value, label }))}
              />
            </div>
          }
        >
          <div className="gulir-horizontal">
            <table className="tabel">
              <thead>
                <tr>
                  <th scope="col">Sumber</th>
                  <th scope="col">Parameter</th>
                  <th scope="col">Data mulai</th>
                  <th scope="col">Data terakhir</th>
                  <th scope="col" className="angka">Jumlah baris</th>
                  <th scope="col" className="angka">Terisi</th>
                  <th scope="col" className="angka">Kosong</th>
                </tr>
              </thead>
              <tbody>
                {parameterQ.isPending ? (
                  <BarisSkeleton kolom={7} baris={6} />
                ) : (
                  inventaris.map((b) => (
                    <tr key={`${b.sumber}-${b.parameter}`}>
                      <td>{LABEL_SUMBER[b.sumber]}</td>
                      <td><code>{b.parameter}</code></td>
                      <td>{formatWaktuWib(b.data_mulai)}</td>
                      <td>{formatWaktuWib(b.data_terakhir)}</td>
                      <td className="angka">{angka(b.jumlah_baris)}</td>
                      <td className="angka">{angka(b.jumlah_terisi)}</td>
                      <td className="angka">{b.persen_kosong.toLocaleString('id-ID')}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Bagian>

        <Bagian ikon={History} judul="Log job (ingestion_log)" className="span-penuh">
          <div className="gulir-horizontal">
            <table className="tabel tabel-log">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Job</th>
                  <th scope="col">Sumber</th>
                  <th scope="col">Kelurahan / tujuan</th>
                  <th scope="col">Rentang</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="angka">Baris</th>
                  <th scope="col">Mulai</th>
                  <th scope="col">Durasi</th>
                </tr>
              </thead>
              <tbody>
                {logQ.isPending ? (
                  <BarisSkeleton kolom={9} baris={6} />
                ) : (
                  logQ.data.map((r) => (
                    <tr key={r.id}>
                      <td className="angka">{r.id}</td>
                      <td><code>{r.job}</code></td>
                      <td>{LABEL_SUMBER[r.sumber]}</td>
                      <td>
                        {r.kelurahan_id ? desaPerId[r.kelurahan_id] ?? `#${r.kelurahan_id}` : <code>{r.tujuan}</code>}
                        {r.pesan_error && <span className="log-galat">{r.pesan_error}</span>}
                      </td>
                      <td>{r.rentang_mulai ? `${tanggalSaja(r.rentang_mulai)} – ${tanggalSaja(r.rentang_akhir)}` : '–'}</td>
                      <td><BadgeStatus status={r.status} /></td>
                      <td className="angka">{angka(r.jumlah_baris)}</td>
                      <td>{formatWaktuWib(r.mulai_at)}</td>
                      <td>{r.status === 'running' ? 'berjalan' : formatDurasi(r.mulai_at, r.selesai_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Bagian>

        <Bagian ikon={MapPin} judul="Titik pengambilan" className="span-setengah">
          {kelurahanQ.isPending || stasiunQ.isPending ? (
            <div className="titik" aria-hidden="true">
              <Skeleton height={56} radius={14} />
              <Skeleton height={120} radius={14} />
            </div>
          ) : (
            <div className="titik">
              <div className="titik-ringkas">
                <p>
                  <span className="angka-utama">{kelurahanQ.data.length}</span> kelurahan
                </p>
                <p className="teks-sekunder">
                  {Object.entries(metodeTitik).map(([m, n]) => `${n} ${m}`).join(' · ')}
                </p>
              </div>
              {polylabel.length > 0 && (
                <div>
                  <p className="titik-sub">Titik polylabel</p>
                  <ul className="titik-daftar">
                    {polylabel.map((k) => (
                      <li key={k.kelurahan_id}>
                        {k.desa} <span className="teks-sekunder">({k.kecamatan})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="titik-sub">Stasiun BMKG (daily)</p>
                <ul className="titik-daftar">
                  {stasiunQ.data.map((s) => (
                    <li key={s.id_wmo}>
                      {s.nama} <span className="teks-sekunder">· {s.id_wmo} · elevasi {s.elevasi_m} m</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Bagian>

        <Bagian ikon={FileUp} judul="Unggah CSV BMKG" className="span-setengah">
          <UnggahCsvBmkg />
        </Bagian>
      </motion.div>

      <DialogBackfill open={dialogBackfill} onOpenChange={setDialogBackfill} />
    </div>
  )
}
