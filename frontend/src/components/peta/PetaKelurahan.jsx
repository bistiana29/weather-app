import L from 'leaflet'
import { Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { formatNilai, PARAMETER, warnaRisiko } from '../../lib/kategori'
import Tooltip from '../ui/Tooltip'
import Legend from './Legend'
import '../../styles/components/peta.css'

const BATAS_TIPIS = '#9AA3AE'
const BATAS_TERPILIH = '#1B365D'
const BATAS_HOVER = '#005A9C'

function escapeHtml(teks) {
  return String(teks).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function teksTooltip(parameter, properti, data) {
  const nama = `<strong>${escapeHtml(properti.kelurahan)}</strong>`
  if (!data) return nama
  const keterangan = PARAMETER[parameter].skala ? formatNilai(parameter, data.nilai) : data.kategori
  return `${nama}<br>${escapeHtml(keterangan)}`
}

// Lapisan poligon kelurahan berwarna sesuai kategori risiko
function LapisanKelurahan({ geojson, risiko, parameter, terpilih, onPilih }) {
  const map = useMap()
  const lapisanRef = useRef(null)
  const onPilihRef = useRef(onPilih)

  const gaya = useCallback(
    (fitur) => {
      const kode = fitur.properties.kode_kel
      const dipilih = kode === terpilih
      return {
        fillColor: risiko ? warnaRisiko(parameter, risiko[kode]) : '#E4EBF0',
        fillOpacity: risiko ? 0.85 : 0.5,
        color: dipilih ? BATAS_TERPILIH : BATAS_TIPIS,
        weight: dipilih ? 3.5 : 0.8,
      }
    },
    [risiko, parameter, terpilih],
  )
  const gayaRef = useRef(gaya)

  useEffect(() => {
    onPilihRef.current = onPilih
    gayaRef.current = gaya
  })

  // Perbarui gaya saat kelurahan terpilih berubah, lalu arahkan peta jika di luar layar
  useEffect(() => {
    const lapisan = lapisanRef.current
    if (!lapisan) return
    lapisan.setStyle(gaya)
    lapisan.eachLayer((layer) => {
      if (layer.feature.properties.kode_kel !== terpilih) return
      layer.bringToFront()
      const batas = layer.getBounds()
      if (!map.getBounds().contains(batas)) map.flyToBounds(batas, { maxZoom: 14, duration: 0.6 })
    })
  }, [gaya, terpilih, map])

  function tiapFitur(fitur, layer) {
    const properti = fitur.properties
    layer.bindTooltip(teksTooltip(parameter, properti, risiko?.[properti.kode_kel]), {
      sticky: true,
      direction: 'top',
      className: 'peta-tooltip',
    })
    layer.on({
      click: () => onPilihRef.current(properti.kode_kel),
      mouseover: () => {
        if (gayaRef.current(fitur).color !== BATAS_TERPILIH) layer.setStyle({ color: BATAS_HOVER, weight: 2 })
      },
      mouseout: () => layer.setStyle(gayaRef.current(fitur)),
    })
  }

  return <GeoJSON ref={lapisanRef} data={geojson} style={gaya} onEachFeature={tiapFitur} />
}

// Peta choropleth kelurahan dengan basemap terang, legenda, dan tombol zoom
export default function PetaKelurahan({ geojson, risiko, parameter, tgl, terpilih, onPilih, memuatRisiko }) {
  const [map, setMap] = useState(null)
  const batasAwal = useMemo(() => L.geoJSON(geojson).getBounds(), [geojson])

  return (
    <div className="peta-wadah">
      <MapContainer
        ref={setMap}
        bounds={batasAwal}
        boundsOptions={{ padding: [16, 16] }}
        zoomControl={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={10}
        maxZoom={16}
        className="peta-leaflet"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
          maxNativeZoom={16}
        />
        <LapisanKelurahan
          key={`${parameter}-${tgl}-${risiko ? 'data' : 'memuat'}`}
          geojson={geojson}
          risiko={risiko}
          parameter={parameter}
          terpilih={terpilih}
          onPilih={onPilih}
        />
      </MapContainer>

      {memuatRisiko && (
        <div className="peta-memuat" role="status">
          <span className="sr-only">Memuat data risiko</span>
        </div>
      )}

      <Legend parameter={parameter} memuat={memuatRisiko} />

      <div className="peta-zoom">
        <Tooltip label="Perbesar" side="left">
          <button type="button" className="peta-zoom-tombol" aria-label="Perbesar peta" onClick={() => map?.zoomIn()}>
            <Plus size={20} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label="Perkecil" side="left">
          <button type="button" className="peta-zoom-tombol" aria-label="Perkecil peta" onClick={() => map?.zoomOut()}>
            <Minus size={20} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
