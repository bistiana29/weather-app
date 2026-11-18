import { Dialog as RDialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import '../../styles/components/ui.css'

// Dialog modal dengan judul, deskripsi, dan tombol tutup
export default function Dialog({ open, onOpenChange, trigger, judul, deskripsi, lebar = false, children }) {
  const { t } = useTranslation()
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="dialog-overlay" />
        <RDialog.Content className={`dialog-konten ${lebar ? 'dialog-lebar' : ''}`}>
          <div className="dialog-kepala">
            <RDialog.Title className="dialog-judul">{judul}</RDialog.Title>
            <RDialog.Close className="tombol-ikon" aria-label={t('umum.tutupDialog')}>
              <X size={20} aria-hidden="true" />
            </RDialog.Close>
          </div>
          {deskripsi ? (
            <RDialog.Description className="teks-sekunder">{deskripsi}</RDialog.Description>
          ) : (
            <RDialog.Description className="sr-only">{judul}</RDialog.Description>
          )}
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

export const DialogClose = RDialog.Close
