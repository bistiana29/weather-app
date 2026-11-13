import { CircleAlert, Info } from 'lucide-react'
import '../../styles/components/ui.css'

// Kotak pesan galat atau info di dalam formulir
export default function Pesan({ nada = 'info', children }) {
  const Ikon = nada === 'galat' ? CircleAlert : Info
  return (
    <div className={`pesan pesan-${nada}`} role={nada === 'galat' ? 'alert' : 'status'}>
      <Ikon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
