import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, MapPin, Trash2, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { teksGalat } from '../lib/galat'
import { hariIniWib, tambahHari } from '../lib/tanggal'
import '../styles/pages/Pengaturan.css'
import JudulHalaman from '../components/JudulHalaman'

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
  const { t } = useTranslation()
  const { keluar } = useAuth()
  const queryClient = useQueryClient()
  const besok = tambahHari(hariIniWib(), 1)
  const [draf, setDraf] = useState(null)
  const [pesanStatus, setPesanStatus] = useState('')
  const [pesanPassword, setPesanPassword] = useState(false)
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
        .map((p) => ({ value: p.kode_kel, label: p.kelurahan, keterangan: t('peta.kec', { nama: p.kecamatan }) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'id')),
    [indeksKelurahan, nilai, t],
  )

  const simpan = useMutation({
    mutationFn: simpanPengaturan,
    onSuccess: (hasil) => {
      queryClient.setQueryData(['pengaturan'], (lama) => ({ ...lama, ...hasil }))
      setDraf(null)
      setPesanStatus('pengaturan.tersimpan')
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

  // ProtectedRoute mengalihkan ke /login; pesan dibawa lewat konteks auth
  function tanganiTerhapus() {
    keluar('auth.pesan.akunDihapus')
  }

  return (
    <div className="pengaturan">
      <JudulHalaman judul={t('umum.nav.pengaturan')} />
      <header className="pengaturan-kepala">
        <h1>{t('pengaturan.judul')}</h1>
        <p className="teks-sekunder">{t('pengaturan.subjudul')}</p>
      </header>

      {pengaturanQuery.isError && (
        <Pesan nada="galat">
          {t('pengaturan.gagalMuat')}{' '}
          <button type="button" className="tautan-teks" onClick={() => pengaturanQuery.refetch()}>
            {t('umum.cobaLagi')}
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
                label={t('pengaturan.notif.label')}
                deskripsi={t('pengaturan.notif.deskripsi')}
                checked={nilai.notif_wa}
                onCheckedChange={(v) => ubahDraf(() => ({ notif_wa: v }))}
              />
            )}
          </Bagian>

          <Bagian
            ikon={MapPin}
            judul={t('pengaturan.pantauan.judul')}
            aksi={
              <span className="pantauan-hitung" aria-live="polite">
                {memuat ? '–' : nilai.kelurahan.length}/{MAKS_KELURAHAN_PANTAUAN}
              </span>
            }
          >
            <SearchInput
              items={itemCari}
              onSelect={(item) => ubahDraf((d) => ({ kelurahan: [...d.kelurahan, item.value] }))}
              placeholder={penuh ? t('pengaturan.pantauan.penuhPlaceholder', { n: MAKS_KELURAHAN_PANTAUAN }) : t('peta.cariPlaceholder')}
              label={t('pengaturan.pantauan.cariLabel')}
              disabled={memuat || penuh}
            />
            {penuh && <p className="teks-sekunder pantauan-catatan">{t('pengaturan.pantauan.penuhCatatan')}</p>}
            <ul className="pantauan-tag" aria-label={t('pengaturan.pantauan.terpilih')}>
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
                          aria-label={t('pengaturan.pantauan.hapus', { nama })}
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
              <p className="teks-sekunder">{t('pengaturan.pantauan.kosong')}</p>
            )}
          </Bagian>

          <Bagian ikon={UserRound} judul={t('pengaturan.akun.judul')}>
            <dl className="info-akun">
              {[
                ['auth.daftar.nama', tersimpan?.akun.nama],
                ['auth.email', tersimpan?.akun.email],
                ['auth.daftar.noWa', tersimpan?.akun.no_wa],
              ].map(([label, isi]) => (
                <div key={label}>
                  <dt className="teks-sekunder">{t(label)}</dt>
                  <dd>{memuat ? <Skeleton width={160} height={18} /> : isi || '–'}</dd>
                </div>
              ))}
            </dl>
            {pesanPassword && <Pesan>{t('pengaturan.akun.passwordDiubah')}</Pesan>}
            <p className="teks-sekunder info-akun-catatan">{t('pengaturan.akun.hanyaBaca')}</p>
            <Button variant="sekunder" ikon={KeyRound} onClick={() => setDialogPassword(true)} className="info-akun-tombol">
              {t('pengaturan.password.judul')}
            </Button>
          </Bagian>

          <Bagian className="bagian-hapus">
            <div className="hapus-baris">
              <div>
                <h2>{t('pengaturan.hapus.judul')}</h2>
                <p className="teks-sekunder">{t('pengaturan.hapus.teks')}</p>
              </div>
              <Button variant="bahaya-lunak" ikon={Trash2} onClick={() => setDialogHapus(true)}>
                {t('pengaturan.hapus.tombol')}
              </Button>
            </div>
          </Bagian>

          <div className={`pengaturan-aksi ${berubah ? 'mengambang' : ''}`} role="group" aria-label={t('pengaturan.aksi.label')}>
            <div className="pengaturan-aksi-status" aria-live="polite">
              {simpan.isError && <span className="field-galat">{teksGalat(t, simpan.error)}</span>}
              {!simpan.isError && berubah && <span className="teks-sekunder">{t('pengaturan.aksi.belumDisimpan')}</span>}
              {!simpan.isError && !berubah && pesanStatus && <span className="pengaturan-tersimpan">{t(pesanStatus)}</span>}
            </div>
            <Button variant="sekunder" disabled={!berubah || simpan.isPending} onClick={() => setDraf(null)}>
              {t('umum.batal')}
            </Button>
            <Button disabled={!berubah || simpan.isPending} onClick={() => simpan.mutate(draf)}>
              {simpan.isPending ? t('auth.reset.menyimpan') : t('umum.simpan')}
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
        onBerhasil={() => setPesanPassword(true)}
      />
      <DialogHapusAkun open={dialogHapus} onOpenChange={setDialogHapus} onTerhapus={tanganiTerhapus} />
    </div>
  )
}
