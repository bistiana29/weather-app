import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RadioTower, RotateCw, Send, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { getGateway, getNotifikasiLog, getPenggunaAdmin, kirimUlangNotifikasi } from '../../api/admin'
import { MAKS_KELURAHAN_PANTAUAN } from '../../api/pengguna'
import BadgeStatus from '../../components/admin/BadgeStatus'
import BarisSkeleton from '../../components/admin/BarisSkeleton'
import KepalaAdmin from '../../components/admin/KepalaAdmin'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Pesan from '../../components/ui/Pesan'
import Skeleton from '../../components/ui/Skeleton'
import { VARIAN_GRID, VARIAN_KARTU } from '../../lib/animasi'
import { formatPanjang, formatWaktuWib } from '../../lib/tanggal'
import '../../styles/pages/Admin.css'

// Halaman notifikasi: status gateway, log kiriman 12.00 WIB, kirim ulang, dan daftar pengguna
export default function Notifikasi() {
  const queryClient = useQueryClient()
  const gatewayQ = useQuery({ queryKey: ['admin', 'gateway'], queryFn: getGateway })
  const logQ = useQuery({ queryKey: ['admin', 'notifikasi-log'], queryFn: getNotifikasiLog })
  const penggunaQ = useQuery({ queryKey: ['admin', 'pengguna'], queryFn: getPenggunaAdmin })

  const kirimUlang = useMutation({
    mutationFn: kirimUlangNotifikasi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifikasi-log'] }),
  })

  const log = logQ.data ?? []
  const hitung = (status) => log.filter((n) => n.status === status).length

  return (
    <div className="admin">
      <KepalaAdmin judul="Notifikasi" deskripsi="Pengiriman peringatan WhatsApp pukul 12.00 WIB untuk periode esok hari." />

      <motion.div className="admin-grid" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <motion.section variants={VARIAN_KARTU} className="span-sepertiga" aria-labelledby="gateway-judul">
          <Card className="admin-kartu">
            <h2 id="gateway-judul" className="admin-judul-kartu">
              <RadioTower size={20} aria-hidden="true" />
              Gateway pesan
            </h2>
            {gatewayQ.isPending ? (
              <div className="gateway" aria-hidden="true">
                <Skeleton width={110} height={26} radius={999} />
                <Skeleton width="80%" height={16} />
                <Skeleton width="60%" height={16} />
              </div>
            ) : (
              <dl className="gateway">
                <div>
                  <dt className="teks-sekunder">Status</dt>
                  <dd><BadgeStatus status={gatewayQ.data.status} /></dd>
                </div>
                <div>
                  <dt className="teks-sekunder">Penyedia</dt>
                  <dd>{gatewayQ.data.penyedia}</dd>
                </div>
                <div>
                  <dt className="teks-sekunder">Nomor pengirim</dt>
                  <dd>{gatewayQ.data.nomor_pengirim}</dd>
                </div>
                <div>
                  <dt className="teks-sekunder">Diperiksa</dt>
                  <dd>{formatWaktuWib(gatewayQ.data.diperiksa_at)}</dd>
                </div>
              </dl>
            )}
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-dua-pertiga" aria-labelledby="ringkas-judul">
          <Card className="admin-kartu">
            <h2 id="ringkas-judul" className="admin-judul-kartu">
              <Send size={20} aria-hidden="true" />
              Kiriman terakhir
            </h2>
            {logQ.isPending ? (
              <div className="ringkas-kirim" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={72} radius={16} />
                ))}
              </div>
            ) : (
              <>
                <p className="teks-sekunder">Prakiraan {log[0] ? formatPanjang(log[0].tanggal_prakiraan) : '–'}, dikirim mulai 12.00 WIB.</p>
                <div className="ringkas-kirim">
                  {[
                    ['terkirim', 'Terkirim'],
                    ['gagal', 'Gagal'],
                  ].map(([status, label]) => (
                    <p key={status} className={`ringkas-kirim-item ${status}`}>
                      <span className="angka-utama">{hitung(status)}</span>
                      <span>{label}</span>
                    </p>
                  ))}
                  <p className="ringkas-kirim-item">
                    <span className="angka-utama">{log.length}</span>
                    <span>Total pengguna</span>
                  </p>
                </div>
              </>
            )}
          </Card>
        </motion.section>

        <motion.section variants={VARIAN_KARTU} className="span-penuh" aria-labelledby="log-judul">
          <Card className="admin-kartu">
            <h2 id="log-judul" className="admin-judul-kartu">
              <Send size={20} aria-hidden="true" />
              Log kiriman 12.00 WIB
            </h2>
            {kirimUlang.isError && <Pesan nada="galat">{kirimUlang.error.message}</Pesan>}
            <div className="gulir-horizontal">
              <table className="tabel">
                <thead>
                  <tr>
                    <th scope="col">Pengguna</th>
                    <th scope="col">No. WA</th>
                    <th scope="col">Kelurahan</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="angka">Percobaan</th>
                    <th scope="col">Waktu</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {logQ.isPending ? (
                    <BarisSkeleton kolom={7} baris={5} />
                  ) : (
                    log.map((n) => (
                      <tr key={n.id}>
                        <td>{n.pengguna}</td>
                        <td>{n.no_wa_samar}</td>
                        <td>{n.kelurahan.join(', ')}</td>
                        <td>
                          <BadgeStatus status={n.status} />
                          {n.pesan_error && <span className="log-galat">{n.pesan_error}</span>}
                        </td>
                        <td className="angka">{n.percobaan}</td>
                        <td>{formatWaktuWib(n.dikirim_at)}</td>
                        <td>
                          {n.status === 'gagal' && (
                            <Button
                              ukuran="kecil"
                              variant="sekunder"
                              ikon={RotateCw}
                              disabled={kirimUlang.isPending && kirimUlang.variables === n.id}
                              onClick={() => kirimUlang.mutate(n.id)}
                              aria-label={`Kirim ulang ke ${n.pengguna}`}
                            >
                              {kirimUlang.isPending && kirimUlang.variables === n.id ? 'Mengirim…' : 'Kirim ulang'}
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

        <motion.section variants={VARIAN_KARTU} className="span-penuh" aria-labelledby="pengguna-judul">
          <Card className="admin-kartu">
            <h2 id="pengguna-judul" className="admin-judul-kartu">
              <Users size={20} aria-hidden="true" />
              Daftar pengguna
            </h2>
            <p className="teks-sekunder admin-catatan">Email dan nomor WhatsApp ditampilkan tersamar.</p>
            <div className="gulir-horizontal">
              <table className="tabel">
                <thead>
                  <tr>
                    <th scope="col">Pengguna</th>
                    <th scope="col">Email</th>
                    <th scope="col">No. WA</th>
                    <th scope="col">Notifikasi</th>
                    <th scope="col" className="angka">Pantauan</th>
                    <th scope="col">Persetujuan WA</th>
                    <th scope="col">Terverifikasi</th>
                  </tr>
                </thead>
                <tbody>
                  {penggunaQ.isPending ? (
                    <BarisSkeleton kolom={7} baris={5} />
                  ) : (
                    penggunaQ.data.map((u) => (
                      <tr key={u.id}>
                        <td>{u.nama}</td>
                        <td>{u.email_samar}</td>
                        <td>{u.no_wa_samar}</td>
                        <td>{u.notif_wa ? 'Aktif' : 'Nonaktif'}</td>
                        <td className="angka">{u.jumlah_pantauan}/{MAKS_KELURAHAN_PANTAUAN}</td>
                        <td>{formatWaktuWib(u.persetujuan_wa_at)}</td>
                        <td>{formatWaktuWib(u.terverifikasi_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.section>
      </motion.div>
    </div>
  )
}
