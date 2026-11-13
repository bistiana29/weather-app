import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MapPin, Trash2, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { getPengaturan, MAKS_KELURAHAN_PANTAUAN, simpanPengaturan } from '../api/pengguna'
import { getKelurahanGeojson } from '../api/publik'
import DialogHapusAkun from '../components/pengaturan/DialogHapusAkun'
import DialogUbahPassword from '../components/pengaturan/DialogUbahPassword'
import SimulasiPesan from '../components/pengaturan/SimulasiPesan'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Pesan from '../components/ui/Pesan'
import SearchInput from '../components/ui/SearchInput'
import Skeleton from '../components/ui/Skeleton'
import Switch from '../components/ui/Switch'
import { VARIAN_GRID, VARIAN_KARTU } from '../lib/animasi'
import { useAuth } from '../lib/auth'
import { hariIniWib, tambahHari } from '../lib/tanggal'
import '../styles/pages/Pengaturan.css'

const samaUrutan = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

// Kartu bagian pengaturan dengan judul ber-ikon
function Bagian({ ikon: Ikon, judul, aksi, children, className = '' }) {
  return (
    <motion.div variants={VARIAN_KARTU} className={className}>
      <Card className="bagian">
        {judul && (
          <div className="bagian-kepala">
            <h2>
              {Ikon && <Ikon size={20} aria-hidden="true" />}
              {judul}
            </h2>
            {aksi}
          </div>
        )}
        {children}
      </Card>
    </motion.div>
  )
}

