import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { LEBAR_MAX, LEBAR_MIN } from '../../lib/sidebar'
import Tooltip from '../ui/Tooltip'
import '../../styles/components/layout.css'

const LEBAR_RAIL = 72
const LANGKAH_KEYBOARD = 16

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

// Sidebar yang bisa ditarik lebarnya, diciutkan jadi rail, dan jadi navigasi bawah di mobile; status dari layout
export default function Sidebar({ status, items, itemsBawah = [], kepala, judulMobile, nada = 'terang' }) {
  const { t } = useTranslation()
  const [menarik, setMenarik] = useState(false)
  const { mobile, ciut, ubahLebar } = status
  const lebar = ciut ? LEBAR_RAIL : status.lebar

  // Tarik pegangan untuk mengubah lebar
  function mulaiTarik(e) {
    e.preventDefault()
    const awalX = e.clientX
    const awalLebar = status.lebar
    setMenarik(true)
    const gerak = (ev) => ubahLebar(awalLebar + ev.clientX - awalX)
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
    ubahLebar((l) => l + arah * LANGKAH_KEYBOARD)
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
        <nav className="nav-bawah" aria-label={t('umum.nav.navigasiUtama')}>
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
    <aside id="sidebar-utama" className={`sidebar nada-${nada} ${ciut ? 'ciut' : ''} ${menarik ? 'menarik' : ''}`} style={{ width: lebar }}>
      <div className="sidebar-kepala">{kepala(ciut)}</div>
      <nav className="sidebar-nav" aria-label={t('umum.nav.navigasiUtama')}>
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
      </ul>
      {!ciut && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={t('umum.sidebar.ubahLebar')}
          aria-valuemin={LEBAR_MIN}
          aria-valuemax={LEBAR_MAX}
          aria-valuenow={status.lebar}
          className="sidebar-pegangan"
          onPointerDown={mulaiTarik}
          onKeyDown={tarikKeyboard}
        />
      )}
    </aside>
  )
}
