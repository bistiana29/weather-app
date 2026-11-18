import L from 'leaflet'
import { Hand, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { MEDIA_HOVER, MEDIA_SENTUH, useMediaQuery } from '../../lib/useMediaQuery'
import { risikoParameter, warnaRisiko } from '../../lib/kategori'
import { WARNA } from '../../lib/warna'
import Tooltip from '../ui/Tooltip'
import InfoKelurahan from './InfoKelurahan'
import Legend from './Legend'
import '../../styles/components/peta.css'

const BATAS_TERPILIH = { color: WARNA.navy, weight: 3.5 }
const BATAS_SOROT = { color: WARNA.biru, weight: 2.5 }
const BATAS_TIPIS = { color: WARNA.batasData, weight: 0.8 }
const LEBAR_INFO = 272
const JARAK_INFO = 14
const TEPI_INFO = 8
const TINGGI_INFO_AWAL = 220
const AMBANG_USAP_PX = 12
const DURASI_PETUNJUK_MS = 1800

// Lapisan poligon kelurahan berwarna sesuai kategori risiko
function LapisanKelurahan({ geojson, risiko, parameter, terpilih, sorot, bisaHover, onPilih, onInfo }) {
  const map = useMap()
  const lapisanRef = useRef(null)
  const refAksi = useRef({ onPilih, onInfo, bisaHover })

  const gaya = useCallback(
    (fitur) => {
      const kode = fitur.properties.kode_kel
      const batas = kode === terpilih ? BATAS_TERPILIH : kode === sorot ? BATAS_SOROT : BATAS_TIPIS
      return {
        fillColor: risiko ? warnaRisiko(parameter, risiko[kode]) : WARNA.kosong,
        fillOpacity: risiko ? 0.85 : 0.5,
        ...batas,
      }
    },
    [risiko, parameter, terpilih, sorot],
  )
  const gayaRef = useRef(gaya)

  useEffect(() => {
    refAksi.current = { onPilih, onInfo, bisaHover }
    gayaRef.current = gaya
  })

  // Perbarui gaya saat pilihan berubah, lalu arahkan peta jika kelurahan terpilih di luar layar
  useEffect(() => {
    const lapisan = lapisanRef.current
    if (!lapisan) return
    lapisan.setStyle(gaya)
    lapisan.eachLayer((layer) => {
      const kode = layer.feature.properties.kode_kel
      if (kode === sorot) layer.bringToFront()
      if (kode !== terpilih) return
      layer.bringToFront()
      const batas = layer.getBounds()
      if (!map.getBounds().contains(batas)) map.flyToBounds(batas, { maxZoom: 14, duration: 0.6 })
    })
  }, [gaya, terpilih, sorot, map])

  // Hover menampilkan info (desktop); klik membuka panel di desktop atau pop-up tap di layar sentuh
  function tiapFitur(fitur, layer) {
    const kode = fitur.properties.kode_kel
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e)
        const { bisaHover: hover, onPilih: pilih, onInfo: info } = refAksi.current
        if (hover) pilih(kode)
        else info({ kode, latlng: e.latlng, mode: 'tap' })
      },
      mouseover: (e) => {
        if (!refAksi.current.bisaHover) return
        if (kode !== terpilih) layer.setStyle(BATAS_SOROT)
        refAksi.current.onInfo({ kode, latlng: e.latlng, mode: 'hover' })
      },
      mouseout: () => {
        if (!refAksi.current.bisaHover) return
        layer.setStyle(gayaRef.current(fitur))
        refAksi.current.onInfo((lama) => (lama?.mode === 'hover' && lama.kode === kode ? null : lama))
      },
    })
  }

  return <GeoJSON ref={lapisanRef} data={geojson} style={gaya} onEachFeature={tiapFitur} />
}

// Kartu info kelurahan yang mengikuti posisi titik di peta saat digeser atau di-zoom
function KartuInfoPeta({ info, properti, data, urutan, memuat, onTutup, onLihat }) {
  const map = useMap()
  const kartuRef = useRef(null)
  const [tinggi, setTinggi] = useState(TINGGI_INFO_AWAL)
  const [, setGerak] = useState(0)
  const segarkan = () => setGerak((n) => n + 1)
  useMapEvents({ move: segarkan, zoom: segarkan, resize: segarkan, click: onTutup })

  // Klik dan gulir di dalam kartu tidak diteruskan ke peta; tinggi kartu diukur untuk penempatan
  useEffect(() => {
    const kartu = kartuRef.current
    if (!kartu) return
    L.DomEvent.disableClickPropagation(kartu)
    L.DomEvent.disableScrollPropagation(kartu)
    const pengamat = new ResizeObserver(([entri]) => setTinggi(Math.ceil(entri.borderBoxSize?.[0]?.blockSize ?? kartu.offsetHeight)))
    pengamat.observe(kartu)
    return () => pengamat.disconnect()
  }, [info?.kode, info?.mode])

  // Escape menutup pop-up tap
  useEffect(() => {
    if (info?.mode !== 'tap') return
    const tutup = (e) => e.key === 'Escape' && onTutup()
    document.addEventListener('keydown', tutup)
    return () => document.removeEventListener('keydown', tutup)
  }, [info?.mode, onTutup])

  if (!info || !properti) return null
  // Utamakan di atas titik, lalu di bawahnya, dan selalu dijepit di dalam area peta
  const ukuran = map.getSize()
  const titik = map.latLngToContainerPoint(info.latlng)
  const batasKiri = LEBAR_INFO / 2 + TEPI_INFO
  const kiri = Math.min(Math.max(titik.x, batasKiri), Math.max(batasKiri, ukuran.x - batasKiri))
  const diAtas = titik.y - JARAK_INFO - tinggi
  const usulan = diAtas >= TEPI_INFO ? diAtas : titik.y + JARAK_INFO
  const atas = Math.max(TEPI_INFO, Math.min(usulan, ukuran.y - tinggi - TEPI_INFO))

  return (
    <div ref={kartuRef} className={`info-peta info-peta-${info.mode}`} style={{ left: kiri, top: atas }}>
      <InfoKelurahan
        properti={properti}
        data={data}
        urutan={urutan}
        memuat={memuat}
        modeTap={info.mode === 'tap'}
        onTutup={onTutup}
        onLihat={onLihat}
      />
    </div>
  )
}

