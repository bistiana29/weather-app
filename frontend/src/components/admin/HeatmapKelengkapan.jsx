import { namaHariPendek } from '../../lib/tanggal'
import Skeleton from '../ui/Skeleton'
import { LABEL_SUMBER } from './label'
import '../../styles/components/admin.css'

const SKALA = [
  { kelas: 'hm-penuh', label: '100%' },
  { kelas: 'hm-tinggi', label: '90–<100%' },
  { kelas: 'hm-sebagian', label: '1–<90%' },
  { kelas: 'hm-kosong', label: '0% (semua nilai kosong)' },
  { kelas: 'hm-tanpa', label: 'Belum ada baris' },
]

function kelasSel(baris) {
  if (!baris.jumlah_baris) return 'hm-tanpa'
  const persen = (baris.jumlah_terisi / baris.jumlah_baris) * 100
  if (persen >= 100) return 'hm-penuh'
  if (persen >= 90) return 'hm-tinggi'
  if (persen > 0) return 'hm-sebagian'
  return 'hm-kosong'
}

function teksSel(baris) {
  if (!baris.jumlah_baris) return 'belum ada baris'
  return `${((baris.jumlah_terisi / baris.jumlah_baris) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% terisi`
}

// Heatmap kelengkapan data per parameter dan tanggal untuk tiap sumber
export default function HeatmapKelengkapan({ data, memuat }) {
  const tanggal = [...new Set((data ?? []).map((d) => d.tanggal))]
  const perSumber = Object.keys(LABEL_SUMBER).map((sumber) => {
    const baris = (data ?? []).filter((d) => d.sumber === sumber)
    const parameter = [...new Set(baris.map((d) => d.parameter))]
    return { sumber, parameter, sel: (p, t) => baris.find((d) => d.parameter === p && d.tanggal === t) }
  })

  if (memuat) {
    return (
      <div className="heatmap" aria-hidden="true">
        {Object.keys(LABEL_SUMBER).map((s) => (
          <div key={s} className="heatmap-blok">
            <Skeleton width={120} height={18} />
            <Skeleton height={s === 'nasa' ? 168 : 216} radius={12} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="heatmap">
      {perSumber.map(({ sumber, parameter, sel }) => (
        <div key={sumber} className="heatmap-blok">
          <h3 className="heatmap-judul">{LABEL_SUMBER[sumber]}</h3>
          <div className="gulir-horizontal">
            <table className="heatmap-tabel">
              <caption className="sr-only">Kelengkapan data hourly {LABEL_SUMBER[sumber]} per hari</caption>
              <thead>
                <tr>
                  <th scope="col" className="heatmap-param">Parameter</th>
                  {tanggal.map((t) => (
                    <th key={t} scope="col" className="heatmap-tgl">
                      <span>{namaHariPendek(t)}</span>
                      {Number(t.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parameter.map((p) => (
                  <tr key={p}>
                    <th scope="row" className="heatmap-param">{p}</th>
                    {tanggal.map((t) => {
                      const baris = sel(p, t)
                      return (
                        <td key={t} className={`heatmap-sel ${kelasSel(baris)}`} title={`${p}, ${t}: ${teksSel(baris)}`}>
                          <span className="sr-only">{teksSel(baris)}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <ul className="heatmap-legenda" aria-label="Legenda kelengkapan">
        {SKALA.map((s) => (
          <li key={s.kelas}>
            <span className={`heatmap-sel ${s.kelas}`} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
