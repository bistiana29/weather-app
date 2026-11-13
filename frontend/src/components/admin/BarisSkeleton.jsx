import Skeleton from '../ui/Skeleton'

// Baris tabel kerangka dengan jumlah kolom sama seperti tabel aslinya
export default function BarisSkeleton({ kolom, baris = 4 }) {
  return Array.from({ length: baris }, (_, i) => (
    <tr key={i} aria-hidden="true">
      {Array.from({ length: kolom }, (_, j) => (
        <td key={j}>
          <Skeleton height={16} width={j === 0 ? '70%' : '55%'} />
        </td>
      ))}
    </tr>
  ))
}
