import { Link } from 'react-router'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import JudulHalaman from '../components/JudulHalaman'

// Halaman untuk alamat yang tidak dikenal
export default function TidakDitemukan() {
  return (
    <Card className="halaman-sementara">
      <JudulHalaman judul="Halaman tidak ditemukan" />
      <h1>Halaman tidak ditemukan</h1>
      <p className="teks-sekunder">Alamat yang Anda buka tidak tersedia.</p>
      <Button as={Link} to="/peta-risiko/hujan">Buka Peta Risiko</Button>
    </Card>
  )
}
