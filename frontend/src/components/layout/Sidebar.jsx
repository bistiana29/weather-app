import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { MEDIA, useMediaQuery } from '../../lib/useMediaQuery'
import Tooltip from '../ui/Tooltip'
import '../../styles/components/layout.css'

const LEBAR_MIN = 220
const LEBAR_MAX = 320
const LEBAR_AWAL = 256
const LEBAR_RAIL = 72
const LANGKAH_KEYBOARD = 16

function batasi(lebar) {
  return Math.min(LEBAR_MAX, Math.max(LEBAR_MIN, lebar))
}

function bacaSimpanan(kunci) {
  try {
    const data = JSON.parse(localStorage.getItem(kunci))
    return { lebar: batasi(data?.lebar ?? LEBAR_AWAL), ciut: Boolean(data?.ciut) }
  } catch {
    return { lebar: LEBAR_AWAL, ciut: false }
  }
}

// Satu tautan atau tombol di sidebar
function ItemSidebar({ item, ciut }) {
  const Ikon = item.ikon
  const isi = (
    <>
      <Ikon size={20} aria-hidden="true" />
      <span className={ciut ? 'sr-only' : 'sidebar-label'}>{item.label}</span>
    </>
  )
  const elemen = item.to ? (
    <NavLink to={item.to} end={item.end} className="sidebar-item">
      {isi}
    </NavLink>
  ) : (
    <button type="button" className="sidebar-item" onClick={item.onClick}>
      {isi}
    </button>
  )
  return (
    <li>
      <Tooltip label={item.label} side="right" aktif={ciut}>
        {elemen}
      </Tooltip>
    </li>
  )
}

// Sidebar yang bisa ditarik lebarnya, diciutkan jadi rail, dan jadi navigasi bawah di mobile
export default function Sidebar({ items, itemsBawah = [], kepala, judulMobile, storageKey, nada = 'terang' }) {
  const mobile = useMediaQuery(MEDIA.mobile)
  const tablet = useMediaQuery(MEDIA.tablet)
  const [simpanan, setSimpanan] = useState(() => bacaSimpanan(storageKey))
  const [menarik, setMenarik] = useState(false)
  const ciut = tablet || simpanan.ciut
  const lebar = ciut ? LEBAR_RAIL : simpanan.lebar

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(simpanan))
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, [storageKey, simpanan])

  // Tarik pegangan untuk mengubah lebar
  function mulaiTarik(e) {
    e.preventDefault()
    const awalX = e.clientX
    const awalLebar = simpanan.lebar
    setMenarik(true)
    const gerak = (ev) => setSimpanan((s) => ({ ...s, lebar: batasi(awalLebar + ev.clientX - awalX) }))
    const selesai = () => {
      setMenarik(false)
      window.removeEventListener('pointermove', gerak)
      window.removeEventListener('pointerup', selesai)
    }
    window.addEventListener('pointermove', gerak)
    window.addEventListener('pointerup', selesai)
  }

  function tarikKeyboard(e) {
    const arah = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    if (!arah) return
    e.preventDefault()
    setSimpanan((s) => ({ ...s, lebar: batasi(s.lebar + arah * LANGKAH_KEYBOARD) }))
  }

  // Mobile: bilah atas ringkas dan navigasi bawah
  if (mobile) {
    return (
      <>
        <header className={`sidebar-mobile-atas nada-${nada}`}>
          {judulMobile}
          <div className="sidebar-mobile-aksi">
            {itemsBawah.map((item) => {
              const Ikon = item.ikon
              return item.to ? (
                <NavLink key={item.label} to={item.to} className="tombol-ikon" aria-label={item.label}>
                  <Ikon size={20} aria-hidden="true" />
                </NavLink>
              ) : (
                <button key={item.label} type="button" className="tombol-ikon" aria-label={item.label} onClick={item.onClick}>
                  <Ikon size={20} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </header>
        <nav className="nav-bawah" aria-label="Navigasi utama">
          {items.map((item) => {
            const Ikon = item.ikon
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className="nav-bawah-item">
                <Ikon size={20} aria-hidden="true" />
                <span>{item.labelPendek ?? item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </>
    )
  }

  return (
    <aside className={`sidebar nada-${nada} ${ciut ? 'ciut' : ''} ${menarik ? 'menarik' : ''}`} style={{ width: lebar }}>
      <div className="sidebar-kepala">{kepala(ciut)}</div>
      <nav className="sidebar-nav" aria-label="Navigasi utama">
        <ul>
          {items.map((item) => (
            <ItemSidebar key={item.to} item={item} ciut={ciut} />
          ))}
        </ul>
      </nav>
      <ul className="sidebar-bawah">
        {itemsBawah.map((item) => (
          <ItemSidebar key={item.label} item={item} ciut={ciut} />
        ))}
        {!tablet && (
          <li>
            <Tooltip label={ciut ? 'Lebarkan sidebar' : 'Ciutkan sidebar'} side="right" aktif={ciut}>
              <button
                type="button"
                className="sidebar-item"
                aria-expanded={!ciut}
                onClick={() => setSimpanan((s) => ({ ...s, ciut: !s.ciut }))}
              >
                {ciut ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
                <span className={ciut ? 'sr-only' : 'sidebar-label'}>{ciut ? 'Lebarkan sidebar' : 'Ciutkan sidebar'}</span>
              </button>
            </Tooltip>
          </li>
        )}
      </ul>
      {!ciut && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Ubah lebar sidebar"
          aria-valuemin={LEBAR_MIN}
          aria-valuemax={LEBAR_MAX}
          aria-valuenow={simpanan.lebar}
          className="sidebar-pegangan"
          onPointerDown={mulaiTarik}
          onKeyDown={tarikKeyboard}
        />
      )}
    </aside>
  )
}
