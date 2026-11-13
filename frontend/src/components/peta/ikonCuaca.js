import { CloudDrizzle, CloudFog, CloudRain, CloudRainWind, Droplets, Eye, Sun, Moon, Thermometer, ThermometerSun, Wind } from 'lucide-react'
import { kategoriDari, nilaiEkstrem, PARAMETER } from '../../lib/kategori'

export const IKON_PARAMETER = {
  hujan: CloudRain,
  suhu: Thermometer,
  angin: Wind,
  'jarak-pandang': Eye,
  kelembapan: Droplets,
}

// Ikon hujan per indeks kategori: tidak hujan, ringan, sedang, lebat, sangat lebat, ekstrem
const IKON_HUJAN = [null, CloudDrizzle, CloudDrizzle, CloudRain, CloudRainWind, CloudRainWind]

// Ikon cuaca outline untuk satu nilai per jam, mengikuti kategori dari kategori.js
export function ikonNilai(parameter, nilai, jam, { normal } = {}) {
  if (parameter === 'hujan') {
    const indeks = PARAMETER.hujan.kategori.findIndex((k) => k.label === kategoriDari('hujan', nilai))
    return IKON_HUJAN[indeks] ?? (jam >= 6 && jam < 18 ? Sun : Moon)
  }
  if (parameter === 'kelembapan') return Droplets
  const ekstrem = nilaiEkstrem(parameter, nilai, { normal })
  if (parameter === 'suhu') return ekstrem ? ThermometerSun : Thermometer
  if (parameter === 'angin') return Wind
  return ekstrem ? CloudFog : Eye
}
