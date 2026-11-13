import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import BantuanMock from '../BantuanMock'
import Button from '../ui/Button'
import '../../styles/components/admin.css'

// Judul halaman admin dengan tombol muat ulang semua data admin
export default function KepalaAdmin({ judul, deskripsi, aksi }) {
  const queryClient = useQueryClient()
  const memuat = useIsFetching({ queryKey: ['admin'] }) > 0

  return (
    <header className="admin-kepala">
      <div>
        <h1>{judul}</h1>
        {deskripsi && <p className="teks-sekunder">{deskripsi}</p>}
      </div>
      <div className="admin-kepala-aksi">
        <BantuanMock jenis="lencana" />
        {aksi}
        <Button
          variant="sekunder"
          ikon={RotateCw}
          className={memuat ? 'berputar' : ''}
          disabled={memuat}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
        >
          Muat ulang
        </Button>
      </div>
    </header>
  )
}
