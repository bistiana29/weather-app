import { Tooltip as RTooltip } from 'radix-ui'
import '../../styles/components/ui.css'

// Tooltip kecil untuk tombol ikon
export default function Tooltip({ label, side = 'top', children, aktif = true }) {
  if (!aktif) return children
  return (
    <RTooltip.Root delayDuration={300}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="tooltip" side={side} sideOffset={8}>
          {label}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
