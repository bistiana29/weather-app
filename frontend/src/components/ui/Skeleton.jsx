import '../../styles/components/ui.css'

// Blok skeleton dengan efek shimmer
export default function Skeleton({ width = '100%', height = 16, radius = 8, className = '', style }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}
