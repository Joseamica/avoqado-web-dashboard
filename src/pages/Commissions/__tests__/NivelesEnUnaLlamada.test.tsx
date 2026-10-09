// ft-graves, D-NIVELES (D2 de la QA): crear un esquema por niveles desde el panel fallaba siempre. Mandaba PERCENTAGE y los niveles
// en una segunda llamada; el server rechazaba los niveles y dejaba creado y ACTIVO un esquema al 3 % plano, mientras el aviso decía
// «Error al crear». Ahora todo flujo que crea un esquema por niveles manda TIERED con `tiers` en UNA sola llamada (con su clave), y
// si el server responde 400 se dice su mensaje y que no se creó nada.
import { createRef, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import CreateCommissionWizard, { type WizardHandle } from '../components/wizard/CreateCommissionWizard'
import { initialState } from '../components/setup-panel/useSetupReducer'
import type { CommissionSetupState } from '../components/setup-panel/types'
import { olvidarPendientes } from '../envioUnico'

const m = vi.hoisted(() => ({
  crearAlta: vi.fn(async (_venueId: string, _input: unknown, _clave?: string) => ({ id: 'c-panel', filterByStaff: false })),
  crear: vi.fn(async (_input: unknown) => ({ id: 'c-nuevo' })),
  crearNiveles: vi.fn(async (..._a: unknown[]) => []),
  toast: vi.fn((_t: unknown) => {}),
  estadoDelPanel: null as null | CommissionSetupState,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: null }) }))
vi.mock('@/hooks/use-role-config', () => {
  const valor = { activeRoles: [{ role: 'WAITER' }], getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({
  commissionKeys: { all: ['commissions'] },
  useCreateCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useCreateOrgCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useEffectiveCommissionConfigs: () => ({ data: [] }),
}))
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crearAlta, deleteConfig: vi.fn(), createTiersBatch: m.crearNiveles, createOverride: vi.fn() },
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
vi.mock('../components/setup-panel/useSetupReducer', async importOriginal => {
  const real = await importOriginal<typeof import('../components/setup-panel/useSetupReducer')>()
  return { ...real, initialState: () => (m.estadoDelPanel ? structuredClone(m.estadoDelPanel) : real.initialState()) }
})

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const rechazo = (message: string) => Object.assign(new Error('400'), { response: { status: 400, data: { message } } })

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  m.estadoDelPanel = null
})

describe('panel de la sucursal', () => {
  const conNiveles = () => {
    const s = initialState()
    s.name.value = 'Niveles'
    s.tiers.enabled = true
    s.tiers.tierPeriod = 'WEEKLY'
    return s
  }
  const crear = () => {
    render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
    fireEvent.click(screen.getByRole('button', { name: 'setup.createButton' }))
  }

  it('🔴 niveles prendidos: UNA llamada con calcType TIERED y los niveles dentro, con clave; nunca un esquema plano', async () => {
    m.estadoDelPanel = conNiveles()
    crear()
    await waitFor(() => expect(m.crearAlta).toHaveBeenCalled())
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'success.configCreated' }))
    expect(m.crearAlta).toHaveBeenCalledTimes(1)
    const [, cuerpo, clave] = m.crearAlta.mock.calls[0] as [string, { calcType: string; tiers: Array<Record<string, unknown>> }, string]
    expect(cuerpo.calcType).toBe('TIERED')
    expect(cuerpo.tiers.map(n => n.tierLevel)).toEqual([1, 2, 3])
    expect(cuerpo.tiers[2]).toMatchObject({ name: 'Oro', rate: 0.04, maxThreshold: null, tierType: 'BY_AMOUNT', period: 'WEEKLY' })
    expect(clave).toMatch(UUID)
    expect(m.crearNiveles).not.toHaveBeenCalled()
  })

  it('sin niveles: porcentaje plano, sin `tiers`', async () => {
    const s = initialState()
    s.name.value = 'Plano'
    m.estadoDelPanel = s
    crear()
    await waitFor(() => expect(m.crearAlta).toHaveBeenCalled())
    expect(m.crearAlta.mock.calls[0][1]).toMatchObject({ calcType: 'PERCENTAGE' })
    expect(m.crearAlta.mock.calls[0][1]).not.toHaveProperty('tiers')
  })

  it('🔴 un 400 del server se dice tal cual y deja claro que no se creó nada', async () => {
    m.estadoDelPanel = conNiveles()
    m.crearAlta.mockRejectedValueOnce(rechazo('Los niveles no pueden encimarse: el nivel 2 empieza antes de que acabe el 1.'))
    crear()
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'errors.notCreated',
          description: 'Los niveles no pueden encimarse: el nivel 2 empieza antes de que acabe el 1.',
          variant: 'destructive',
        }),
      ),
    )
    expect(m.crearNiveles).not.toHaveBeenCalled()
  })
})

describe('asistente de la sede (y de la organización)', () => {
  it.each([false, true])('🔴 con niveles: UNA llamada TIERED con `tiers` y su `period` (organización: %s)', async isOrgLevel => {
    const ref = createRef<WizardHandle>()
    render(<CreateCommissionWizard ref={ref} onSuccess={() => {}} isOrgLevel={isOrgLevel} hideNavigation />, { wrapper: envolver })
    fireEvent.click(screen.getByText('wizard.step2.advanced'))
    const titulo = screen.getByText('wizard.advanced.tiers.title')
    const bloque = titulo.closest('div.rounded-xl, div.border, div.p-4') as HTMLElement
    fireEvent.click(bloque.querySelector('[role="switch"]')!)
    await act(async () => {
      await ref.current!.submit()
    })
    expect(m.crear).toHaveBeenCalledTimes(1)
    const cuerpo = m.crear.mock.calls[0][0] as { calcType: string; tiers: Array<Record<string, unknown>>; clave: string }
    expect(cuerpo.calcType).toBe('TIERED')
    expect(cuerpo.tiers).toHaveLength(3)
    expect(cuerpo.tiers[0]).toMatchObject({ tierLevel: 1, period: 'MONTHLY' })
    expect(cuerpo.tiers[0]).not.toHaveProperty('tierPeriod')
    expect(cuerpo.clave).toMatch(UUID)
    expect(m.crearNiveles).not.toHaveBeenCalled()
  })

  it('🔴 un 400 al crear dice que no se creó nada, con el mensaje del server', async () => {
    m.crear.mockRejectedValueOnce(rechazo('La tasa de un nivel va de 0 % a 100 %: 200 % no es válida.'))
    const ref = createRef<WizardHandle>()
    render(<CreateCommissionWizard ref={ref} onSuccess={() => {}} hideNavigation />, { wrapper: envolver })
    await act(async () => {
      await ref.current!.submit()
    })
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'errors.notCreated', description: 'La tasa de un nivel va de 0 % a 100 %: 200 % no es válida.' }),
    )
  })
})
