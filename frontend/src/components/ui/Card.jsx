import '../../styles/components/ui.css'

// Kartu bento dengan varian biasa (neumorphic) atau sorotan (gradasi biru)
export default function Card({ as: Komponen = 'div', variant = 'biasa', className = '', children, ...props }) {
  return (
    <Komponen className={`kartu kartu-${variant} ${className}`} {...props}>
      {children}
    </Komponen>
  )
}