// Halaman pengaturan akun dan notifikasi peringatan WA
export default function Pengaturan() {
  const { keluar } = useAuth()
  const queryClient = useQueryClient()
  const besok = tambahHari(hariIniWib(), 1)
  const [draf, setDraf] = useState(null)
  const [pesanStatus, setPesanStatus] = useState('')
  const [pesanPassword, setPesanPassword] = useState('')
  const [dialogPassword, setDialogPassword] = useState(false)
  const [dialogHapus, setDialogHapus] = useState(false)

  const pengaturanQuery = useQuery({ queryKey: ['pengaturan'], queryFn: getPengaturan })
  const geojsonQuery = useQuery({ queryKey: ['geojson'], queryFn: getKelurahanGeojson, staleTime: Infinity, gcTime: Infinity })

  const indeksKelurahan = useMemo(
    () => Object.fromEntries((geojsonQuery.data?.features ?? []).map((f) => [f.properties.kode_kel, f.properties])),
    [geojsonQuery.data],
  )

  const tersimpan = pengaturanQuery.data
  const nilai = draf ?? tersimpan
  const berubah = Boolean(draf && tersimpan) && (draf.notif_wa !== tersimpan.notif_wa || !samaUrutan(draf.kelurahan, tersimpan.kelurahan))
  const memuat = pengaturanQuery.isPending
  const penuh = (nilai?.kelurahan.length ?? 0) >= MAKS_KELURAHAN_PANTAUAN

  const itemCari = useMemo(
    () =>
      Object.values(indeksKelurahan)
        .filter((p) => !nilai?.kelurahan.includes(p.kode_kel))
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: `Kec. ${p.kecamatan}` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeksKelurahan, nilai],
  )

  const simpan = useMutation({
    mutationFn: simpanPengaturan,
    onSuccess: (hasil) => {
      queryClient.setQueryData(['pengaturan'], (lama) => ({ ...lama, ...hasil }))
      setDraf(null)
      setPesanStatus('Pengaturan tersimpan.')
    },
  })

  // Ubah draf dari nilai tersimpan; pesan status lama dibersihkan
  function ubahDraf(ubah) {
    setPesanStatus('')
    simpan.reset()
    setDraf((lama) => {
      const dasar = lama ?? { notif_wa: tersimpan.notif_wa, kelurahan: tersimpan.kelurahan }
      return { ...dasar, ...ubah(dasar) }
    })
  }

  // ProtectedRoute mengalihkan ke /masuk; pesan dibawa lewat konteks auth
  function tanganiTerhapus() {
    keluar('Akun Anda sudah dihapus.')
  }

  return (
    <div className="pengaturan">
      <header className="pengaturan-kepala">
        <h1>Pengaturan Akun & Notifikasi</h1>
        <p className="teks-sekunder">Atur peringatan dini WhatsApp dan kelurahan yang ingin Anda pantau.</p>
      </header>

      {pengaturanQuery.isError && (
        <Pesan nada="galat">
          Pengaturan gagal dimuat.{' '}
          <button type="button" className="tautan-teks" onClick={() => pengaturanQuery.refetch()}>
            Coba lagi
          </button>
        </Pesan>
      )}

      <motion.div className="pengaturan-grid" variants={VARIAN_GRID} initial="awal" animate="tampil">
        <div className="pengaturan-kiri">
          <Bagian>
            {memuat ? (
              <div className="switch-baris" aria-hidden="true">
                <div className="bagian-skeleton-teks">
                  <Skeleton width={190} height={20} />
                  <Skeleton width={260} height={16} />
                </div>
                <Skeleton width={60} height={34} radius={999} />
              </div>
            ) : (
              <Switch
                label="Peringatan Dini WhatsApp"
                deskripsi="Dikirim pukul 12.00 WIB, sehari sebelumnya, untuk periode 00.00–23.59 WIB."
                checked={nilai.notif_wa}
                onCheckedChange={(v) => ubahDraf(() => ({ notif_wa: v }))}
              />
            )}
          </Bagian>

          <Bagian
            ikon={MapPin}
            judul="Kelurahan pantauan"
            aksi={
              <span className="pantauan-hitung" aria-live="polite">
                {memuat ? '–' : nilai.kelurahan.length}/{MAKS_KELURAHAN_PANTAUAN}
              </span>
            }
          >
            <SearchInput
              items={itemCari}
              onSelect={(item) => ubahDraf((d) => ({ kelurahan: [...d.kelurahan, item.value] }))}
              placeholder={penuh ? `Maksimal ${MAKS_KELURAHAN_PANTAUAN} kelurahan` : 'Cari kelurahan…'}
              label="Cari kelurahan pantauan"
              disabled={memuat || penuh}
            />
            {penuh && <p className="teks-sekunder pantauan-catatan">Hapus salah satu kelurahan untuk menggantinya.</p>}
            <ul className="pantauan-tag" aria-label="Kelurahan pantauan terpilih">
              {memuat &&
                [140, 120].map((w) => (
                  <li key={w} aria-hidden="true">
                    <Skeleton width={w} height={44} radius={999} />
                  </li>
                ))}
              <AnimatePresence initial={false}>
                {!memuat &&
                  nilai.kelurahan.map((kode) => {
                    const nama = indeksKelurahan[kode]?.kelurahan ?? kode
                    return (
                      <motion.li
                        key={kode}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.18 }}
                        className="tag"
                      >
                        <span>{nama}</span>
                        <button
                          type="button"
                          className="tag-hapus"
                          aria-label={`Hapus ${nama} dari pantauan`}
                          onClick={() => ubahDraf((d) => ({ kelurahan: d.kelurahan.filter((k) => k !== kode) }))}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </motion.li>
                    )
                  })}
              </AnimatePresence>
            </ul>
            {!memuat && !nilai.kelurahan.length && (
              <p className="teks-sekunder">Belum ada kelurahan. Pilih minimal satu agar peringatan bisa dikirim.</p>
            )}
          </Bagian>

          <Bagian ikon={UserRound} judul="Info akun">
            <dl className="info-akun">
              {[
                ['Nama', tersimpan?.akun.nama],
                ['Email', tersimpan?.akun.email],
                ['No. WhatsApp', tersimpan?.akun.no_wa],
              ].map(([label, isi]) => (
                <div key={label}>
                  <dt className="teks-sekunder">{label}</dt>
                  <dd>{memuat ? <Skeleton width={160} height={18} /> : isi || '–'}</dd>
                </div>
              ))}
            </dl>
            {pesanPassword && <Pesan>{pesanPassword}</Pesan>}
            <p className="teks-sekunder info-akun-catatan">Data akun hanya bisa dibaca.</p>
            <Button variant="sekunder" ikon={KeyRound} onClick={() => setDialogPassword(true)} className="info-akun-tombol">
              Ubah password
            </Button>
          </Bagian>

          <Bagian className="bagian-hapus">
            <div className="hapus-baris">
              <div>
                <h2>Hapus akun</h2>
                <p className="teks-sekunder">Menghapus akun dan menghentikan semua peringatan.</p>
              </div>
              <Button variant="bahaya-lunak" ikon={Trash2} onClick={() => setDialogHapus(true)}>
                Hapus
              </Button>
            </div>
          </Bagian>

          <div className={`pengaturan-aksi ${berubah ? 'mengambang' : ''}`} role="group" aria-label="Simpan perubahan">
            <div className="pengaturan-aksi-status" aria-live="polite">
              {simpan.isError && <span className="field-galat">{simpan.error.message}</span>}
              {!simpan.isError && berubah && <span className="teks-sekunder">Ada perubahan yang belum disimpan.</span>}
              {!simpan.isError && !berubah && pesanStatus && <span className="pengaturan-tersimpan">{pesanStatus}</span>}
            </div>
            <Button variant="sekunder" disabled={!berubah || simpan.isPending} onClick={() => setDraf(null)}>
              Batal
            </Button>
            <Button disabled={!berubah || simpan.isPending} onClick={() => simpan.mutate(draf)}>
              {simpan.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </div>

        <motion.aside variants={VARIAN_KARTU} className="pengaturan-kanan">
          <Card className="bagian">
            <SimulasiPesan
              memuatPengaturan={memuat}
              aktif={nilai?.notif_wa ?? true}
              pantauan={nilai?.kelurahan ?? []}
              indeksKelurahan={indeksKelurahan}
              tgl={besok}
            />
          </Card>
        </motion.aside>
      </motion.div>

      <DialogUbahPassword
        open={dialogPassword}
        onOpenChange={setDialogPassword}
        onBerhasil={() => setPesanPassword('Password berhasil diubah.')}
      />
      <DialogHapusAkun open={dialogHapus} onOpenChange={setDialogHapus} onTerhapus={tanganiTerhapus} />
    </div>
  )
}
