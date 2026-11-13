import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpCircle, BrainCircuit, History, LineChart as IkonGrafik, RotateCcw, Scale } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getDriftParameter, getEvaluasiModel, getModelRegistry, getRiwayatModel, getSumberPrioritas } from '../../api/admin'
import BadgeStatus from '../../components/admin/BadgeStatus'
import BarisSkeleton from '../../components/admin/BarisSkeleton'
import DialogAksiModel from '../../components/admin/DialogAksiModel'
import KepalaAdmin from '../../components/admin/KepalaAdmin'
import { LABEL_SUMBER } from '../../components/admin/label'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Pesan from '../../components/ui/Pesan'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../../lib/animasi'
import { DAFTAR_PARAMETER, PARAMETER } from '../../lib/kategori'
import { formatRingkas, formatWaktuWib } from '../../lib/tanggal'
import '../../styles/components/peta.css'
import '../../styles/pages/Admin.css'

const METRIK_KOSONG = '[ ]'
const metrik = (n) => (n == null ? METRIK_KOSONG : n.toLocaleString('id-ID', { maximumFractionDigits: 3 }))

// Grafik RMSE produksi vs baseline persistence dengan batas drift; kosong jika metrik belum ada
function GrafikEvaluasi({ data, memuat }) {
  const adaNilai = data?.some((d) => d.rmse_produksi != null)
  if (memuat) return <Skeleton height={260} radius={16} />
  return (
    <figure className="grafik-evaluasi">
      <figcaption className="grafik-legenda">
        <span><i className="garis-observasi" aria-hidden="true" />RMSE produksi</span>
        <span><i className="garis-prediksi" aria-hidden="true" />Baseline persistence</span>
        <span><i className="garis-ambang" aria-hidden="true" />Batas drift</span>
      </figcaption>
      <div className="grafik-evaluasi-area" role="img" aria-label={adaNilai ? 'Grafik RMSE 30 hari terakhir' : 'Grafik RMSE 30 hari terakhir, metrik belum tersedia'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="#D7E4EE" />
            <XAxis dataKey="tanggal" tickFormatter={formatRingkas} interval={6} tick={{ fontSize: 11, fill: '#4A5D78' }} tickLine={false} axisLine={{ stroke: '#C9DBE8' }} />
            <YAxis domain={[0, 1]} tickFormatter={() => METRIK_KOSONG} tick={{ fontSize: 11, fill: '#4A5D78' }} tickLine={false} axisLine={false} width={44} />
            <Line dataKey="rmse_produksi" stroke="#1B365D" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="rmse_persistence" stroke="#005A9C" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line dataKey="batas_drift" stroke="#C21F3A" strokeWidth={1.5} strokeDasharray="2 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        {!adaNilai && <p className="grafik-evaluasi-kosong">Metrik evaluasi belum tersedia {METRIK_KOSONG}</p>}
      </div>
    </figure>
  )
}

// Halaman model: evaluasi, registry versi, promosi/rollback, sumber prioritas, riwayat
export default function Model() {
  const queryClient = useQueryClient()
  const [parameter, setParameter] = useState('hujan')
  const [aksi, setAksi] = useState(null)
  const [pesan, setPesan] = useState('')
  const registryQ = useQuery({ queryKey: ['admin', 'model-registry'], queryFn: getModelRegistry })
  const evaluasiQ = useQuery({ queryKey: ['admin', 'evaluasi-model', parameter], queryFn: () => getEvaluasiModel(parameter) })
  const driftQ = useQuery({ queryKey: ['admin', 'drift'], queryFn: getDriftParameter })
  const sumberQ = useQuery({ queryKey: ['admin', 'sumber-prioritas'], queryFn: getSumberPrioritas })
  const riwayatQ = useQuery({ queryKey: ['admin', 'riwayat-model'], queryFn: getRiwayatModel })

  const produksiDari = (p) => registryQ.data?.find((m) => m.parameter === p && m.tahap === 'production')
  const urutTahap = { staging: 0, production: 1, archived: 2 }
  const registry = [...(registryQ.data ?? [])].sort(
    (a, b) =>
      DAFTAR_PARAMETER.findIndex((p) => p.slug === a.parameter) - DAFTAR_PARAMETER.findIndex((p) => p.slug === b.parameter) ||
      urutTahap[a.tahap] - urutTahap[b.tahap],
  )

  function selesaiAksi(teks) {
    setAksi(null)
    setPesan(teks)
    queryClient.invalidateQueries({ queryKey: ['admin', 'model-registry'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'riwayat-model'] })
  }

  return (
    <div className="admin">
      <KepalaAdmin judul="Model / MLOps" deskripsi="Performa model terhadap baseline, versi model per parameter, dan sumber data prioritas." />
      {pesan && <Pesan>{pesan}</Pesan>}

      <motion.div className="admin-grid" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <motion.section variants={VARIAN_KARTU} className="span-penuh" aria-labelledby="evaluasi-judul">
          <Card className="admin-kartu">
            <div className="admin-kartu-kepala">
              <h2 id="evaluasi-judul" className="admin-judul-kartu">
                <IkonGrafik size={20} aria-hidden="true" />
                RMSE produksi vs baseline persistence (30 hari)
              </h2>
              <div className="admin-filter">
                <Select
                  label="Parameter"
                  sembunyikanLabel
                  value={parameter}
                  onValueChange={setParameter}
                  options={DAFTAR_PARAMETER.map((p) => ({ value: p.slug, label: p.judul }))}
                />
              </div>
            </div>
            {driftQ.data?.[parameter] && (
              <Pesan nada="galat">Drift terdeteksi: RMSE model {PARAMETER[parameter].judul.toLowerCase()} melewati batas drift.</Pesan>
            )}
            <GrafikEvaluasi data={evaluasiQ.data} memuat={evaluasiQ.isPending} />
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-penuh" aria-labelledby="registry-judul">
          <Card className="admin-kartu">
            <h2 id="registry-judul" className="admin-judul-kartu">
              <BrainCircuit size={20} aria-hidden="true" />
              Registry model
            </h2>
            <div className="gulir-horizontal">
              <table className="tabel">
                <thead>
                  <tr>
                    <th scope="col">Parameter</th>
                    <th scope="col">Model</th>
                    <th scope="col">Versi</th>
                    <th scope="col">Tahap</th>
                    <th scope="col">Sumber data</th>
                    <th scope="col">Data latih</th>
                    <th scope="col">Dilatih</th>
                    <th scope="col" className="angka">RMSE</th>
                    <th scope="col" className="angka">R²</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {registryQ.isPending ? (
                    <BarisSkeleton kolom={10} baris={6} />
                  ) : (
                    registry.map((m) => (
                      <tr key={m.id}>
                        <td>{PARAMETER[m.parameter].label}</td>
                        <td>{m.jenis_model}</td>
                        <td>{m.versi}</td>
                        <td><BadgeStatus status={m.tahap} /></td>
                        <td>{LABEL_SUMBER[m.sumber_data]}</td>
                        <td>{m.rentang_latih_mulai.slice(0, 4)}–{m.rentang_latih_akhir.slice(0, 4)}</td>
                        <td>{formatWaktuWib(m.dilatih_pada)}</td>
                        <td className="angka">{metrik(m.rmse)}</td>
                        <td className="angka">{metrik(m.r2)}</td>
                        <td>
                          {m.tahap === 'staging' && (
                            <Button ukuran="kecil" ikon={ArrowUpCircle} onClick={() => setAksi({ jenis: 'promosi', model: m })}>
                              Promosikan
                            </Button>
                          )}
                          {m.tahap === 'archived' && (
                            <Button ukuran="kecil" variant="sekunder" ikon={RotateCcw} onClick={() => setAksi({ jenis: 'rollback', model: m })}>
                              Rollback
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-dua-pertiga" aria-labelledby="sumber-judul">
          <Card className="admin-kartu">
            <h2 id="sumber-judul" className="admin-judul-kartu">
              <Scale size={20} aria-hidden="true" />
              Sumber prioritas per parameter
            </h2>
            <div className="gulir-horizontal">
              <table className="tabel">
                <thead>
                  <tr>
                    <th scope="col">Parameter</th>
                    <th scope="col">Sumber</th>
                    <th scope="col">Kolom</th>
                    <th scope="col">Metrik</th>
                    <th scope="col" className="angka">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {sumberQ.isPending ? (
                    <BarisSkeleton kolom={5} baris={5} />
                  ) : (
                    sumberQ.data.map((s) => (
                      <tr key={s.parameter}>
                        <td>{PARAMETER[s.parameter].label}</td>
                        <td>{LABEL_SUMBER[s.sumber]}</td>
                        <td><code>{s.kolom_sumber}</code></td>
                        <td>{s.metrik}</td>
                        <td className="angka">{metrik(s.nilai_metrik)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-sepertiga" aria-labelledby="riwayat-judul">
          <Card className="admin-kartu">
            <h2 id="riwayat-judul" className="admin-judul-kartu">
              <History size={20} aria-hidden="true" />
              Riwayat promosi & rollback
            </h2>
            {riwayatQ.isPending ? (
              <div className="riwayat" aria-hidden="true">
                <Skeleton height={64} radius={14} />
              </div>
            ) : riwayatQ.data.length ? (
              <ul className="riwayat">
                {riwayatQ.data.map((r) => (
                  <li key={r.id} className="riwayat-item">
                    <p>
                      <strong>{r.aksi === 'promosi' ? 'Promosi' : 'Rollback'}</strong> {PARAMETER[r.parameter].label}: {r.dari_versi ?? '–'} → {r.ke_versi}
                    </p>
                    <p className="teks-sekunder">"{r.alasan}"</p>
                    <p className="teks-sekunder riwayat-meta">{r.admin} · {formatWaktuWib(r.dilakukan_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="teks-sekunder">Belum ada perubahan model.</p>
            )}
          </Card>
        </motion.section>
      </motion.div>

      <DialogAksiModel
        key={aksi?.model.id ?? 'kosong'}
        aksi={aksi?.jenis}
        model={aksi?.model}
        produksi={aksi ? produksiDari(aksi.model.parameter) : null}
        onTutup={() => setAksi(null)}
        onBerhasil={selesaiAksi}
      />
    </div>
  )
}
