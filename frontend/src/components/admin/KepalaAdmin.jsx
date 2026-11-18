import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import BantuanMock from '../BantuanMock'
import JudulHalaman from '../JudulHalaman'
import PageHeader from '../layout/PageHeader'
import Button from '../ui/Button'
import '../../styles/components/admin.css'

// Header halaman admin (PageHeader) dengan aksi halaman dan tombol muat ulang semua data admin
export default function KepalaAdmin({ judul, deskripsi, aksi }) {
  const queryClient = useQueryClient()
  const memuat = useIsFetching({ queryKey: ['admin'] }) > 0

  return (
    <>
      <JudulHalaman judul={`${judul} · Panel Admin`} tanpaIndeks />
      <PageHeader
        judul={judul}
        subjudul={
          <>
            {deskripsi && <span>{deskripsi}</span>}
            <BantuanMock jenis="lencana" />
          </>
        }
      >
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
      </PageHeader>
    </>
  )
}
