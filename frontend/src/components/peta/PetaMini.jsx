import { useMemo } from 'react'
import { warnaRisiko } from '../../lib/kategori'
import { WARNA } from '../../lib/warna'
import '../../styles/components/peta.css'

const LEBAR = 400
const BINGKAI = 4

// Ubah GeoJSON jadi path SVG (proyeksi equirectangular sederhana) beserta titik tengah kotak batas tiap kelurahan
function proyeksikan(geojson) {
  const semuaTitik = geojson.features.flatMap((f) =>
    (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flat(1),
  ).flat(1)
  const lon = semuaTitik.map((t) => t[0])
  const lat = semuaTitik.map((t) => t[1])
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lon), Math.max(...lon), Math.min(...lat), Math.max(...lat)]
  const koreksi = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const skala = LEBAR / ((maxLon - minLon) * koreksi)
  const tinggi = (maxLat - minLat) * skala
  const keX = (x) => (x - minLon) * koreksi * skala
  const keY = (y) => (maxLat - y) * skala

  const jalur = geojson.features.map((f) => {
    const poligon = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const cincin = poligon.flat(1)
    const d = cincin.map((c) => `M${c.map(([x, y]) => `${keX(x).toFixed(1)} ${keY(y).toFixed(1)}`).join('L')}Z`).join('')
    const titik = cincin.flat(1)
    const xs = titik.map((t) => keX(t[0]))
    const ys = titik.map((t) => keY(t[1]))
    const tengah = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
    return { kode: f.properties.kode_kel, d, tengah }
  })
  return { tinggi, jalur }
}

// Ilustrasi peta kelurahan berwarna (SVG statis, tanpa basemap); titik dan children opsional ditempelkan pada tengah kelurahan sorotan
export default function PetaMini({ geojson, risiko, parameter, label, sorot, children }) {
  const { tinggi, jalur } = useMemo(() => proyeksikan(geojson), [geojson])
  const terpilih = jalur.find((j) => j.kode === sorot)
  const lebarBox = LEBAR + BINGKAI * 2
  const tinggiBox = tinggi + BINGKAI * 2
  const x = terpilih ? ((terpilih.tengah.x + BINGKAI) / lebarBox) * 100 : 0
  const y = terpilih ? ((terpilih.tengah.y + BINGKAI) / tinggiBox) * 100 : 0
  // Pop-up di bawah titik jika dekat tepi atas, dan digeser ke dalam jika dekat tepi kiri/kanan
  const posisi = terpilih && { '--x': `${x}%`, '--y': `${y}%`, '--geser': x < 30 ? '-12%' : x > 70 ? '-88%' : '-50%' }

  return (
    <div className="peta-mini-wadah">
      <svg className="peta-mini" viewBox={`${-BINGKAI} ${-BINGKAI} ${lebarBox} ${tinggiBox}`} role="img" aria-label={label}>
        {jalur.map((j) => (
          <path key={j.kode} d={j.d} fill={warnaRisiko(parameter, risiko?.[j.kode])} stroke={WARNA.batasData} strokeWidth="0.5" />
        ))}
        {terpilih && <path d={terpilih.d} fill="none" stroke={WARNA.navy} strokeWidth="2.5" strokeLinejoin="round" />}
      </svg>
      {posisi && (
        <div className={`peta-mini-titik ${y < 45 ? 'di-bawah' : ''}`} style={posisi}>
          {children}
        </div>
      )}
    </div>
  )
}
