import { useTranslation } from 'react-i18next'
import { DAFTAR_PARAMETER } from '../../lib/kategori'
import { TabsList, TabsTrigger } from '../ui/Tabs'
import { IKON_PARAMETER } from './ikonCuaca'
import '../../styles/components/peta.css'

// Daftar tab parameter cuaca (dipakai di dalam <Tabs>)
export default function TabParameter() {
  const { t } = useTranslation()
  return (
    <TabsList label={t('peta.tabLabel')} className="tab-parameter">
      {DAFTAR_PARAMETER.map((p) => (
        <TabsTrigger key={p.slug} value={p.slug} ikon={IKON_PARAMETER[p.slug]}>
          {t(`parameter.${p.slug}.label`)}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
