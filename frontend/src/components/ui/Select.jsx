import { Select as RSelect } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { useId } from 'react'
import '../../styles/components/ui.css'

// Dropdown pilihan tunggal
export default function Select({ value, onValueChange, options, placeholder = 'Pilih…', label, sembunyikanLabel = false }) {
  const id = useId()
  return (
    <div className="field">
      {label && (
        <label htmlFor={id} className={sembunyikanLabel ? 'sr-only' : 'field-label'}>
          {label}
        </label>
      )}
      <RSelect.Root value={value} onValueChange={onValueChange}>
        <RSelect.Trigger id={id} className="select-trigger">
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon>
            <ChevronDown size={18} aria-hidden="true" />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content className="popover-panel select-content" position="popper" sideOffset={8}>
            <RSelect.Viewport>
              {options.map((opsi) => (
                <RSelect.Item key={opsi.value} value={opsi.value} className="select-item">
                  <RSelect.ItemText>{opsi.label}</RSelect.ItemText>
                  <RSelect.ItemIndicator>
                    <Check size={16} aria-hidden="true" />
                  </RSelect.ItemIndicator>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  )
}
