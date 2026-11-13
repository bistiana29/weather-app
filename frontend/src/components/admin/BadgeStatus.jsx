import { Activity, Archive, CircleCheck, CircleMinus, CircleX, Clock, FlaskConical, OctagonX, RefreshCcw, TriangleAlert } from 'lucide-react'
import Badge from '../ui/Badge'

// Label, nada warna, dan ikon untuk setiap status yang dipakai di halaman admin
const STATUS = {
  success: ['Sukses', 'sukses', CircleCheck],
  running: ['Berjalan', 'berjalan', Activity],
  failed: ['Gagal', 'gagal', CircleX],
  skipped: ['Dilewati', 'netral', CircleMinus],
  superseded: ['Diganti', 'netral', RefreshCcw],
  aborted: ['Terhenti', 'peringatan', OctagonX],
  sukses: ['Sukses', 'sukses', CircleCheck],
  peringatan: ['Perlu dicek', 'peringatan', TriangleAlert],
  gagal: ['Gagal', 'gagal', CircleX],
  menunggu: ['Menunggu', 'netral', Clock],
  terkirim: ['Terkirim', 'sukses', CircleCheck],
  terhubung: ['Terhubung', 'sukses', CircleCheck],
  terputus: ['Terputus', 'gagal', CircleX],
  production: ['Produksi', 'sukses', CircleCheck],
  staging: ['Staging', 'berjalan', FlaskConical],
  archived: ['Arsip', 'netral', Archive],
}

// Badge status dengan ikon agar tidak bergantung pada warna saja
export default function BadgeStatus({ status }) {
  const [label, nada, Ikon] = STATUS[status] ?? [status, 'netral', CircleMinus]
  return (
    <Badge nada={nada}>
      <Ikon size={14} aria-hidden="true" />
      {label}
    </Badge>
  )
}
