import { Popover } from 'radix-ui'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BULAN, formatAngka, formatPanjang, formatRingkas, hariIniWib, keDate, keIso, tambahHari } from '../../lib/tanggal'
import '../../styles/components/ui.css'

const HEADER_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const LANGKAH_TOMBOL = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

// Susun 6 minggu tanggal untuk satu bulan, mulai Senin
function susunMinggu(tahun, bulan) {
  const awal = new Date(tahun, bulan, 1)
  const geser = (awal.getDay() + 6) % 7
  const mulai = keIso(new Date(tahun, bulan, 1 - geser))
  return Array.from({ length: 42 }, (_, i) => tambahHari(mulai, i))
}

function dalamRentang(iso, min, max) {
  return (!min || iso >= min) && (!max || iso <= max)
}

// Pemilih tanggal dengan kalender kustom
export default function DatePicker({ value, onChange, min, max, label = 'Pilih tanggal', ringkas = false }) {
  const [terbuka, setTerbuka] = useState(false)
  const [fokus, setFokus] = useState(value)
  const gridRef = useRef(null)
  const tampil = keDate(fokus)
  const hariIni = hariIniWib()

  useEffect(() => {
    if (!terbuka) return
    gridRef.current?.querySelector(`[data-tanggal="${fokus}"]`)?.focus()
  }, [terbuka, fokus])

  function bukaTutup(buka) {
    if (buka) setFokus(value)
    setTerbuka(buka)
  }

  function geserBulan(n) {
    const d = keDate(fokus)
    const tujuan = keIso(new Date(d.getFullYear(), d.getMonth() + n, 1))
    setFokus(tujuan)
  }

  function tanganiTombol(e) {
    const langkah = LANGKAH_TOMBOL[e.key]
    if (!langkah) return
    e.preventDefault()
    const tujuan = tambahHari(fokus, langkah)
    if (dalamRentang(tujuan, min, max)) setFokus(tujuan)
  }

  function pilih(iso) {
    onChange(iso)
    setTerbuka(false)
  }

  return (
    <Popover.Root open={terbuka} onOpenChange={bukaTutup}>
      <Popover.Trigger className={`tanggal-trigger ${ringkas ? 'tanggal-ringkas' : ''}`} aria-label={`${label}: ${formatPanjang(value)}`}>
        <Calendar size={18} aria-hidden="true" />
        <span>{ringkas ? formatRingkas(value) : formatAngka(value)}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover-panel kalender" sideOffset={8} align="end" collisionPadding={16}>
          <div className="kalender-kepala">
            <button type="button" className="tombol-ikon" aria-label="Bulan sebelumnya" onClick={() => geserBulan(-1)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <p className="kalender-judul" aria-live="polite">
              {BULAN[tampil.getMonth()]} {tampil.getFullYear()}
            </p>
            <button type="button" className="tombol-ikon" aria-label="Bulan berikutnya" onClick={() => geserBulan(1)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="kalender-grid" role="grid" ref={gridRef} onKeyDown={tanganiTombol}>
            {HEADER_HARI.map((h) => (
              <span key={h} className="kalender-hari" role="columnheader">{h}</span>
            ))}
            {susunMinggu(tampil.getFullYear(), tampil.getMonth()).map((iso) => {
              const d = keDate(iso)
              const bisa = dalamRentang(iso, min, max)
              const kelas = [
                'kalender-tanggal',
                d.getMonth() !== tampil.getMonth() && 'luar-bulan',
                iso === value && 'terpilih',
                iso === hariIni && 'hari-ini',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  data-tanggal={iso}
                  className={kelas}
                  tabIndex={iso === fokus ? 0 : -1}
                  disabled={!bisa}
                  aria-selected={iso === value}
                  aria-label={formatPanjang(iso)}
                  onClick={() => pilih(iso)}
                  onFocus={() => setFokus(iso)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
