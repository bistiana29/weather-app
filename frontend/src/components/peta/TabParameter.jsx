import { DAFTAR_PARAMETER } from '../../lib/kategori'
import { TabsList, TabsTrigger } from '../ui/Tabs'
import { IKON_PARAMETER } from './ikonCuaca'
import '../../styles/components/peta.css'

// Daftar tab parameter cuaca (dipakai di dalam <Tabs>)
export default function TabParameter() {
  return (
    <TabsList label="Parameter cuaca" className="tab-parameter">
      {DAFTAR_PARAMETER.map((p) => (
        <TabsTrigger key={p.slug} value={p.slug} ikon={IKON_PARAMETER[p.slug]}>
          {p.label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
