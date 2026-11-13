import { Search, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import '../../styles/components/ui.css'

const MAKS_HASIL = 8

// Kolom cari dengan daftar saran (combobox yang bisa dioperasikan keyboard)
export default function SearchInput({ items, onSelect, placeholder = 'Cari…', label = 'Cari', autoFocus = false, disabled = false, className = '' }) {
  const id = useId()
  const inputRef = useRef(null)
  const [teks, setTeks] = useState('')
  const [terbuka, setTerbuka] = useState(false)
  const [aktif, setAktif] = useState(0)

  const hasil = useMemo(() => {
    const q = teks.trim().toLowerCase()
    if (!q) return []
    // Urutkan: awalan nama, lalu nama memuat kata, lalu keterangan memuat kata
    const skor = (it) => {
      const label = it.label.toLowerCase()
      if (label.startsWith(q)) return 0
      if (label.includes(q)) return 1
      return it.keterangan?.toLowerCase().includes(q) ? 2 : -1
    }
    return items
      .map((it) => ({ it, s: skor(it) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, MAKS_HASIL)
      .map((x) => x.it)
  }, [items, teks])

  const tampilDaftar = terbuka && teks.trim() !== ''

  function pilih(item) {
    onSelect(item)
    setTeks('')
    setTerbuka(false)
    inputRef.current?.blur()
  }

  function tanganiTombol(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTerbuka(true)
      setAktif((i) => Math.min(i + 1, hasil.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAktif((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && tampilDaftar && hasil[aktif]) {
      e.preventDefault()
      pilih(hasil[aktif])
    } else if (e.key === 'Escape') {
      setTerbuka(false)
    }
  }

  return (
    <div className={`cari ${disabled ? 'nonaktif' : ''} ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="cari-kotak">
        <Search size={18} aria-hidden="true" className="cari-ikon" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-expanded={tampilDaftar}
          aria-controls={`${id}-daftar`}
          aria-autocomplete="list"
          aria-activedescendant={tampilDaftar && hasil[aktif] ? `${id}-opsi-${aktif}` : undefined}
          placeholder={placeholder}
          value={teks}
          onChange={(e) => {
            setTeks(e.target.value)
            setAktif(0)
            setTerbuka(true)
          }}
          onFocus={() => setTerbuka(true)}
          onBlur={() => setTerbuka(false)}
          onKeyDown={tanganiTombol}
        />
        {teks && (
          <button type="button" className="cari-hapus" aria-label="Hapus pencarian" onClick={() => setTeks('')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {tampilDaftar && (
        <ul id={`${id}-daftar`} role="listbox" className="popover-panel cari-daftar">
          {hasil.length === 0 && <li className="cari-kosong">Tidak ditemukan</li>}
          {hasil.map((item, i) => (
            <li
              key={item.value}
              id={`${id}-opsi-${i}`}
              role="option"
              aria-selected={i === aktif}
              className="cari-opsi"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setAktif(i)}
              onClick={() => pilih(item)}
            >
              <span>{item.label}</span>
              {item.keterangan && <span className="teks-sekunder cari-keterangan">{item.keterangan}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
