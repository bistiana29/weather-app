import { Tabs as RTabs } from 'radix-ui'
import { motion } from 'motion/react'
import { createContext, use, useId } from 'react'
import '../../styles/components/ui.css'

const TabsContext = createContext(null)

// Tab dengan pill aktif timbul yang bergeser saat berganti
export function Tabs({ value, onValueChange, className = '', children }) {
  const id = useId()
  return (
    <TabsContext value={{ value, id }}>
      <RTabs.Root value={value} onValueChange={onValueChange} activationMode="manual" className={className}>
        {children}
      </RTabs.Root>
    </TabsContext>
  )
}

export function TabsList({ label, className = '', children }) {
  return (
    <RTabs.List aria-label={label} className={`tabs-list ${className}`}>
      {children}
    </RTabs.List>
  )
}

export function TabsTrigger({ value, ikon: Ikon, children }) {
  const konteks = use(TabsContext)
  const aktif = konteks.value === value
  return (
    <RTabs.Trigger value={value} className="tab-trigger">
      {aktif && (
        <motion.span
          layoutId={`${konteks.id}-pill`}
          className="tab-pill"
          transition={{ type: 'tween', duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      <span className="tab-isi">
        {Ikon && <Ikon size={18} aria-hidden="true" />}
        {children}
      </span>
    </RTabs.Trigger>
  )
}

export function TabsContent({ value, className = '', children }) {
  return (
    <RTabs.Content value={value} className={className}>
      {children}
    </RTabs.Content>
  )
}
