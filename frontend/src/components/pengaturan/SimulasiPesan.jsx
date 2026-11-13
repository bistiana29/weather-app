import { useQueries } from '@tanstack/react-query'
import { BellOff, MapPinned, MessageSquareText } from 'lucide-react'
import { Link } from 'react-router'
import { getRisiko } from '../../api/publik'
import { formatNilai, JENIS_KEJADIAN, masukPeringatan } from '../../lib/kategori'
import { formatPanjang } from '../../lib/tanggal'
import BantuanMock from '../BantuanMock'
import Skeleton from '../ui/Skeleton'
import '../../styles/components/pengaturan.css'

const PARAMETER_PERINGATAN = JENIS_KEJADIAN.map((j) => j.parameter)
const titikJam = (jam) => jam.replace(':', '.')

// Susun isi pesan dari risiko semua parameter untuk kelurahan pantauan
function susunPesan(pantauan, risikoPerParameter, indeksKelurahan) {
  const kelurahan = pantauan.map((kode) => ({
    kode,
    nama: indeksKelurahan[kode]?.kelurahan ?? kode,
    kejadian: PARAMETER_PERINGATAN.filter((p) => masukPeringatan(p, risikoPerParameter[p][kode]?.kategori)).map((p) => ({
      parameter: p,
      ...risikoPerParameter[p][kode],
    })),
  }))
  const lainnya = new Set()
  PARAMETER_PERINGATAN.forEach((p) =>
    Object.entries(risikoPerParameter[p]).forEach(([kode, data]) => {
      if (!pantauan.includes(kode) && masukPeringatan(p, data.kategori)) lainnya.add(kode)
    }),
  )
  return { kelurahan, jumlahLainnya: lainnya.size }
}

// Kerangka gelembung pesan saat data dimuat
function PesanSkeleton() {
  return (
    <div className="pesan-wa" aria-hidden="true">
      <Skeleton width="60%" height={16} />
      <Skeleton width="45%" height={14} />
      <Skeleton width="80%" height={14} style={{ marginTop: 12 }} />
      <Skeleton width="70%" height={14} />
      <Skeleton width="55%" height={14} />
      <Skeleton width="65%" height={14} style={{ marginTop: 12 }} />
    </div>
  )
}

// Pratinjau pesan peringatan WA berdasarkan pilihan saat ini (belum tentu tersimpan)
export default function SimulasiPesan({ memuatPengaturan, aktif, pantauan, indeksKelurahan, tgl }) {
  const hasil = useQueries({
    queries: PARAMETER_PERINGATAN.map((p) => ({ queryKey: ['risiko', p, tgl], queryFn: () => getRisiko(p, tgl) })),
  })
  const memuat = memuatPengaturan || hasil.some((q) => q.isPending) || !Object.keys(indeksKelurahan).length
  const risikoPerParameter = Object.fromEntries(PARAMETER_PERINGATAN.map((p, i) => [p, hasil[i].data ?? {}]))
  const pesan = memuat ? null : susunPesan(pantauan, risikoPerParameter, indeksKelurahan)
  const kejadianPertama = pesan?.kelurahan.find((k) => k.kejadian.length)
  const tautan = pantauan.length
    ? `/peta-risiko/${kejadianPertama?.kejadian[0].parameter ?? 'hujan'}?kel=${kejadianPertama?.kode ?? pantauan[0]}&tgl=${tgl}`
    : null

  return (
    <section className="simulasi" aria-labelledby="simulasi-judul" aria-busy={memuat}>
      <div className="simulasi-kepala">
        <h2 id="simulasi-judul">
          <MessageSquareText size={20} aria-hidden="true" />
          Simulasi Pesan
        </h2>
        <BantuanMock jenis="lencana" />
      </div>
      <p className="teks-sekunder simulasi-catatan">Pratinjau berdasarkan pilihan saat ini, dikirim pukul 12.00 WIB.</p>

      <div className="simulasi-layar">
        {memuatPengaturan && <PesanSkeleton />}
        {!memuatPengaturan && !aktif && (
          <p className="simulasi-kosong">
            <BellOff size={20} aria-hidden="true" />
            Peringatan WA nonaktif. Pesan tidak akan dikirim.
          </p>
        )}
        {!memuatPengaturan && aktif && !pantauan.length && (
          <p className="simulasi-kosong">
            <MapPinned size={20} aria-hidden="true" />
            Pilih kelurahan pantauan untuk melihat contoh pesan.
          </p>
        )}
        {!memuatPengaturan && aktif && pantauan.length > 0 && memuat && <PesanSkeleton />}
        {aktif && pesan && pantauan.length > 0 && (
          <article className="pesan-wa">
            <p className="pesan-wa-judul">Info Cuaca SBY</p>
            <p className="pesan-wa-sub">Peringatan dini untuk {formatPanjang(tgl)}, 00.00–23.59 WIB</p>

            {pesan.kelurahan.map((k) => (
              <div key={k.kode} className="pesan-wa-kel">
                <p className="pesan-wa-nama">{k.nama}:</p>
                {k.kejadian.length ? (
                  <ul>
                    {k.kejadian.map((e) => (
                      <li key={e.parameter}>
                        {e.kategori} {formatNilai(e.parameter, e.nilai)}
                        {e.jam_mulai && `, ${titikJam(e.jam_mulai)}–${titikJam(e.jam_selesai)} WIB`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pesan-wa-aman">Tidak ada kejadian ekstrem.</p>
                )}
              </div>
            ))}

            {pesan.jumlahLainnya > 0 && <p className="pesan-wa-lain">+{pesan.jumlahLainnya} kelurahan lain berisiko cuaca ekstrem.</p>}
            <p className="pesan-wa-tautan">
              Lihat peta: <Link to={tautan}>{`${window.location.host}${tautan}`}</Link>
            </p>
            <p className="pesan-wa-kaki">Hasil prediksi model, bukan peringatan resmi BMKG.</p>
            <span className="pesan-wa-jam">12.00</span>
          </article>
        )}
      </div>
    </section>
  )
}
