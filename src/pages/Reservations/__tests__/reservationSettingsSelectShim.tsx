/**
 * Sustituto de `@/components/ui/select` para las pruebas de Configuración de Reservaciones. Como
 * `src/test/nativeSelectShim.tsx`, pero cada `<select>` nativo toma el `aria-label` de su
 * `<SelectTrigger>` (así lo nombra la página), para elegir por nombre:
 *
 *   vi.mock('@/components/ui/select', () => import('./reservationSettingsSelectShim'))
 *   await user.selectOptions(screen.getByRole('combobox', { name: 'settings.scheduling.minNotice' }), '240')
 */
import { Children, isValidElement, type ReactNode } from 'react'

interface TriggerProps {
  'aria-label'?: string
  children?: ReactNode
}

export function SelectTrigger(_props: TriggerProps): null {
  return null
}

function triggerLabel(children: ReactNode): string | undefined {
  let label: string | undefined
  Children.forEach(children, child => {
    if (isValidElement<TriggerProps>(child) && child.type === SelectTrigger) label = child.props['aria-label']
  })
  return label
}

export function Select({
  value,
  onValueChange,
  disabled,
  children,
}: {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <select
      aria-label={triggerLabel(children) ?? 'select'}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onValueChange?.(e.target.value)}
    >
      <option value="">—</option>
      {children}
    </select>
  )
}

export function SelectValue(): null {
  return null
}

export function SelectContent({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SelectItem({ value, disabled }: { value: string; disabled?: boolean; children?: ReactNode }) {
  return (
    <option value={value} disabled={disabled}>
      {value}
    </option>
  )
}
