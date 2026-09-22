/**
 * Sustituto de `@/components/ui/select` (Radix) SÓLO para pruebas. Radix abre su menú con pointer
 * capture (`hasPointerCapture`), que jsdom no implementa: ninguna prueba del repo había logrado elegir
 * una opción. Aquí cada `<Select name="x">` es un `<select aria-label="x">` nativo:
 *
 *   vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
 *   await user.selectOptions(screen.getByRole('combobox', { name: 'x' }), 'VALOR')
 *
 * Las opciones exponen su `value` como texto: la prueba elige por código, no por etiqueta.
 */
import type { ReactNode } from 'react'

interface ShimSelectProps {
  name?: string
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: ReactNode
}

export function Select({ name, value, onValueChange, disabled, children }: ShimSelectProps) {
  return (
    <select aria-label={name ?? 'select'} name={name} value={value ?? ''} disabled={disabled} onChange={e => onValueChange?.(e.target.value)}>
      <option value="">—</option>
      {children}
    </select>
  )
}

export function SelectTrigger(): null {
  return null
}

export function SelectValue(): null {
  return null
}

export function SelectLabel(): null {
  return null
}

export function SelectSeparator(): null {
  return null
}

export function SelectContent({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SelectGroup({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SelectItem({ value }: { value: string; children?: ReactNode }) {
  return <option value={value}>{value}</option>
}