// Peta choropleth kelurahan (satu parameter pewarna) dengan basemap terang, legenda, pop-up info, dan tombol zoom
export default function PetaKelurahan({ geojson, risiko, color, params, tgl, terpilih, onPilih, onWarnai, memuatRisiko }) {
  const { t } = useTranslation()
  const [map, setMap] = useState(null)
  const [info, setInfo] = useState(null)
  const [petunjuk, setPetunjuk] = useState(false)
  const bisaHover = useMediaQuery(MEDIA_HOVER)
  const sentuh = useMediaQuery(MEDIA_SENTUH)
  const usapRef = useRef(null)
  const timerRef = useRef(null)
  const batasAwal = useMemo(() => L.geoJSON(geojson).getBounds(), [geojson])
  const properti = useMemo(() => Object.fromEntries(geojson.features.map((f) => [f.properties.kode_kel, f.properties])), [geojson])
  const tutupInfo = useCallback(() => setInfo(null), [])
  const risikoWarna = useMemo(() => risikoParameter(risiko, color), [risiko, color])
  const urutan = [color, ...params.filter((p) => p !== color)]

  // Di layar sentuh, geser peta hanya dengan dua jari agar satu jari tetap menggulir halaman
  useEffect(() => {
    if (!map) return
    if (sentuh) map.dragging.disable()
    else map.dragging.enable()
  }, [map, sentuh])

  // Ukuran peta disegarkan saat tinggi kartu bento berubah
  useEffect(() => {
    if (!map) return
    const pengamat = new ResizeObserver(() => map.invalidateSize())
    pengamat.observe(map.getContainer())
    return () => pengamat.disconnect()
  }, [map])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Usapan satu jari di atas peta memunculkan petunjuk dua jari
  function mulaiUsap(e) {
    usapRef.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }

  function usap(e) {
    const awal = usapRef.current
    if (!sentuh || !awal || e.touches.length !== 1) return
    const jarak = Math.hypot(e.touches[0].clientX - awal.x, e.touches[0].clientY - awal.y)
    if (jarak < AMBANG_USAP_PX) return
    usapRef.current = null
    setPetunjuk(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setPetunjuk(false), DURASI_PETUNJUK_MS)
  }

  function lihatPrakiraan() {
    if (info) onPilih(info.kode)
    setInfo(null)
  }

  return (
    <div className="peta-wadah" onTouchStart={mulaiUsap} onTouchMove={usap}>
      <MapContainer
        ref={setMap}
        bounds={batasAwal}
        boundsOptions={{ padding: [16, 16] }}
        zoomControl={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={10}
        maxZoom={16}
        dragging={!sentuh}
        className="peta-leaflet"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
          maxNativeZoom={16}
        />
        <LapisanKelurahan
          key={`${color}-${tgl}-${risiko ? 'data' : 'memuat'}`}
          geojson={geojson}
          risiko={risikoWarna}
          parameter={color}
          terpilih={terpilih}
          sorot={info?.mode === 'tap' ? info.kode : null}
          bisaHover={bisaHover}
          onPilih={onPilih}
          onInfo={setInfo}
        />
        <KartuInfoPeta
          info={info}
          properti={info ? properti[info.kode] : null}
          data={info ? risiko?.[info.kode] : null}
          urutan={urutan}
          memuat={memuatRisiko}
          onTutup={tutupInfo}
          onLihat={lihatPrakiraan}
        />
      </MapContainer>

      {memuatRisiko && (
        <div className="peta-memuat" role="status">
          <span className="sr-only">{t('peta.memuatRisiko')}</span>
        </div>
      )}

      <p className={`peta-petunjuk ${petunjuk ? 'tampil' : ''}`} aria-hidden={!petunjuk}>
        <Hand size={18} aria-hidden="true" />
        {t('peta.petunjukDuaJari')}
      </p>

      <Legend parameter={color} opsi={params} onWarnai={onWarnai} memuat={memuatRisiko} />

      <div className="peta-zoom">
        <Tooltip label={t('peta.zoom.perbesar')} side="left">
          <button type="button" className="peta-zoom-tombol" aria-label={t('peta.zoom.perbesarPeta')} onClick={() => map?.zoomIn()}>
            <Plus size={20} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label={t('peta.zoom.perkecil')} side="left">
          <button type="button" className="peta-zoom-tombol" aria-label={t('peta.zoom.perkecilPeta')} onClick={() => map?.zoomOut()}>
            <Minus size={20} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
