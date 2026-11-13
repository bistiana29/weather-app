import { teksKontras } from '../../lib/kategori'
import '../../styles/components/ui.css'

// Badge label; jika diberi warna data, warna teks dipilih otomatis agar kontras
export default function Badge({ warna, nada = 'netral', className = '', children }) {
  const gaya = warna ? { background: warna, color: teksKontras(warna) } : undefined
  return (
    <span className={`badge ${warna ? 'badge-data' : `badge-${nada}`} ${className}`} style={gaya}>
      {children}
    </span>
  )
}
