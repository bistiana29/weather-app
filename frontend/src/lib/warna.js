import { WARNA_DATA } from './kategori'

// Salinan token warna (styles/tokens.css) untuk pustaka yang butuh nilai warna langsung: Leaflet dan Recharts
export const WARNA = {
  navy: '#1B365D',
  biru: '#005A9C',
  teksSekunder: '#4A5D78',
  garis: '#C9DBE8',
  garisKuat: '#8FA8BF',
  gridGrafik: '#D7E4EE',
  areaPrediksi: '#DCEFF7',
  kosong: '#E4EBF0',
  batasData: '#9AA3AE',
  ambang: WARNA_DATA.ekstrem,
}

// Gaya label sumbu grafik (12 px agar tetap terbaca)
export const SUMBU_GRAFIK = { fontSize: 12, fill: WARNA.teksSekunder }
