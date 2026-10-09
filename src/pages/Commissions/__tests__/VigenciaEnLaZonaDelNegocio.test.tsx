// ft-graves, D-D2 (full-testing final): editar un esquema de noche lo dejaba «vigente desde» MAÑANA. El editor mostraba el día
// UTC (`effectiveFrom.split('T')[0]`) y guardaba la medianoche del NAVEGADOR; después de las 18:00 en México eso ya es el día
// siguiente y lo vendido esa noche no generaba comisión. Lo mismo en el panel de la sucursal, el asistente, las excepciones por
// persona y las fichas. Aquí el reloj marca las 18:30 de México y el navegador está en otra zona: lo que se ve y lo que se
// guarda es el día del NEGOCIO.
import { createRef, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig, CommissionOverride } from '@/types/commission'
import EditConfigDialog from '../components/EditConfigDialog'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import CreateCommissionWizard, { type WizardHandle } from '../components/wizard/CreateCommissionWizard'
import CreateOverrideDialog from '../components/CreateOverrideDialog'
import CommissionConfigCard from '../components/CommissionConfigCard'
import { initialState } from '../components/setup-panel/useSetupReducer'
import type { CommissionSetupState } from '../components/setup-panel/types'

const m = vi.hoisted(() => ({
  editar: vi.fn(async (_input: unknown) => ({})),
  crear: vi.fn(async (_input: unknown) => ({ id: 'c-nuevo' })),
  crearAlta: vi.fn(async (_venueId: string, _input: unknown) => ({ id: 'c-panel' })),
  editarExcepcion: vi.fn(async (_input: unknown) => ({})),
  crearExcepcion: vi.fn(async (_input: unknown) => ({})),
  estadoDelPanel: null as null | CommissionSetupState,
  zona: 'America/Mexico_City' as string | undefined,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: m.zona ? { id: 'v1', timezone: m.zona } : null }),
}))
vi.mock('@/hooks/use-role-config', () => {
  const valor = { activeRoles: [{ role: 'WAITER' }], getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({
  // El panel refresca con `commissionKeys.all` al crear (y si falla después de crear el esquema).
  commissionKeys: { all: ['commissions'] },
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  useCreateCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useCreateOrgCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useEffectiveCommissionConfigs: () => ({ data: [] }),
  useCreateCommissionOverride: () => ({ mutateAsync: m.crearExcepcion, isPending: false }),
  useUpdateCommissionOverride: () => ({ mutateAsync: m.editarExcepcion, isPending: false }),
  useDeleteCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crearAlta, createTiersBatch: vi.fn(async () => []), createOverride: vi.fn(async () => ({})) },
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
vi.mock('../components/wizard/CommissionAdvancedConfig', () => ({ default: () => null }))
vi.mock('../components/setup-panel/useSetupReducer', async importOriginal => {
  const real = await importOriginal<typeof import('../components/setup-panel/useSetupReducer')>()
  return { ...real, initialState: () => (m.estadoDelPanel ? structuredClone(m.estadoDelPanel) : real.initialState()) }
})

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

// 8-oct-2026 a las 18:30 en México = 9-oct 00:30 UTC. El esquema se creó a las 18:32 (9-oct 00:32 UTC).
const NOCHE_EN_MEXICO = new Date('2026-10-09T00:30:00.000Z')
const CREADO_DE_NOCHE = '2026-10-09T00:32:00.000Z'

const CONFIG: CommissionConfig = {
  id: 'c1', venueId: 'v1', name: 'Base IVA 10%', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.1,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
  attendanceLatePenaltyRate: null, effectiveFrom: CREADO_DE_NOCHE, effectiveTo: null, aggregationPeriod: 'MONTHLY',
  active: true, createdAt: CREADO_DE_NOCHE, updatedAt: CREADO_DE_NOCHE,
} as CommissionConfig

const camposDeFecha = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'))
const enviado = (fn: { mock: { calls: unknown[][] } }, arg = 0) => fn.mock.calls[0]?.[arg] as Record<string, any> | undefined
const zonaOriginal = process.env.TZ

beforeEach(() => {
  vi.clearAllMocks()
  m.estadoDelPanel = null
  m.zona = 'America/Mexico_City'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOCHE_EN_MEXICO)
})
afterEach(() => {
  process.env.TZ = zonaOriginal
  vi.useRealTimers()
})

describe.each(['UTC', 'Europe/Madrid'])('navegador en %s, negocio en México, 18:30 hora de México', zonaDelNavegador => {
  beforeEach(() => {
    process.env.TZ = zonaDelNavegador
  })

  describe('«Editar configuración»', () => {
    it('🔴 «Vigente desde» de un esquema creado a las 18:32 dice 8 de octubre, no 9', () => {
      render(<EditConfigDialog open onOpenChange={() => {}} config={CONFIG} />, { wrapper: envolver })
      expect(camposDeFecha()[0].value).toBe('2026-10-08')
    })

    it('🔴 un día elegido se guarda como la medianoche de ese día EN MÉXICO, y «hasta» incluye el día entero', async () => {
      render(<EditConfigDialog open onOpenChange={() => {}} config={{ ...CONFIG, effectiveTo: '2026-11-01T05:59:59.999Z' }} />, {
        wrapper: envolver,
      })
      expect(camposDeFecha()[1].value).toBe('2026-10-31')
      fireEvent.change(camposDeFecha()[0], { target: { value: '2026-10-10' } })
      fireEvent.change(camposDeFecha()[1], { target: { value: '2026-11-30' } })
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await waitFor(() => expect(m.editar).toHaveBeenCalled())
      expect(enviado(m.editar)?.data).toMatchObject({
        effectiveFrom: '2026-10-10T06:00:00.000Z',
        effectiveTo: '2026-12-01T05:59:59.999Z',
      })
    })
  })

  describe('panel de la sucursal', () => {
    it('🔴 «desde» y «hasta» viajan como el inicio y el fin del día en México', async () => {
      const s = initialState()
      s.name.value = 'Noche'
      s.name.effectiveFrom = '2026-10-08'
      s.name.effectiveTo = '2026-10-31'
      m.estadoDelPanel = s
      render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('button', { name: 'setup.createButton' }))
      await waitFor(() => expect(m.crearAlta).toHaveBeenCalled())
      expect(enviado(m.crearAlta, 1)).toMatchObject({
        effectiveFrom: '2026-10-08T06:00:00.000Z',
        effectiveTo: '2026-11-01T05:59:59.999Z',
      })
    })
  })

  describe('asistente (organización)', () => {
    it('🔴 «vigente desde» por defecto es HOY en México (8-oct a las 00:00 de México), no mañana', async () => {
      const ref = createRef<WizardHandle>()
      render(<CreateCommissionWizard ref={ref} onSuccess={() => {}} isOrgLevel hideNavigation />, { wrapper: envolver })
      await act(async () => {
        await ref.current!.submit()
      })
      expect(enviado(m.crear)).toMatchObject({ effectiveFrom: '2026-10-08T06:00:00.000Z', effectiveTo: null })
    })
  })

  describe('excepción por persona', () => {
    const EXCEPCION = {
      id: 'o1', configId: 'c1', staffId: 's1', staff: { id: 's1', firstName: 'María', lastName: 'G' }, customRate: 0.05,
      excludeFromCommissions: false, notes: null, effectiveFrom: CREADO_DE_NOCHE, effectiveTo: '2026-11-01T05:59:59.999Z',
      active: true,
    } as unknown as CommissionOverride

    it('🔴 sus fechas se muestran y se guardan en el día de México', async () => {
      render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" override={EXCEPCION} calcType="PERCENTAGE" />, {
        wrapper: envolver,
      })
      expect(camposDeFecha().map(c => c.value)).toEqual(['2026-10-08', '2026-10-31'])
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await waitFor(() => expect(m.editarExcepcion).toHaveBeenCalled())
      expect(enviado(m.editarExcepcion)?.data).toMatchObject({
        effectiveFrom: '2026-10-08T06:00:00.000Z',
        effectiveTo: '2026-11-01T05:59:59.999Z',
      })
    })
  })

  describe('tarjeta del esquema', () => {
    it('🔴 «Vigente desde» dice 8 oct 2026', () => {
      render(<CommissionConfigCard config={CONFIG} />, { wrapper: envolver })
      expect(screen.getAllByText('8 oct 2026').length).toBeGreaterThan(0)
      expect(screen.queryByText('9 oct 2026')).toBeNull()
    })
  })
})

describe('la zona es la del NEGOCIO que se está viendo', () => {
  it('un negocio en Tijuana guarda su propia medianoche (07:00 UTC en octubre)', async () => {
    process.env.TZ = 'UTC'
    m.zona = 'America/Tijuana'
    render(<EditConfigDialog open onOpenChange={() => {}} config={CONFIG} />, { wrapper: envolver })
    fireEvent.change(camposDeFecha()[0], { target: { value: '2026-10-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(enviado(m.editar)?.data.effectiveFrom).toBe('2026-10-10T07:00:00.000Z')
  })
})
