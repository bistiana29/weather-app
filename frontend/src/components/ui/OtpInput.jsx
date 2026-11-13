import { useRef } from 'react'
import '../../styles/components/ui.css'

// Enam kotak kode OTP dengan pindah fokus otomatis dan dukungan tempel
export default function OtpInput({ value, onChange, panjang = 6, disabled = false, label = 'Kode OTP' }) {
  const kotakRef = useRef([])
  const digit = Array.from({ length: panjang }, (_, i) => value[i] ?? '')

  function fokusKe(i) {
    kotakRef.current[Math.max(0, Math.min(i, panjang - 1))]?.focus()
  }

  function ubah(i, masukan) {
    const angka = masukan.replace(/\D/g, '')
    if (!angka) return
    const baru = [...digit]
    angka.slice(0, panjang - i).split('').forEach((a, j) => {
      baru[i + j] = a
    })
    onChange(baru.join(''))
    fokusKe(i + angka.length)
  }

  function tanganiTombol(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const baru = [...digit]
      if (baru[i]) {
        baru[i] = ''
      } else if (i > 0) {
        baru[i - 1] = ''
        fokusKe(i - 1)
      }
      onChange(baru.join(''))
    } else if (e.key === 'ArrowLeft') {
      fokusKe(i - 1)
    } else if (e.key === 'ArrowRight') {
      fokusKe(i + 1)
    }
  }

  return (
    <fieldset className="otp" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {digit.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            kotakRef.current[i] = el
          }}
          className="otp-kotak"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={panjang}
          aria-label={`Digit ${i + 1}`}
          value={d}
          onChange={(e) => ubah(i, e.target.value)}
          onKeyDown={(e) => tanganiTombol(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </fieldset>
  )
}
