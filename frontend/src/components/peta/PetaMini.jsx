import { useMemo } from 'react'
import { warnaRisiko } from '../../lib/kategori'
import '../../styles/components/peta.css'

const LEBAR = 400

// Ubah GeoJSON jadi path SVG dengan proyeksi equirectangular sederhana
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
  const keXY = ([x, y]) => `${(((x - minLon) * koreksi * skala)).toFixed(1)} ${((maxLat - y) * skala).toFixed(1)}`

  const jalur = geojson.features.map((f) => {
    const poligon = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const d = poligon.flatMap((cincin) => cincin.map((c) => `M${c.map(keXY).join('L')}Z`)).join('')
    return { kode: f.properties.kode_kel, d }
  })
  return { tinggi, jalur }
}

// Ilustrasi peta kelurahan berwarna (SVG statis, tanpa basemap)
export default function PetaMini({ geojson, risiko, parameter, label }) {
  const { tinggi, jalur } = useMemo(() => proyeksikan(geojson), [geojson])
  return (
    <svg className="peta-mini" viewBox={`-4 -4 ${LEBAR + 8} ${tinggi + 8}`} role="img" aria-label={label}>
      {jalur.map((j) => (
        <path key={j.kode} d={j.d} fill={warnaRisiko(parameter, risiko?.[j.kode])} stroke="#9AA3AE" strokeWidth="0.5" />
      ))}
    </svg>
  )
}
