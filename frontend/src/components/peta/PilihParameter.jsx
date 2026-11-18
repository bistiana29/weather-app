import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import { PARAMETER_PETA } from '../../lib/kategori'
import '../../styles/components/peta.css'

// Dropdown checkbox parameter: "Semua" atau beberapa parameter, minimal satu selalu tercentang
export default function PilihParameter({ dipilih, onUbah }) {
  const { t } = useTranslation()
  const f = useFormat()
  const semua = dipilih.length === PARAMETER_PETA.length
  const label = semua ? t('peta.parameter.semua') : dipilih.length === 1 ? f.parameterLabel(dipilih[0]) : t('peta.parameter.jumlah', { n: dipilih.length })

  // Centang/hapus satu parameter; parameter terakhir tidak bisa dihapus
  function ubahSatu(slug, centang) {
    if (!centang && dipilih.length === 1) return
    const baru = centang ? [...dipilih, slug] : dipilih.filter((p) => p !== slug)
    onUbah(PARAMETER_PETA.filter((p) => baru.includes(p)))
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="pilih-parameter" aria-label={t('peta.parameter.aria', { label })}>
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span className="pilih-parameter-teks">
          <span className="pilih-parameter-awalan">{t('peta.parameter.label')}:</span> {label}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="popover-panel pilih-parameter-menu" sideOffset={8} align="end" collisionPadding={16}>
          <DropdownMenu.CheckboxItem
            className="pilih-parameter-opsi pilih-parameter-semua"
            checked={semua}
            onCheckedChange={(centang) => onUbah(centang ? PARAMETER_PETA : [dipilih[0]])}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="pilih-parameter-kotak" aria-hidden="true">
              <DropdownMenu.ItemIndicator>
                <Check size={14} strokeWidth={3} />
              </DropdownMenu.ItemIndicator>
            </span>
            {t('peta.parameter.semua')}
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Separator className="pilih-parameter-garis" />
          {PARAMETER_PETA.map((slug) => (
            <DropdownMenu.CheckboxItem
              key={slug}
              className="pilih-parameter-opsi"
              checked={dipilih.includes(slug)}
              disabled={dipilih.length === 1 && dipilih[0] === slug}
              onCheckedChange={(centang) => ubahSatu(slug, centang)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="pilih-parameter-kotak" aria-hidden="true">
                <DropdownMenu.ItemIndicator>
                  <Check size={14} strokeWidth={3} />
                </DropdownMenu.ItemIndicator>
              </span>
              {f.parameterJudul(slug)}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
