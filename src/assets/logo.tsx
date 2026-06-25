import isotipo from './Isotipo.png'

const Logo = ({ className }: { className?: string }) => (
  <img src={isotipo} alt="Avoqado" className={`object-contain ${className ?? ''}`} />
)

export default Logo
