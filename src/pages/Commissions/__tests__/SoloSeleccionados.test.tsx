// final-comisiones-viejas, D-ELEGIDOS: «Sólo seleccionados» en la tarjeta «Empleados» del panel decía «la comisión solo aplica a
// los empleados que agregues», pero el panel sólo creaba una excepción (CommissionOverride) por cada elegido y no excluía a nadie:
// el servidor le pagaba a TODO el equipo. El servidor gana `CommissionConfig.filterByStaff` + `staffIds` (como
// `filterByCategories` + `categoryIds`): con `filterByStaff = true` sólo cobra quien está en `staffIds`. Aquí:
// - el panel manda `filterByStaff: true` + `staffIds` con «Sólo seleccionados» (ya no crea excepciones para marcar a los elegidos;
//   sólo la de quien lleva tasa especial), y `filterByStaff: false` con «Todos»;
// - «Editar configuración» lee `filterByStaff`/`staffIds`, deja cambiarlos y los manda;
// - un servidor viejo (sus esquemas no traen `filterByStaff`) no finge restringir: la tarjeta y «Editar» dicen que no está
//   disponible, y si el panel crea un esquema que el servidor no restringió, lo quita y lo dice;
// - la ficha y la tarjeta del esquema dicen que sólo aplica a las personas elegidas.
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import StaffCard from '../components/setup-panel/cards/StaffCard'
import EditConfigDialog from '../components/EditConfigDialog'
import CommissionConfigCard from '../components/CommissionConfigCard'
import CommissionConfigDetailPage from '../CommissionConfigDetailPage'
import CreateOverrideDialog from '../components/CreateOverrideDialog'
import { initialState } from '../components/setup-panel/useSetupReducer'
import type { CommissionSetupState, StaffOverride } from '../components/setup-panel/types'

