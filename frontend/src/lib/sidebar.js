import { createContext, use, useEffect, useState } from 'react'
import { MEDIA, useMediaQuery } from './useMediaQuery'

export const LEBAR_MIN = 220
export const LEBAR_MAX = 320
const LEBAR_AWAL = 256

export function batasiLebar(lebar) {
  return Math.min(LEBAR_MAX, Math.max(LEBAR_MIN, lebar))
}

function bacaSimpanan(kunci) {
  try {
    const data = JSON.parse(localStorage.getItem(kunci))
    return { lebar: batasiLebar(data?.lebar ?? LEBAR_AWAL), ciut: Boolean(data?.ciut) }
  } catch {
    return { lebar: LEBAR_AWAL, ciut: false }
  }
}

// Status sidebar (lebar, ciut) milik layout; desktop disimpan di localStorage, tablet default rail
export function useStatusSidebar(storageKey) {
  const mobile = useMediaQuery(MEDIA.mobile)
  const tablet = useMediaQuery(MEDIA.tablet)
  const [simpanan, setSimpanan] = useState(() => bacaSimpanan(storageKey))
  const [lebarTablet, setLebarTablet] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(simpanan))
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, [storageKey, simpanan])

  return {
    mobile,
    ciut: tablet ? !lebarTablet : simpanan.ciut,
    lebar: simpanan.lebar,
    ubahLebar: (lebar) => setSimpanan((s) => ({ ...s, lebar: batasiLebar(typeof lebar === 'function' ? lebar(s.lebar) : lebar) })),
    toggle: () => (tablet ? setLebarTablet((v) => !v) : setSimpanan((s) => ({ ...s, ciut: !s.ciut }))),
  }
}

// Konteks layout untuk PageHeader: status sidebar (null di layout publik) dan tampil/tidaknya pemilih bahasa
export const KonteksLayout = createContext({ sidebar: null, tampilBahasa: false })

export function useKonteksLayout() {
  return use(KonteksLayout)
}
