// E6a-fix3 C2 (hermano de `manage`): el selector de nivel del perfil del miembro también exige «Configurar pago al personal» en
// todas las sedes (asignar nivel, `niveles.service`).
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NivelDePagoSection } from '../NivelDePagoSection'

const m = vi.hoisted(() => ({ can: vi.fn(), access: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => d }) }))
vi.mock('@/pages/StaffPay/components/AsignarNivelModal', () => ({ AsignarNivelModal: () => null }))
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, disabled, children }: any) => <select aria-label="member.title" value={value} disabled={disabled} onChange={() => {}}><option value="" />{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayAccess: () => ({ data: m.access() }),
  useStaffPayLevels: () => ({ data: [{ id: 'hc', name: 'Head Coach', sortOrder: 0, archivedAt: null }] }),
  useStaffPayAssignments: () => ({ data: [] }),
}))

beforeEach(() => {
  m.can.mockImplementation(() => true)
  m.access.mockReturnValue({ enabled: true, puedeConfigurarOrganizacion: false })
})

describe('Nivel de pago del miembro sin «Configurar pago al personal» en todas las sedes', () => {
  it('🔴 el selector se ve apagado y dice qué falta', () => {
    render(<NivelDePagoSection staffId="s1" staffName="Ana" />)
    expect(screen.getByLabelText('member.title')).toBeDisabled()
    expect(screen.getByText('orgConfigPermission')).toBeInTheDocument()
  })
  it('con el permiso en todas (o servidor viejo) se puede elegir', () => {
    for (const a of [{ enabled: true, puedeConfigurarOrganizacion: true }, { enabled: true }]) {
      m.access.mockReturnValue(a)
      const { unmount } = render(<NivelDePagoSection staffId="s1" staffName="Ana" />)
      expect(screen.getByLabelText('member.title')).toBeEnabled()
      expect(screen.queryByText('orgConfigPermission')).toBeNull()
      unmount()
    }
  })
})
