import { useQuery } from '@tanstack/react-query'
import { BellOff, MapPinned, MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getRisiko } from '../../api/publik'
import { buatFormat } from '../../lib/format'
import { JENIS_KEJADIAN, masukPeringatan, risikoParameter, urlPeta } from '../../lib/kategori'
import BantuanMock from '../BantuanMock'
import Skeleton from '../ui/Skeleton'
import '../../styles/components/pengaturan.css'

const PARAMETER_PERINGATAN = JENIS_KEJADIAN.map((j) => j.parameter)

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
  const { t, i18n } = useTranslation()
  const tId = i18n.getFixedT('id')
  const fId = buatFormat(tId, 'id')
  const risikoQuery = useQuery({ queryKey: ['risiko', tgl], queryFn: () => getRisiko(tgl) })
  const memuat = memuatPengaturan || risikoQuery.isPending || !Object.keys(indeksKelurahan).length
  const risikoPerParameter = Object.fromEntries(PARAMETER_PERINGATAN.map((p) => [p, risikoParameter(risikoQuery.data, p) ?? {}]))
  const pesan = memuat ? null : susunPesan(pantauan, risikoPerParameter, indeksKelurahan)
  const kejadianPertama = pesan?.kelurahan.find((k) => k.kejadian.length)
  const tautan = pantauan.length
    ? urlPeta({ color: kejadianPertama?.kejadian[0].parameter ?? 'hujan', kel: kejadianPertama?.kode ?? pantauan[0], date: tgl })
    : null

  return (
    <section className="simulasi" aria-labelledby="simulasi-judul" aria-busy={memuat}>
      <div className="simulasi-kepala">
        <h2 id="simulasi-judul">
          <MessageSquareText size={20} aria-hidden="true" />
          {t('pengaturan.simulasi.judul')}
        </h2>
        <BantuanMock jenis="lencana" />
      </div>
      <p className="teks-sekunder simulasi-catatan">{t('pengaturan.simulasi.catatan')}</p>
      {i18n.language !== 'id' && <p className="teks-sekunder simulasi-catatan">{t('landing.wa.catatanBahasa')}</p>}

      <div className="simulasi-layar">
        {memuatPengaturan && <PesanSkeleton />}
        {!memuatPengaturan && !aktif && (
          <p className="simulasi-kosong">
            <BellOff size={20} aria-hidden="true" />
            {t('pengaturan.simulasi.nonaktif')}
          </p>
        )}
        {!memuatPengaturan && aktif && !pantauan.length && (
          <p className="simulasi-kosong">
            <MapPinned size={20} aria-hidden="true" />
            {t('pengaturan.simulasi.kosong')}
          </p>
        )}
        {!memuatPengaturan && aktif && pantauan.length > 0 && memuat && <PesanSkeleton />}
        {aktif && pesan && pantauan.length > 0 && (
          <article className="pesan-wa" lang="id">
            <p className="pesan-wa-judul">{tId('pesanWa.judul')}</p>
            <p className="pesan-wa-sub">{tId('pesanWa.sub', { tanggal: fId.tanggalPanjang(tgl) })}</p>

            {pesan.kelurahan.map((k) => (
              <div key={k.kode} className="pesan-wa-kel">
                <p className="pesan-wa-nama">{k.nama}:</p>
                {k.kejadian.length ? (
                  <ul>
                    {k.kejadian.map((e) => (
                      <li key={e.parameter}>
                        {fId.kategori(e.parameter, e.kategori)} {fId.nilaiLengkap(e.parameter, e.nilai)}
                        {e.jam_mulai && `, ${fId.periode(e.jam_mulai, e.jam_selesai)}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pesan-wa-aman">{tId('pesanWa.aman')}</p>
                )}
              </div>
            ))}

            {pesan.jumlahLainnya > 0 && <p className="pesan-wa-lain">{tId('pesanWa.lain', { jumlah: pesan.jumlahLainnya })}</p>}
            <p className="pesan-wa-tautan">
              {tId('pesanWa.tautan')} <Link to={tautan}>{`${window.location.host}${tautan}`}</Link>
            </p>
            <p className="pesan-wa-kaki">{tId('umum.disclaimer')}</p>
            <span className="pesan-wa-jam">12.00</span>
          </article>
        )}
      </div>
    </section>
  )
}
