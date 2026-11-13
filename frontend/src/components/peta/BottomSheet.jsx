import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import '../../styles/components/peta.css'

const TINGGI_INTIP = 210
const RASIO_TINGGI = 0.8
const PROYEKSI_KECEPATAN = 0.2

function transisiSheet(kurangiGerak) {
  return { type: 'tween', duration: kurangiGerak ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }
}

// Isi bottom sheet: posisi intip, terbuka penuh, atau ditarik ke bawah untuk menutup
function IsiSheet({ label, onTutup, children }) {
  const kurangiGerak = useReducedMotion()
  const kontrolTarik = useDragControls()
  const tinggi = Math.round(window.innerHeight * RASIO_TINGGI)
  const posisiIntip = tinggi - TINGGI_INTIP
  const [penuh, setPenuh] = useState(false)
  const y = useMotionValue(tinggi)
  const transisi = transisiSheet(kurangiGerak)

  useEffect(() => {
    animate(y, penuh ? 0 : posisiIntip, transisiSheet(kurangiGerak))
  }, [penuh, posisiIntip, y, kurangiGerak])

  // Pilih posisi terdekat setelah tarikan dilepas
  function selesaiTarik(_, info) {
    const perkiraan = y.get() + info.velocity.y * PROYEKSI_KECEPATAN
    const tujuan = [0, posisiIntip, tinggi].reduce((a, b) => (Math.abs(b - perkiraan) < Math.abs(a - perkiraan) ? b : a))
    if (tujuan === tinggi) {
      onTutup()
      return
    }
    setPenuh(tujuan === 0)
    animate(y, tujuan, transisi)
  }

  return (
    <motion.section
      className="bottom-sheet"
      aria-label={label}
      style={{ y, height: tinggi }}
      exit={{ y: tinggi, transition: transisi }}
      drag="y"
      dragControls={kontrolTarik}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: tinggi }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragEnd={selesaiTarik}
      onKeyDown={(e) => e.key === 'Escape' && onTutup()}
    >
      <div className="sheet-pegangan-area" onPointerDown={(e) => kontrolTarik.start(e)}>
        <button
          type="button"
          className="sheet-pegangan"
          aria-label={penuh ? 'Ciutkan panel prakiraan' : 'Perluas panel prakiraan'}
          aria-expanded={penuh}
          onClick={() => setPenuh((v) => !v)}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <div className={`sheet-isi ${penuh ? 'penuh' : ''}`}>{children}</div>
    </motion.section>
  )
}

// Bottom sheet untuk mobile yang muncul dari bawah
export default function BottomSheet({ terbuka, label, onTutup, children }) {
  return (
    <AnimatePresence>
      {terbuka && (
        <IsiSheet label={label} onTutup={onTutup}>
          {children}
        </IsiSheet>
      )}
    </AnimatePresence>
  )
}
