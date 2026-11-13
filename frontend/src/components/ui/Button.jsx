import '../../styles/components/ui.css'

// Tombol dengan varian utama (solid), sekunder (neumorphic), hantu, dan terang
export default function Button({
  as: Komponen = 'button',
  variant = 'utama',
  ukuran = 'sedang',
  ikon: Ikon,
  ikonKanan: IkonKanan,
  className = '',
  children,
  ...props
}) {
  const tambahan = Komponen === 'button' && !props.type ? { type: 'button' } : {}
  return (
    <Komponen className={`btn btn-${variant} btn-${ukuran} ${className}`} {...tambahan} {...props}>
      {Ikon && <Ikon size={18} aria-hidden="true" />}
      {children}
      {IkonKanan && <IkonKanan size={18} aria-hidden="true" />}
    </Komponen>
  )
}
