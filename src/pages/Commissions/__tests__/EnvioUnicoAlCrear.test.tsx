// ft-graves, D-D1 (full-testing final): un doble clic en «Crear Configuración» creó dos esquemas idénticos y, con filtro de
// categorías, los dos pagaron ($20 en vez de $10). El botón se apagaba con `isPending`, que llega tarde: los dos clics salían
// antes. Ahora cada botón que crea algo en Comisiones tiene un candado síncrono y manda `Idempotency-Key`. Aquí: dos clics en el
// MISMO instante ⇒ una sola llamada, con clave; y la clave sigue a la operación, no al clic.
import { createRef, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import CreateCommissionWizard, { type WizardHandle } from '../components/wizard/CreateCommissionWizard'
import CreateTierDialog from '../components/CreateTierDialog'
import CreateOverrideDialog from '../components/CreateOverrideDialog'
import CreateGoalDialog from '../components/CreateGoalDialog'
import { initialState } from '../components/setup-panel/useSetupReducer'
import type { CommissionSetupState } from '../components/setup-panel/types'
import { olvidarPendientes } from '../envioUnico'

const m = vi.hoisted(() => ({
  crearAlta: vi.fn(async (_venueId: string, _input: unknown, _clave?: string) => ({ id: 'c-panel', filterByStaff: false })),
  crear: vi.fn(async (_input: unknown) => ({ id: 'c-nuevo' })),
  crearNivel: vi.fn(async (_input: unknown) => ({})),
  crearExcepcion: vi.fn(async (_input: unknown) => ({})),
  crearMeta: vi.fn(async (_input: unknown) => ({})),
  estadoDelPanel: null as null | CommissionSetupState,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: null }) }))
vi.mock('@/hooks/use-role-config', () => {
  const valor = { activeRoles: [{ role: 'WAITER' }], getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({
  useCreateCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useCreateOrgCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useEffectiveCommissionConfigs: () => ({ data: [] }),
  useCreateCommissionTier: () => ({ mutateAsync: m.crearNivel, isPending: false }),
  useUpdateCommissionTier: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateCommissionOverride: () => ({ mutateAsync: m.crearExcepcion, isPending: false }),
  useUpdateCommissionOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSalesGoal: () => ({ mutateAsync: m.crearMeta, isPending: false }),
  useUpdateSalesGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crearAlta, deleteConfig: vi.fn(), createTiersBatch: vi.fn(async () => []), createOverride: vi.fn() },
}))
vi.mock('@/services/team.service', () => ({
  teamService: {
    getTeamMembers: vi.fn(async () => ({ data: [{ id: 'sv-ana', staffId: 'staff-ana', firstName: 'Ana', lastName: 'Ruiz', role: 'WAITER' }] })),
  },
}))
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
const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const conEstado = (status: number) => Object.assign(new Error(`status ${status}`), { response: { status, data: { message: 'x' } } })
/** Dos clics en el MISMO instante, antes de que React vuelva a pintar el botón. */
const dobleClic = (el: HTMLElement) =>
  act(() => {
    el.click()
    el.click()
  })
const dobleEnvio = (form: HTMLFormElement) =>
  act(() => {
    fireEvent.submit(form)
    fireEvent.submit(form)
  })

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  const s = initialState()
  s.name.value = 'Bebidas 10%'
  m.estadoDelPanel = s
})

