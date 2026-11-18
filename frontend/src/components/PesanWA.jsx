import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { buatFormat } from '../lib/format'
import Skeleton from './ui/Skeleton'
import '../styles/components/pengaturan.css'

// Kerangka gelembung pesan saat data dimuat
export function PesanWASkeleton() {
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

// Gelembung pesan peringatan WhatsApp; selalu berbahasa Indonesia seperti pesan yang dikirim
export default function PesanWA({ pesan, tgl, label }) {
  const { i18n } = useTranslation()
  const tId = i18n.getFixedT('id')
  const fId = buatFormat(tId, 'id')
  return (
    <article className="pesan-wa" lang="id" aria-label={label}>
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
        {tId('pesanWa.tautan')} <Link to={pesan.tautan}>{`${window.location.host}${pesan.tautan}`}</Link>
      </p>
      <p className="pesan-wa-kaki">{tId('umum.disclaimer')}</p>
      <span className="pesan-wa-jam">12.00</span>
    </article>
  )
}
