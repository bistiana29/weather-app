import { Switch as RSwitch } from 'radix-ui'
import { useId } from 'react'
import '../../styles/components/ui.css'

// Saklar on/off dengan label
export default function Switch({ checked, onCheckedChange, label, deskripsi, disabled }) {
  const id = useId()
  return (
    <div className="switch-baris">
      <div className="switch-teks">
        <label htmlFor={id} className="switch-label">{label}</label>
        {deskripsi && <p className="teks-sekunder switch-deskripsi">{deskripsi}</p>}
      </div>
      <RSwitch.Root id={id} className="switch" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled}>
        <RSwitch.Thumb className="switch-thumb" />
      </RSwitch.Root>
    </div>
  )
}