describe('panel de la sucursal («Crear Configuración»)', () => {
  const boton = () => screen.getByRole('button', { name: 'setup.createButton' })

  it('🔴 dos clics en el mismo instante crean UN esquema, con Idempotency-Key', async () => {
    render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
    await dobleClic(boton())
    await waitFor(() => expect(m.crearAlta).toHaveBeenCalled())
    await act(async () => {})
    expect(m.crearAlta).toHaveBeenCalledTimes(1)
    expect(m.crearAlta.mock.calls[0][2]).toMatch(UUID)
  })

  it('🔴 sin respuesta, volver a crear lo mismo manda la MISMA clave; tras un 4xx, una nueva', async () => {
    m.crearAlta.mockRejectedValueOnce(sinRespuesta()).mockRejectedValueOnce(conEstado(400))
    render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
    fireEvent.click(boton())
    await waitFor(() => expect(m.crearAlta).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(boton()).not.toBeDisabled())
    fireEvent.click(boton())
    await waitFor(() => expect(m.crearAlta).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(boton()).not.toBeDisabled())
    fireEvent.click(boton())
    await waitFor(() => expect(m.crearAlta).toHaveBeenCalledTimes(3))
    const [primera, segunda, tercera] = m.crearAlta.mock.calls.map(c => c[2])
    expect(segunda).toBe(primera)
    expect(tercera).not.toBe(segunda)
  })
})

describe('asistente (organización)', () => {
  it('🔴 dos envíos en el mismo instante crean UN esquema, con clave', async () => {
    const ref = createRef<WizardHandle>()
    render(<CreateCommissionWizard ref={ref} onSuccess={() => {}} isOrgLevel hideNavigation />, { wrapper: envolver })
    await act(async () => {
      await Promise.all([ref.current!.submit(), ref.current!.submit()])
    })
    expect(m.crear).toHaveBeenCalledTimes(1)
    expect((m.crear.mock.calls[0][0] as { clave?: string }).clave).toMatch(UUID)
  })
})

describe('nivel, excepción y meta', () => {
  it('🔴 «Crear nivel»: dos envíos en el mismo instante crean UNO, con clave', async () => {
    render(<CreateTierDialog open onOpenChange={() => {}} configId="c1" nextLevel={1} />, { wrapper: envolver })
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Bronce' } })
    await dobleEnvio(document.querySelector('form')!)
    await waitFor(() => expect(m.crearNivel).toHaveBeenCalled())
    await act(async () => {})
    expect(m.crearNivel).toHaveBeenCalledTimes(1)
    expect((m.crearNivel.mock.calls[0][0] as { clave?: string }).clave).toMatch(UUID)
  })

  it('🔴 «Agregar excepción»: dos envíos en el mismo instante crean UNA, con clave', async () => {
    render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" calcType="PERCENTAGE" />, { wrapper: envolver })
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('Ana Ruiz'))
    await dobleEnvio(document.querySelector('form')!)
    await waitFor(() => expect(m.crearExcepcion).toHaveBeenCalled())
    await act(async () => {})
    expect(m.crearExcepcion).toHaveBeenCalledTimes(1)
    expect((m.crearExcepcion.mock.calls[0][0] as { clave?: string }).clave).toMatch(UUID)
  })

  it('🔴 «Crear meta»: dos envíos en el mismo instante crean UNA, con clave', async () => {
    render(<CreateGoalDialog open onOpenChange={() => {}} />, { wrapper: envolver })
    await dobleEnvio(document.querySelector('form')!)
    await waitFor(() => expect(m.crearMeta).toHaveBeenCalled())
    await act(async () => {})
    expect(m.crearMeta).toHaveBeenCalledTimes(1)
    expect((m.crearMeta.mock.calls[0][0] as { clave?: string }).clave).toMatch(UUID)
  })

  it('🔴 una meta que quedó sin respuesta no cierra el diálogo y el reintento manda la misma clave', async () => {
    const cerrar = vi.fn()
    m.crearMeta.mockRejectedValueOnce(sinRespuesta())
    render(<CreateGoalDialog open onOpenChange={cerrar} />, { wrapper: envolver })
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(m.crearMeta).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(cerrar).not.toHaveBeenCalled()
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(m.crearMeta).toHaveBeenCalledTimes(2))
    const [primera, segunda] = m.crearMeta.mock.calls.map(c => (c[0] as { clave?: string }).clave)
    expect(segunda).toBe(primera)
  })
})
