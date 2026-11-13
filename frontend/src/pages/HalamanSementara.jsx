import { Construction } from 'lucide-react'
import Card from '../components/ui/Card'

// Penanda halaman yang dikerjakan di fase berikutnya
export default function HalamanSementara({ judul, fase }) {
  return (
    <Card className="halaman-sementara">
      <Construction size={28} aria-hidden="true" />
      <h1>{judul}</h1>
      <p className="teks-sekunder">Konten halaman ini dikerjakan pada Fase {fase}.</p>
    </Card>
  )
}
