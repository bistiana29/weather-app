import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'
import '../../styles/components/ui.css'

// Kolom isian berlabel dengan pesan bantuan/galat, awalan, dan tombol lihat password
export default function TextField({ label, galat, bantuan, awalan, type = 'text', baris, className = '', ...props }) {
  const id = useId()
  const [lihat, setLihat] = useState(false)
  const sandi = type === 'password'
  const idKeterangan = galat || bantuan ? `${id}-keterangan` : undefined

  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className={`input-kotak ${galat ? 'galat' : ''}`}>
        {awalan && <span className="input-awalan" aria-hidden="true">{awalan}</span>}
        {baris ? (
          <textarea id={id} rows={baris} aria-invalid={Boolean(galat)} aria-describedby={idKeterangan} {...props} />
        ) : (
          <input
            id={id}
            type={sandi && lihat ? 'text' : type}
            aria-invalid={Boolean(galat)}
            aria-describedby={idKeterangan}
            {...props}
          />
        )}
        {sandi && (
          <button
            type="button"
            className="input-aksi"
            aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-pressed={lihat}
            onClick={() => setLihat((v) => !v)}
          >
            {lihat ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {(galat || bantuan) && (
        <p id={idKeterangan} className={galat ? 'field-galat' : 'field-bantuan'}>
          {galat || bantuan}
        </p>
      )}
    </div>
  )
}