const m = vi.hoisted(() => ({
  crearAlta: vi.fn(async (_venueId: string, _input: unknown) => ({ id: 'c-panel' }) as Record<string, unknown>),
  borrarEsquema: vi.fn(async (_venueId: string, _configId: string) => ({ message: 'ok' })),
  crearExcepcion: vi.fn(async (_venueId: string, _configId: string, _input: unknown) => ({})),
  editar: vi.fn(async (_input: unknown) => ({})),
  toast: vi.fn((_t: unknown) => {}),
  efectivos: [] as Array<{ config: Record<string, unknown>; source: 'venue' | 'organization' }>,
  config: null as unknown,
  estadoDelPanel: null as null | CommissionSetupState,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => {
  const valor = { activeRoles: [{ role: 'WAITER' }, { role: 'CASHIER' }], getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  useEffectiveCommissionConfigs: () => ({ data: m.efectivos }),
  useCommissionConfig: () => ({ data: m.config, isLoading: false }),
  useCommissionTiers: () => ({ data: [], isLoading: false }),
  useCommissionOverrides: () => ({ data: [], isLoading: false }),
  useDeleteCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateCommissionOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCommissionOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/services/commission.service', () => ({
  commissionService: {
    createConfig: m.crearAlta,
    deleteConfig: m.borrarEsquema,
    createTiersBatch: vi.fn(async () => []),
    createOverride: m.crearExcepcion,
  },
}))
vi.mock('@/services/team.service', () => ({
  teamService: {
    getTeamMembers: vi.fn(async () => ({
      data: [
        { staffId: 's-ana', id: 's-ana', firstName: 'Ana', lastName: 'Ruiz', role: 'WAITER' },
        { staffId: 's-beto', id: 's-beto', firstName: 'Beto', lastName: 'Sol', role: 'CASHIER' },
      ],
    })),
  },
}))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/CommissionTierList', () => ({ default: () => null }))
vi.mock('../components/CommissionOverrideList', () => ({ default: () => null }))
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

// Un esquema como lo devuelve el servidor NUEVO (trae `filterByStaff`) y uno del servidor VIEJO (no lo trae).
const VIEJO = {
  id: 'c1', venueId: 'v1', name: 'Esquema', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
  attendanceLatePenaltyRate: null, effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
  active: true, createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
}
const NUEVO = { ...VIEJO, filterByStaff: false, staffIds: [] as string[] }

const ANA: StaffOverride = { staffId: 's-ana', staffName: 'Ana Ruiz', customRate: 0.05, excluded: false }
const BETO: StaffOverride = { staffId: 's-beto', staffName: 'Beto Sol', customRate: null, excluded: false }
const tarjeta = (titulo: RegExp) => screen.getByRole('button', { name: titulo })
// El servidor nuevo devuelve el esquema con lo que se le mandó (incluidos `filterByStaff` y `staffIds`).
const servidorNuevoDevuelveLoMandado = () =>
  m.crearAlta.mockImplementationOnce(async (_venueId: string, input: unknown) => ({ id: 'c-panel', ...(input as object) }))

beforeEach(() => {
  vi.clearAllMocks()
  m.efectivos = []
  m.config = null
  m.estadoDelPanel = null
})

describe('«Sólo seleccionados» restringe de verdad (final-comisiones-viejas, D-ELEGIDOS)', () => {
  describe('panel de la sucursal: lo que manda al crear', () => {
    const crear = async (calcType: 'FIXED' | 'PERCENTAGE', mode: 'all' | 'selected', overrides: StaffOverride[]) => {
      const s = initialState()
      s.rate.calcType = calcType
      s.name.value = 'Esquema'
      s.staff = { mode, overrides }
      m.estadoDelPanel = s
      render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('button', { name: 'setup.createButton' }))
      await waitFor(() => expect(m.toast).toHaveBeenCalled())
      return m.crearAlta.mock.calls[0]?.[1] as Record<string, unknown>
    }

    it('🔴 «Sólo seleccionados» manda filterByStaff + staffIds; sólo la tasa especial viaja como excepción', async () => {
      servidorNuevoDevuelveLoMandado()
      const enviado = await crear('PERCENTAGE', 'selected', [ANA, BETO])
      expect(enviado).toMatchObject({ filterByStaff: true, staffIds: ['s-ana', 's-beto'] })
      expect(m.crearExcepcion).toHaveBeenCalledTimes(1)
      expect(m.crearExcepcion.mock.calls[0][2]).toEqual({ staffId: 's-ana', customRate: 0.05, excludeFromCommissions: false })
      expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'success.configCreated' }))
      expect(m.borrarEsquema).not.toHaveBeenCalled()
    })

    it('🔴 en un fijo, «Sólo seleccionados» manda los elegidos y ninguna excepción', async () => {
      servidorNuevoDevuelveLoMandado()
      const enviado = await crear('FIXED', 'selected', [ANA, BETO])
      expect(enviado).toMatchObject({ calcType: 'FIXED', filterByStaff: true, staffIds: ['s-ana', 's-beto'] })
      expect(m.crearExcepcion).not.toHaveBeenCalled()
    })

    it('🔴 «Todos» manda filterByStaff: false sin elegidos, y las exclusiones siguen siendo excepciones', async () => {
      servidorNuevoDevuelveLoMandado()
      const enviado = await crear('PERCENTAGE', 'all', [{ ...BETO, excluded: true }])
      expect(enviado).toMatchObject({ filterByStaff: false, staffIds: [] })
      expect(m.crearExcepcion).toHaveBeenCalledTimes(1)
      expect(m.crearExcepcion.mock.calls[0][2]).toMatchObject({ staffId: 's-beto', excludeFromCommissions: true })
    })

    it('🔴 si el servidor no restringió el esquema (viejo), lo quita y lo dice: no deja un esquema que le paga a todos', async () => {
      // Sin esquemas que mirar, el panel no sabe si el servidor restringe; el esquema que devuelve no trae `filterByStaff`.
      await crear('PERCENTAGE', 'selected', [ANA, BETO])
      await waitFor(() => expect(m.borrarEsquema).toHaveBeenCalledWith('v1', 'c-panel'))
      expect(m.crearExcepcion).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(m.toast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive', description: 'setup.staff.restrictionNotApplied' }),
        ),
      )
      expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'success.configCreated' }))
      // Y desde ahí la tarjeta lo dice.
      fireEvent.click(tarjeta(/setup\.staff\.title/))
      expect(within(screen.getByRole('dialog')).getByText('setup.staff.restrictionUnavailable')).toBeInTheDocument()
    })

    it('🔴 con un servidor viejo (sus esquemas no traen filterByStaff), la tarjeta dice que no está disponible y no deja elegir', () => {
      m.efectivos = [{ config: VIEJO, source: 'venue' }]
      render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
      fireEvent.click(tarjeta(/setup\.staff\.title/))
      const dialogo = screen.getByRole('dialog')
      expect(within(dialogo).getByText('setup.staff.restrictionUnavailable')).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'setup.staff.switchToSelected' })).toBeDisabled()
    })

    it('control: con un servidor nuevo, la tarjeta deja elegir y no muestra el aviso', () => {
      m.efectivos = [{ config: NUEVO, source: 'venue' }]
      render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
      fireEvent.click(tarjeta(/setup\.staff\.title/))
      const dialogo = screen.getByRole('dialog')
      expect(within(dialogo).queryByText('setup.staff.restrictionUnavailable')).toBeNull()
      expect(within(dialogo).getByRole('button', { name: 'setup.staff.switchToSelected' })).toBeEnabled()
    })
  })

  it('🔴 la tarjeta «Empleados» en «Sólo seleccionados» de un fijo no dice «sólo puedes excluir» (ahí no hay excluir)', () => {
    const s = initialState()
    s.rate.calcType = 'FIXED'
    s.staff = { mode: 'selected', overrides: [ANA] }
    render(<StaffCard state={s} dispatch={() => {}} />, { wrapper: envolver })
    fireEvent.click(tarjeta(/setup\.staff\.title/))
    expect(within(screen.getByRole('dialog')).queryByText('setup.staff.onlyExcludeInFixed')).toBeNull()
  })

  describe('«Editar configuración»: lee y manda a quién aplica', () => {
    const montar = (config: Record<string, unknown>) =>
      render(<EditConfigDialog open onOpenChange={() => {}} config={config as unknown as CommissionConfig} />, { wrapper: envolver })
    const guardar = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await waitFor(() => expect(m.editar).toHaveBeenCalled())
      return (m.editar.mock.calls[0][0] as { data: Record<string, unknown> }).data
    }

    it('🔴 un esquema de personas elegidas se abre con ellas y se guarda igual', async () => {
      montar({ ...NUEVO, filterByStaff: true, staffIds: ['s-ana'] })
      expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'config.staffScope.chosen' })).toHaveAttribute('aria-pressed', 'true')
      expect(await guardar()).toMatchObject({ filterByStaff: true, staffIds: ['s-ana'] })
    })

    it('🔴 pasarlo a «Todo el equipo» manda filterByStaff: false y sin elegidos', async () => {
      montar({ ...NUEVO, filterByStaff: true, staffIds: ['s-ana'] })
      fireEvent.click(screen.getByRole('button', { name: 'config.staffScope.all' }))
      expect(await guardar()).toMatchObject({ filterByStaff: false, staffIds: [] })
    })

    it('🔴 de «Todo el equipo» a personas elegidas: agrega a Beto y lo manda', async () => {
      montar(NUEVO)
      fireEvent.click(screen.getByRole('button', { name: 'config.staffScope.chosen' }))
      fireEvent.click(await screen.findByRole('button', { name: /Beto Sol/ }))
      expect(await guardar()).toMatchObject({ filterByStaff: true, staffIds: ['s-beto'] })
    })

    it('🔴 sin nadie elegido no se puede guardar, y lo dice', async () => {
      montar({ ...NUEVO, filterByStaff: true, staffIds: ['s-ana'] })
      await screen.findByText('Ana Ruiz')
      fireEvent.click(screen.getByRole('button', { name: 'config.staffScope.remove' }))
      expect(screen.getByText('setup.staff.chooseAtLeastOne')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'actions.save' })).toBeDisabled()
    })

    it('🔴 con un servidor viejo dice que no está disponible y no manda filterByStaff', async () => {
      montar(VIEJO)
      expect(screen.getByText('setup.staff.restrictionUnavailable')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'config.staffScope.chosen' })).toBeNull()
      const data = await guardar()
      expect(data).not.toHaveProperty('filterByStaff')
      expect(data).not.toHaveProperty('staffIds')
    })
  })

  describe('la ficha y la tarjeta del esquema dicen a quién aplica', () => {
    const pintarFicha = () =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/venues/x/commissions/config/c1']}>
            <Routes>
              <Route path="/venues/x/commissions/config/:configId" element={<CommissionConfigDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )

    it('🔴 la ficha de un esquema de personas elegidas las nombra', async () => {
      m.config = { ...NUEVO, filterByStaff: true, staffIds: ['s-ana', 's-beto'] }
      pintarFicha()
      expect(screen.getByText('config.staffScope.chosenTitle')).toBeInTheDocument()
      expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
      expect(screen.getByText('Beto Sol')).toBeInTheDocument()
    })

    it('control: la ficha de un esquema para todo el equipo no muestra ese bloque', () => {
      m.config = NUEVO
      pintarFicha()
      expect(screen.queryByText('config.staffScope.chosenTitle')).toBeNull()
    })

    it('🔴 en un esquema de personas elegidas, una excepción nueva sólo se puede hacer a una de ellas', async () => {
      render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" calcType="PERCENTAGE" personasElegidas={['s-ana']} />, {
        wrapper: envolver,
      })
      fireEvent.click(screen.getByRole('combobox'))
      expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
      expect(screen.queryByText('Beto Sol')).toBeNull()
    })

    it('control: en un esquema para todo el equipo, la excepción ofrece a todos', async () => {
      render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" calcType="PERCENTAGE" />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('combobox'))
      expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
      expect(screen.getByText('Beto Sol')).toBeInTheDocument()
    })

    it('🔴 la tarjeta del esquema dice que sólo aplica a personas elegidas', () => {
      render(<CommissionConfigCard config={{ ...NUEVO, filterByStaff: true, staffIds: ['s-ana', 's-beto'] } as unknown as CommissionConfig} />, {
        wrapper: envolver,
      })
      expect(screen.getByText('config.staffScope.count')).toBeInTheDocument()
    })
  })
})
