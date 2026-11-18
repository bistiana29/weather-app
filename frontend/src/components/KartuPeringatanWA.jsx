import { useQuery } from '@tanstack/react-query'
import { BellRing, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getPengaturan } from '../api/pengguna'
import { useAuth } from '../lib/auth'
import Button from './ui/Button'
import '../styles/components/kartu-wa.css'

const KUNCI_TUTUP = 'pce-kartu-wa-tutup'
const JEDA_MUNCUL_MS = 6000
const AMBANG_GULIR_PX = 240
const MASA_TUTUP_MS = 7 * 24 * 60 * 60 * 1000

function baruDitutup() {
  try {
    return Date.now() - Number(localStorage.getItem(KUNCI_TUTUP) ?? 0) < MASA_TUTUP_MS
  } catch {
    return false
  }
}

// Kartu kecil mengambang di pojok kanan bawah yang mengajak mengaktifkan peringatan WhatsApp
export default function KartuPeringatanWA() {
  const { t } = useTranslation()
  const { pengguna } = useAuth()
  const [muncul, setMuncul] = useState(false)
  const [ditutup, setDitutup] = useState(baruDitutup)
  const pengaturanQuery = useQuery({ queryKey: ['pengaturan'], queryFn: getPengaturan, enabled: pengguna?.role === 'user' })

  // Muncul setelah jeda singkat atau setelah halaman digulir, mana yang lebih dulu
  useEffect(() => {
    if (ditutup) return
    const tampilkan = () => setMuncul(true)
    const gulir = () => window.scrollY > AMBANG_GULIR_PX && tampilkan()
    const timer = setTimeout(tampilkan, JEDA_MUNCUL_MS)
    window.addEventListener('scroll', gulir, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', gulir)
    }
  }, [ditutup])

  // Admin dan pengguna yang notifikasinya aktif (atau belum termuat) tidak perlu diajak
  const relevan = !pengguna || (pengguna.role === 'user' && pengaturanQuery.data && !pengaturanQuery.data.notif_wa)
  const tujuan = pengguna ? '/settings' : '/register'

  function tutup() {
    try {
      localStorage.setItem(KUNCI_TUTUP, String(Date.now()))
    } catch {
      // Abaikan jika localStorage tidak tersedia; kartu tetap tertutup selama sesi ini
    }
    setDitutup(true)
  }

  return (
    <AnimatePresence>
      {relevan && muncul && !ditutup && (
        <motion.aside
          className="kartu-wa"
          aria-labelledby="kartu-wa-judul"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="kartu-wa-kepala">
            <span className="kartu-wa-ikon" aria-hidden="true">
              <BellRing size={18} />
            </span>
            <p id="kartu-wa-judul" className="kartu-wa-judul">{t('kartuWa.judul')}</p>
            <button type="button" className="kartu-wa-tutup" aria-label={t('kartuWa.tutup')} onClick={tutup}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="kartu-wa-teks">{t('kartuWa.teks')}</p>
          <Button as={Link} to={tujuan} ukuran="kecil" onClick={tutup}>
            {t(pengguna ? 'kartuWa.tombolPengguna' : 'kartuWa.tombol')}
          </Button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
