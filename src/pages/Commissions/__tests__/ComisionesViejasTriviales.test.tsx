// final-comisiones-trivial: dos defectos viejos de una línea.
// 1) CreateOverrideDialog mandaba `staff.id` (id de StaffVenue) como `staffId`: el servidor respondía 400 «not active in venue».
//    Aquí `id` y `staffId` son DISTINTOS a propósito (las otras pruebas los igualan y escondían el defecto).
// 2) CommissionSetupPanel invalidaba ['commission'] pero las llaves cuelgan de ['commissions', …]: el esquema nuevo no aparecía.
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import CreateOverrideDialog from '../components/CreateOverrideDialog'
import { initialState } from '../components/setup-panel/useSetupReducer'

const m = vi.hoisted(() => ({
  crearExcepcion: vi.fn(async (_input: unknown) => ({})),
  crearAlta: vi.fn(async (_venueId: string, _input: unknown) => ({ id: 'c-panel' }) as Record<string, unknown>),
  toast: vi.fn((_t: unknown) => {}),
  estado: null as null | ReturnType<typeof import('../components/setup-panel/useSetupReducer').initialState>,
}))
vi.mock('../components/setup-panel/useSetupReducer', async importOriginal => {
  const real = await importOriginal<typeof import('../components/setup-panel/useSetupReducer')>()
  return { ...real, initialState: () => (m.estado ? structuredClone(m.estado) : real.initialState()) }
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => {
  const valor = { activeRoles: [{ role: 'WAITER' }], getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', async importOriginal => {
  const real = await importOriginal<typeof import('@/hooks/useCommissions')>()
  return {
    commissionKeys: real.commissionKeys,
    useEffectiveCommissionConfigs: () => ({ data: [] }),
    useCreateCommissionOverride: () => ({ mutateAsync: m.crearExcepcion, isPending: false }),
    useUpdateCommissionOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }
})
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crearAlta, deleteConfig: vi.fn(), createTiersBatch: vi.fn(async () => []), createOverride: vi.fn() },
}))
vi.mock('@/services/team.service', () => ({
  teamService: {
    // `id` (StaffVenue) ≠ `staffId` (Staff): el servidor sólo entiende `staffId`.
    getTeamMembers: vi.fn(async () => ({
      data: [{ id: 'sv-ana', staffId: 'staff-ana', firstName: 'Ana', lastName: 'Ruiz', role: 'WAITER' }],
    })),
  },
}))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))

const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const envolver = (qc: QueryClient) => ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  m.estado = null
})

describe('final-comisiones-trivial', () => {
  it('🔴 crear una excepción manda el staffId de la persona, no el id de StaffVenue', async () => {
    render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" calcType="PERCENTAGE" />, { wrapper: envolver(cliente()) })
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('Ana Ruiz'))
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(m.crearExcepcion).toHaveBeenCalled())
    expect(m.crearExcepcion.mock.calls[0][0]).toMatchObject({ staffId: 'staff-ana' })
  })

  it('🔴 al crear un esquema se invalida la llave raíz de comisiones (commissionKeys.all)', async () => {
    const qc = cliente()
    const espia = vi.spyOn(qc, 'invalidateQueries')
    const s = initialState()
    s.name.value = 'Esquema'
    s.staff = { mode: 'all', overrides: [] }
    m.estado = s
    render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver(qc) })
    fireEvent.click(screen.getByRole('button', { name: 'setup.createButton' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalled())
    expect(espia).toHaveBeenCalledWith({ queryKey: ['commissions'] })
  })
})
