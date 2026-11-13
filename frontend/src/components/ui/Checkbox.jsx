import { Checkbox as RCheckbox } from 'radix-ui'
import { Check } from 'lucide-react'
import { useId } from 'react'
import '../../styles/components/ui.css'

// Kotak centang berlabel dengan pesan galat
export default function Checkbox({ checked, onCheckedChange, galat, children }) {
  const id = useId()
  return (
    <div className="checkbox-wadah">
      <div className="checkbox-baris">
        <RCheckbox.Root
          id={id}
          className={`checkbox ${galat ? 'galat' : ''}`}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          aria-invalid={Boolean(galat)}
          aria-describedby={galat ? `${id}-galat` : undefined}
        >
          <RCheckbox.Indicator>
            <Check size={16} strokeWidth={3} aria-hidden="true" />
          </RCheckbox.Indicator>
        </RCheckbox.Root>
        <label htmlFor={id} className="checkbox-label">{children}</label>
      </div>
      {galat && <p id={`${id}-galat`} className="field-galat">{galat}</p>}
    </div>
  )
}
