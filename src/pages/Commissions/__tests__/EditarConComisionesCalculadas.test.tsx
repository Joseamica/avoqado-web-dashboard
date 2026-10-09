// ft-graves, B1 (full-testing final): tras la primera venta, «Editar configuración» ya no guardaba NADA. Mandaba siempre tasa,
// tipo y quién recibe, y el servidor rechaza que vengan en un esquema con comisiones calculadas: ni el nombre, ni «Sólo personas
// elegidas», ni «Calcular con IVA». Y el aviso decía «desactívala», sin ningún botón para desactivar. Ahora: se manda sólo lo que
// cambió; tasa y tipo se ven bloqueados con su explicación y dos salidas, «Desactivar» y «Duplicar con cambios».
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import EditConfigDialog from '../components/EditConfigDialog'

const m = vi.hoisted(() => ({
  editar: vi.fn(async (_input: unknown) => ({})),
  toast: vi.fn((_t: unknown) => {}),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o && 'campo' in o ? `${k}:${String(o.campo)}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: { id: 'v1', timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ activeRoles: [], getDisplayName: (r: string) => r }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  useCreateCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/services/commission.service', () => ({ commissionService: {} }))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
// Los niveles viven en la configuración avanzada: prenderlos cambia el tipo de cálculo a TIERED.
vi.mock('../components/wizard/CommissionAdvancedConfig', () => ({
  default: ({ updateData }: { updateData: (u: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => updateData({ tiersEnabled: true })}>
      prender-niveles
    </button>
  ),
}))

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

const CON_VENTAS: CommissionConfig = {
  id: 'c1', venueId: 'v1', name: 'FULLTEST Fijo 10', priority: 1, recipient: 'SERVER', calcType: 'FIXED', defaultRate: 10,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: false, categoryIds: [], filterByStaff: false, staffIds: [], useGoalAsTier: false, goalBonusRate: null,
  attendanceLinked: false, attendanceLatePenaltyRate: null, effectiveFrom: '2026-10-09T00:32:00.000Z', effectiveTo: null,
  aggregationPeriod: 'MONTHLY', active: true, createdAt: '', updatedAt: '', overrides: [], tiers: [],
  _count: { tiers: 0, overrides: 0, calculations: 1 },
} as CommissionConfig

const abrir = (config: CommissionConfig = CON_VENTAS, onOpenChange = vi.fn()) => {
  render(<EditConfigDialog open onOpenChange={onOpenChange} config={config} />, { wrapper: envolver })
  return onOpenChange
}
const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
const mandado = () => (m.editar.mock.calls[0]?.[0] as { configId: string; data: Record<string, unknown> } | undefined)?.data
const interruptorDe = (texto: string) => {
  const caja = screen.getByText(texto).closest('div.rounded-xl, div.p-4') as HTMLElement
  return within(caja).getAllByRole('switch')[0]
}

beforeEach(() => vi.clearAllMocks())

describe('editar un esquema con comisiones calculadas (B1)', () => {
  it('🔴 cambiar sólo el nombre manda sólo el nombre (ni tasa, ni tipo, ni quién recibe, ni la fecha)', async () => {
    const cerrar = abrir()
    fireEvent.change(screen.getByLabelText('config.name'), { target: { value: 'Fijo 10 Bebidas' } })
    guardar()
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(mandado()).toEqual({ name: 'Fijo 10 Bebidas' })
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false))
  })

  it('🔴 prender «Calcular con IVA» manda sólo `includeTax`', async () => {
    abrir()
    fireEvent.click(document.getElementById('edit-includeTax')!)
    guardar()
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(mandado()).toEqual({ includeTax: true })
  })

  it('🔴 sin cambios no manda nada y cierra', async () => {
    const cerrar = abrir()
    guardar()
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false))
    expect(m.editar).not.toHaveBeenCalled()
  })

  it('🔴 apagar «vigencia personalizada» quita la fecha de fin (antes la dejaba)', async () => {
    abrir({ ...CON_VENTAS, effectiveTo: '2026-11-01T05:59:59.999Z' })
    fireEvent.click(interruptorDe('wizard.step3.validityCustom'))
    guardar()
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(mandado()).toEqual({ effectiveTo: null })
  })

  it('🔴 la tasa y el tipo se ven bloqueados con la explicación y dos salidas: «Desactivar» y «Duplicar con cambios»', () => {
    abrir()
    expect(screen.getByText('config.locked.title')).toBeInTheDocument()
    expect(screen.getByText('config.locked.desc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'config.deactivate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'config.duplicateWithChanges' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'wizard.step2.percentage' })).toBeDisabled()
    expect(screen.getByLabelText('wizard.step2.fixedAmount')).toBeDisabled()
  })

  it('🔴 «Desactivar» pide confirmación y manda sólo `active: false`', async () => {
    const cerrar = abrir()
    fireEvent.click(screen.getByRole('button', { name: 'config.deactivate' }))
    expect(m.editar).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'config.deactivateConfirm' }))
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(m.editar.mock.calls[0][0]).toEqual({ configId: 'c1', data: { active: false } })
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false))
  })

  it('🔴 si algo cambiaría el tipo (prender niveles) en un esquema con ventas, no se manda y se dice por qué', async () => {
    abrir({ ...CON_VENTAS, calcType: 'PERCENTAGE', defaultRate: 0.1 })
    fireEvent.click(screen.getByRole('button', { name: 'prender-niveles' }))
    guardar()
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'config.lockedChange:config.lockedFields.calcType' })),
    )
    expect(m.editar).not.toHaveBeenCalled()
  })

  it('el 400 del servidor se dice tal cual, en español', async () => {
    const mensaje = 'Este esquema ya tiene 1 comisiones calculadas y no se puede cambiar la tasa. Desactívalo y crea uno nuevo con el cambio.'
    m.editar.mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: { message: mensaje } } }))
    abrir()
    fireEvent.change(screen.getByLabelText('config.name'), { target: { value: 'Otro' } })
    guardar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: mensaje, variant: 'destructive' })))
  })

  it('sin comisiones calculadas no hay candado y la tasa sí se manda si cambia', async () => {
    abrir({ ...CON_VENTAS, _count: { tiers: 0, overrides: 0, calculations: 0 } })
    expect(screen.queryByText('config.locked.title')).toBeNull()
    fireEvent.change(screen.getByLabelText('wizard.step2.fixedAmount'), { target: { value: '12' } })
    guardar()
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(mandado()).toEqual({ defaultRate: 12 })
  })
})
