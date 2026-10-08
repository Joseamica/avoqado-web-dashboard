// E6a-fix3 C2 (hermanos de `manage`): crear, renombrar y archivar niveles exigen «Configurar pago al personal» en TODAS las sedes
// de la organización (el 403 de `niveles.service`). Con el permiso aquí pero no en todas, se ven apagados y dicen por qué.
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NivelesSection } from '../components/NivelesSection'

const m = vi.hoisted(() => ({ can: vi.fn(), access: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayAccess: () => ({ data: m.access() }),
  useCreateLevel: () => ({ mutate: vi.fn(), isPending: false, isPaused: false, cancelarEnPausa: vi.fn() }),
  useUpdateLevel: () => ({ mutate: vi.fn(), isPending: false, isPaused: false, cancelarEnPausa: vi.fn() }),
}))

const NIVELES = [{ id: 'hc', name: 'Head Coach', sortOrder: 0, archivedAt: null }]

beforeEach(() => {
  m.can.mockImplementation(() => true)
  m.access.mockReturnValue({ puedeConfigurarOrganizacion: false })
})

describe('Niveles sin «Configurar pago al personal» en todas las sedes', () => {
  it('🔴 agregar, renombrar y archivar se ven apagados y el texto dice qué falta', () => {
    render(<NivelesSection activos={NIVELES} />)
    expect(screen.getByRole('button', { name: /levels\.add/ })).toBeDisabled()
    expect(screen.getByPlaceholderText('levels.namePlaceholder')).toBeDisabled()
    expect(screen.getByRole('button', { name: /levels\.rename/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /levels\.archiveLevel/ })).toBeDisabled()
    expect(screen.getByText('orgConfigPermission')).toBeInTheDocument()
  })
  it('con el permiso en todas (o un servidor viejo sin el campo) no cambia nada', () => {
    for (const a of [{ puedeConfigurarOrganizacion: true }, {}, undefined]) {
      m.access.mockReturnValue(a)
      const { unmount } = render(<NivelesSection activos={NIVELES} />)
      expect(screen.getByRole('button', { name: /levels\.rename/ })).toBeEnabled()
      expect(screen.getByPlaceholderText('levels.namePlaceholder')).toBeEnabled()
      expect(screen.queryByText('orgConfigPermission')).toBeNull()
      unmount()
    }
  })
  it('un nombre ya escrito no se puede agregar si el permiso se pierde (el botón también se apaga)', () => {
    m.access.mockReturnValue({ puedeConfigurarOrganizacion: true })
    const { rerender } = render(<NivelesSection activos={NIVELES} />)
    fireEvent.change(screen.getByPlaceholderText('levels.namePlaceholder'), { target: { value: 'Coach' } })
    expect(screen.getByRole('button', { name: /levels\.add/ })).toBeEnabled()
    m.access.mockReturnValue({ puedeConfigurarOrganizacion: false })
    rerender(<NivelesSection activos={NIVELES} />)
    expect(screen.getByRole('button', { name: /levels\.add/ })).toBeDisabled()
  })
  it('sin el permiso ni aquí no se muestra nada (como antes)', () => {
    m.can.mockImplementation(() => false)
    render(<NivelesSection activos={NIVELES} />)
    expect(screen.queryByRole('button', { name: /levels\.rename/ })).toBeNull()
    expect(screen.queryByText('orgConfigPermission')).toBeNull()
  })
})
