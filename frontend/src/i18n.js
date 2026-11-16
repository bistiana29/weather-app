import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import id from './locales/id.json'

const KUNCI_BAHASA = 'pce-bahasa'
export const DAFTAR_BAHASA = ['id', 'en']

function bahasaTersimpan() {
  try {
    return localStorage.getItem(KUNCI_BAHASA) === 'en' ? 'en' : 'id'
  } catch {
    return 'id'
  }
}

// Samakan atribut lang, meta description, dan pilihan tersimpan dengan bahasa aktif
function terapkanBahasa(bahasa) {
  document.documentElement.lang = bahasa
  document.querySelector('meta[name="description"]')?.setAttribute('content', i18n.t('umum.metaDeskripsi'))
  try {
    localStorage.setItem(KUNCI_BAHASA, bahasa)
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
}

i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: bahasaTersimpan(),
  fallbackLng: 'id',
  supportedLngs: DAFTAR_BAHASA,
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', terapkanBahasa)
terapkanBahasa(i18n.language)

// Instans terpisah berbahasa Indonesia untuk panel admin
export const i18nAdmin = i18n.cloneInstance({ lng: 'id' })

export default i18n
