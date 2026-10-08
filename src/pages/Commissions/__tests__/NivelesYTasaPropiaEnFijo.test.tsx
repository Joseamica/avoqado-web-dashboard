// final-fijo-niveles: con «Monto fijo» y «Comisión por Niveles» (o «meta como nivel») prendidos, el asistente y «Editar
// configuración» mandaban `calcType: 'TIERED'` con `defaultRate = fixedAmount`. El servidor multiplica la base por la tasa en TIERED
// (`commission-calculation.service.ts:177-180`) y, fuera de nivel o bajo la meta, la tasa es `defaultRate`
// (`commission-utils.ts:347-350`, `commission-tier.service.ts:647`, `:671`): un fijo de $5 se pagaba como una tasa de 500 %, y una
// venta de $116 con IVA (base $100 sin IVA) dejaba $500 de comisión (un fijo de $10 ni siquiera cabe: `defaultRate` es
// Decimal(5,4)). Los niveles del servidor son PORCENTAJES (`CommissionTier.rate`; no existe un monto fijo por nivel), así que en un
// fijo no se ofrecen ni se guardan. La tasa propia por persona tampoco tiene efecto en un fijo (FIXED ⇒ `defaultRate`,
// `commission-calculation.service.ts:177-180`): ahí sólo se ofrece y se guarda «excluir».
import { createRef, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig, CommissionOverride } from '@/types/commission'
import { calcTypeAGuardar, excepcionesAGuardar } from '../tasaDelEsquema'
import CommissionAdvancedConfig from '../components/wizard/CommissionAdvancedConfig'
import CreateCommissionWizard, { type WizardData, type WizardHandle } from '../components/wizard/CreateCommissionWizard'
import StepConfirm from '../components/wizard/StepConfirm'
import EditConfigDialog from '../components/EditConfigDialog'
import CreateOverrideDialog from '../components/CreateOverrideDialog'
import CommissionOverrideList from '../components/CommissionOverrideList'
import TiersCard from '../components/setup-panel/cards/TiersCard'
import StaffCard from '../components/setup-panel/cards/StaffCard'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import { initialState } from '../components/setup-panel/useSetupReducer'
import type { CommissionSetupState } from '../components/setup-panel/types'

const m = vi.hoisted(() => ({
  crear: vi.fn(async (_input: unknown) => ({ id: 'c-nuevo' })),
  editar: vi.fn(async (_input: unknown) => ({})),
  crearAlta: vi.fn(async (_venueId: string, _input: unknown) => ({ id: 'c-panel' })),
  crearNiveles: vi.fn(async (_venueId: string, _configId: string, _niveles: unknown) => []),
  crearExcepcion: vi.fn(async (_venueId: string, _configId: string, _input: unknown) => ({})),
  guardarExcepcion: vi.fn(async (_input: unknown) => ({})),
  estadoDelPanel: null as null | CommissionSetupState,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => {
  const activeRoles = [{ role: 'WAITER' }, { role: 'CASHIER' }, { role: 'MANAGER' }]
  const valor = { activeRoles, getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({
  useCreateCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useCreateOrgCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  useCreateCommissionOverride: () => ({ mutateAsync: m.guardarExcepcion, isPending: false }),
  useUpdateCommissionOverride: () => ({ mutateAsync: m.guardarExcepcion, isPending: false }),
  useDeleteCommissionOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crearAlta, createTiersBatch: m.crearNiveles, createOverride: m.crearExcepcion },
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
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
// El panel de configuración arranca con el estado que cada prueba le dé (sin eso habría que llenar nueve tarjetas a mano).
vi.mock('../components/setup-panel/useSetupReducer', async importOriginal => {
  const real = await importOriginal<typeof import('../components/setup-panel/useSetupReducer')>()
  return { ...real, initialState: () => (m.estadoDelPanel ? structuredClone(m.estadoDelPanel) : real.initialState()) }
})

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const DATOS = {
  recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03, fixedAmount: 10, includeTax: false, includeTips: false,
  includeDiscount: false, filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: 0.06,
  attendanceLinked: false, attendanceLatePenaltyRate: 0.25, tiersEnabled: true, tierPeriod: 'MONTHLY',
  tiers: [{ tierLevel: 1, name: 'Bronce', minThreshold: 0, maxThreshold: null, rate: 0.02 }],
  roleRatesEnabled: false, roleRates: {}, limitsEnabled: false, minAmount: null, maxAmount: null, overridesEnabled: true,
  overrides: [{ staffId: 's-ana', staffName: 'Ana Ruiz', customRate: 0.05, excludeFromCommissions: false }], name: 'Fijo',
  customValidityEnabled: false, effectiveFrom: '2026-10-01', effectiveTo: null, aggregationPeriod: 'MONTHLY', priority: 1,
} as WizardData

const bloque = (titulo: string) => screen.getByText(titulo).closest('.rounded-xl') as HTMLElement
const tarjeta = (titulo: RegExp) => screen.getByRole('button', { name: titulo })

beforeEach(() => {
  vi.clearAllMocks()
  m.estadoDelPanel = null
})

describe('Niveles y tasa propia en un esquema de monto fijo (final-fijo-niveles)', () => {
  it('🔴 un fijo se guarda FIXED aunque traiga niveles o meta como nivel; sólo un porcentaje se vuelve TIERED', () => {
    expect(calcTypeAGuardar('FIXED', true, false)).toBe('FIXED')
    expect(calcTypeAGuardar('FIXED', false, true)).toBe('FIXED')
    expect(calcTypeAGuardar('FIXED', false, false)).toBe('FIXED')
    expect(calcTypeAGuardar('PERCENTAGE', true, false)).toBe('TIERED')
    expect(calcTypeAGuardar('PERCENTAGE', false, true)).toBe('TIERED')
    expect(calcTypeAGuardar('PERCENTAGE', false, false)).toBe('PERCENTAGE')
  })

  it('🔴 en un fijo sólo se guardan las exclusiones, sin tasa propia; con porcentaje todo queda igual', () => {
    const excepciones = [
      { staffId: 'a', customRate: 0.05, excluir: false },
      { staffId: 'b', customRate: 0.04, excluir: true },
    ]
    expect(excepcionesAGuardar('FIXED', excepciones)).toEqual([{ staffId: 'b', customRate: null, excludeFromCommissions: true }])
    expect(excepcionesAGuardar('PERCENTAGE', excepciones)).toEqual([
      { staffId: 'a', customRate: 0.05, excludeFromCommissions: false },
      { staffId: 'b', customRate: 0.04, excludeFromCommissions: true },
    ])
  })

  describe('asistente (organización): lo que manda al guardar', () => {
    const montar = () => {
      const ref = createRef<WizardHandle>()
      render(<CreateCommissionWizard ref={ref} onSuccess={() => {}} isOrgLevel hideNavigation />, { wrapper: envolver })
      return ref
    }
    const abrirAvanzado = () => fireEvent.click(screen.getByText('wizard.step2.advanced'))
    const agregarExcepcion = async (nombre: string) => {
      const boton = screen.getByRole('button', { name: /wizard\.advanced\.overrides\.addStaff/ })
      await waitFor(() => expect(boton).toBeEnabled())
      fireEvent.click(boton)
      fireEvent.click(await screen.findByRole('button', { name: new RegExp(nombre) }))
    }
    const elegirFijo = () => fireEvent.click(screen.getByRole('button', { name: 'wizard.step2.fixedAmount' }))

    it('🔴 niveles prendidos y luego «Monto fijo»: guarda FIXED con el monto, sin TIERED y sin crear niveles', async () => {
      const ref = montar()
      abrirAvanzado()
      fireEvent.click(within(bloque('wizard.advanced.tiers.title')).getByRole('switch'))
      elegirFijo()
      await act(async () => {
        await ref.current!.submit()
      })
      expect(m.crear).toHaveBeenCalledTimes(1)
      expect(m.crear.mock.calls[0][0]).toMatchObject({ calcType: 'FIXED', defaultRate: 10 })
      expect(m.crearNiveles).not.toHaveBeenCalled()
    })

    it('🔴 meta como nivel prendida y luego «Monto fijo»: guarda FIXED sin meta como nivel', async () => {
      const ref = montar()
      fireEvent.click(within(bloque('wizard.step2.goalTier')).getByRole('switch'))
      elegirFijo()
      await act(async () => {
        await ref.current!.submit()
      })
      expect(m.crear.mock.calls[0][0]).toMatchObject({ calcType: 'FIXED', defaultRate: 10, useGoalAsTier: false, goalBonusRate: null })
    })

    it('control: con porcentaje, los niveles siguen guardando TIERED con su tasa y creando los niveles', async () => {
      const ref = montar()
      abrirAvanzado()
      fireEvent.click(within(bloque('wizard.advanced.tiers.title')).getByRole('switch'))
      await act(async () => {
        await ref.current!.submit()
      })
      expect(m.crear.mock.calls[0][0]).toMatchObject({ calcType: 'TIERED', defaultRate: 0.03 })
      expect(m.crearNiveles).toHaveBeenCalledTimes(1)
    })

    it('🔴 excepciones en un fijo: la tasa propia no viaja y la excepción que no excluye no se manda', async () => {
      const ref = montar()
      abrirAvanzado()
      fireEvent.click(within(bloque('wizard.advanced.overrides.title')).getByRole('switch'))
      await agregarExcepcion('Ana Ruiz')
      await agregarExcepcion('Beto Sol')
      // Beto queda excluido; Ana se queda con su tasa propia de porcentaje.
      const deBeto = screen.getByText('Beto Sol').closest('.relative') as HTMLElement
      fireEvent.click(within(deBeto).getByRole('switch'))
      elegirFijo()
      await act(async () => {
        await ref.current!.submit()
      })
      expect(m.crearExcepcion).toHaveBeenCalledTimes(1)
      expect(m.crearExcepcion.mock.calls[0][2]).toEqual({ staffId: 's-beto', customRate: null, excludeFromCommissions: true })
    })
  })

  describe('«Editar configuración»: lo que manda al guardar', () => {
    const base = {
      id: 'c1', venueId: 'v1', name: 'Esquema', priority: 1, recipient: 'SERVER', defaultRate: 0.03, minAmount: null,
      maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null, filterByCategories: false,
      categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false, attendanceLatePenaltyRate: null,
      effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY', active: true,
      createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
    }
    const guardar = async (config: Record<string, unknown>, aFijo: boolean) => {
      render(<EditConfigDialog open onOpenChange={() => {}} config={config as unknown as CommissionConfig} />, { wrapper: envolver })
      if (aFijo) fireEvent.click(screen.getByRole('button', { name: 'wizard.step2.fixedAmount' }))
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await waitFor(() => expect(m.editar).toHaveBeenCalled())
      return (m.editar.mock.calls[0][0] as { data: Record<string, unknown> }).data
    }
    const NIVELES = [{ tierLevel: 1, tierName: 'Bronce', minThreshold: 0, maxThreshold: null, rate: 0.02, tierPeriod: 'MONTHLY' }]

    it('🔴 un esquema por niveles que pasa a «Monto fijo» se guarda FIXED con el monto, nunca TIERED', async () => {
      const data = await guardar({ ...base, calcType: 'TIERED', tiers: NIVELES }, true)
      expect(data).toMatchObject({ calcType: 'FIXED', defaultRate: 10 })
    })

    it('🔴 un porcentaje con meta como nivel que pasa a «Monto fijo» se guarda FIXED y sin meta como nivel', async () => {
      const data = await guardar({ ...base, calcType: 'TIERED', useGoalAsTier: true, goalBonusRate: 0.06 }, true)
      expect(data).toMatchObject({ calcType: 'FIXED', defaultRate: 10, useGoalAsTier: false, goalBonusRate: null })
    })

    it('control: un esquema por niveles que se queda en porcentaje sigue TIERED', async () => {
      const data = await guardar({ ...base, calcType: 'TIERED', tiers: NIVELES }, false)
      expect(data).toMatchObject({ calcType: 'TIERED', defaultRate: 0.03 })
    })
  })

  describe('panel de configuración (sucursal): lo que manda al crear', () => {
    const estado = (calcType: 'FIXED' | 'PERCENTAGE') => {
      const s = initialState()
      s.rate.calcType = calcType
      s.name.value = 'Esquema'
      s.tiers.enabled = true
      s.staff.overrides = [
        { staffId: 's-ana', staffName: 'Ana Ruiz', customRate: 0.05, excluded: false },
        { staffId: 's-beto', staffName: 'Beto Sol', customRate: null, excluded: true },
      ]
      return s
    }
    const crear = async (calcType: 'FIXED' | 'PERCENTAGE') => {
      m.estadoDelPanel = estado(calcType)
      render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('button', { name: 'setup.createButton' }))
      await waitFor(() => expect(m.crearAlta).toHaveBeenCalled())
      await waitFor(() => expect(m.crearExcepcion).toHaveBeenCalled())
    }

    it('🔴 en un fijo no crea niveles ni manda la tasa propia; sólo la exclusión', async () => {
      await crear('FIXED')
      expect(m.crearAlta.mock.calls[0][1]).toMatchObject({ calcType: 'FIXED', defaultRate: 50 })
      expect(m.crearNiveles).not.toHaveBeenCalled()
      expect(m.crearExcepcion).toHaveBeenCalledTimes(1)
      expect(m.crearExcepcion.mock.calls[0][2]).toEqual({ staffId: 's-beto', customRate: null, excludeFromCommissions: true })
    })

    it('control: con porcentaje manda los niveles y las dos excepciones como antes', async () => {
      await crear('PERCENTAGE')
      expect(m.crearAlta.mock.calls[0][1]).toMatchObject({ calcType: 'PERCENTAGE', defaultRate: 0.03 })
      expect(m.crearNiveles).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(m.crearExcepcion).toHaveBeenCalledTimes(2))
      expect(m.crearExcepcion.mock.calls[0][2]).toEqual({ staffId: 's-ana', customRate: 0.05, excludeFromCommissions: false })
    })
  })

  describe('lo que se OFRECE en un fijo', () => {
    it('🔴 la configuración avanzada del asistente no ofrece niveles en un fijo, y dice por qué', () => {
      const { rerender } = render(
        <CommissionAdvancedConfig data={{ ...DATOS, calcType: 'FIXED' }} updateData={() => {}} isOpen onOpenChange={() => {}} />,
        { wrapper: envolver },
      )
      expect(within(bloque('wizard.advanced.tiers.title')).queryByRole('switch')).toBeNull()
      expect(within(bloque('wizard.advanced.tiers.title')).getByText('wizard.advanced.tiers.onlyPercentage')).toBeInTheDocument()
      expect(screen.queryByText('wizard.advanced.tiers.period:')).toBeNull()
      rerender(<CommissionAdvancedConfig data={DATOS} updateData={() => {}} isOpen onOpenChange={() => {}} />)
      expect(within(bloque('wizard.advanced.tiers.title')).getByRole('switch')).toBeChecked()
      expect(screen.queryByText('wizard.advanced.tiers.onlyPercentage')).toBeNull()
    })

    it('🔴 «Editar» de un fijo tampoco dice que los niveles se manejan aparte: dice que sólo aplican con porcentaje', () => {
      render(
        <CommissionAdvancedConfig data={{ ...DATOS, calcType: 'FIXED' }} updateData={() => {}} isOpen onOpenChange={() => {}} mode="edit" />,
        { wrapper: envolver },
      )
      expect(screen.queryByText('config.tiersManagedSeparately')).toBeNull()
      expect(screen.getByText('wizard.advanced.tiers.onlyPercentage')).toBeInTheDocument()
    })

    it('🔴 las excepciones del asistente en un fijo no ofrecen tasa propia, y dicen por qué', () => {
      const { rerender } = render(
        <CommissionAdvancedConfig data={{ ...DATOS, calcType: 'FIXED' }} updateData={() => {}} isOpen onOpenChange={() => {}} />,
        { wrapper: envolver },
      )
      expect(screen.queryByText('wizard.advanced.overrides.customRate')).toBeNull()
      expect(screen.getByText('wizard.advanced.overrides.onlyExcludeInFixed')).toBeInTheDocument()
      rerender(<CommissionAdvancedConfig data={DATOS} updateData={() => {}} isOpen onOpenChange={() => {}} />)
      expect(screen.getByText('wizard.advanced.overrides.customRate')).toBeInTheDocument()
      expect(screen.queryByText('wizard.advanced.overrides.onlyExcludeInFixed')).toBeNull()
    })

    it('🔴 en un fijo, agregar a alguien a las excepciones del asistente lo agrega excluido', async () => {
      const updateData = vi.fn()
      render(
        <CommissionAdvancedConfig
          data={{ ...DATOS, calcType: 'FIXED', overrides: [] }}
          updateData={updateData}
          isOpen
          onOpenChange={() => {}}
        />,
        { wrapper: envolver },
      )
      const boton = screen.getByRole('button', { name: /wizard\.advanced\.overrides\.addStaff/ })
      await waitFor(() => expect(boton).toBeEnabled())
      fireEvent.click(boton)
      fireEvent.click(await screen.findByRole('button', { name: /Ana Ruiz/ }))
      expect(updateData).toHaveBeenCalledWith({
        overrides: [{ staffId: 's-ana', staffName: 'Ana Ruiz', customRate: null, excludeFromCommissions: true }],
      })
    })

    it('🔴 el resumen del asistente no presenta niveles en un fijo', () => {
      const props = { updateData: () => {}, onPrevious: () => {}, onSubmit: () => {}, isSubmitting: false, hideNavigation: true }
      const { rerender } = render(<StepConfirm data={{ ...DATOS, calcType: 'FIXED' }} {...props} />)
      expect(screen.queryByText('wizard.step3.tiers')).toBeNull()
      expect(screen.queryByText('wizard.step3.typeTiered')).toBeNull()
      expect(screen.getByText(/wizard\.step3\.perSaleFixed/)).toBeInTheDocument()
      rerender(<StepConfirm data={DATOS} {...props} />)
      expect(screen.getByText('wizard.step3.tiers')).toBeInTheDocument()
    })

    it('🔴 la tarjeta «Comisión por Niveles» del panel se ve apagada en un fijo, explica por qué y no abre', () => {
      const fijo = initialState()
      fijo.rate.calcType = 'FIXED'
      const { unmount } = render(<TiersCard state={fijo} dispatch={() => {}} />)
      expect(tarjeta(/setup\.tiers\.title/)).toBeDisabled()
      expect(within(tarjeta(/setup\.tiers\.title/)).getByText('setup.tiers.onlyPercentage')).toBeInTheDocument()
      unmount()
      render(<TiersCard state={initialState()} dispatch={() => {}} />)
      expect(tarjeta(/setup\.tiers\.title/)).toBeEnabled()
    })

    it('🔴 la tarjeta «Empleados» del panel no ofrece tasa propia en un fijo, y dice por qué', () => {
      const s = initialState()
      s.staff.overrides = [{ staffId: 's-ana', staffName: 'Ana Ruiz', customRate: 0.05, excluded: false }]
      const fijo = { ...s, rate: { ...s.rate, calcType: 'FIXED' as const } }
      const { unmount } = render(<StaffCard state={fijo} dispatch={() => {}} />, { wrapper: envolver })
      fireEvent.click(tarjeta(/setup\.staff\.title/))
      const dialogo = screen.getByRole('dialog')
      expect(within(dialogo).queryByRole('spinbutton')).toBeNull()
      expect(within(dialogo).getByText('setup.staff.onlyExcludeInFixed')).toBeInTheDocument()
      unmount()
      render(<StaffCard state={s} dispatch={() => {}} />, { wrapper: envolver })
      fireEvent.click(tarjeta(/setup\.staff\.title/))
      expect(within(screen.getByRole('dialog')).getByRole('spinbutton')).toBeInTheDocument()
    })

    describe('excepción de la ficha del esquema (CreateOverrideDialog)', () => {
      const EXCEPCION = {
        id: 'o1', configId: 'c1', staffId: 's-ana', staff: { firstName: 'Ana', lastName: 'Ruiz' }, customRate: 0.05,
        excludeFromCommissions: true, notes: null, effectiveFrom: null, effectiveTo: null, active: true,
      } as unknown as CommissionOverride

      it('🔴 en un fijo no ofrece tasa propia y guarda la exclusión sin tasa', async () => {
        render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" override={EXCEPCION} calcType="FIXED" />, {
          wrapper: envolver,
        })
        expect(screen.queryByText('overrides.customRate')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
        await waitFor(() => expect(m.guardarExcepcion).toHaveBeenCalled())
        expect(m.guardarExcepcion.mock.calls[0][0]).toMatchObject({ overrideId: 'o1', data: { customRate: null, excludeFromCommissions: true } })
      })

      it('🔴 en un fijo, una excepción que no excluye no se puede guardar y dice por qué', () => {
        render(
          <CreateOverrideDialog
            open
            onOpenChange={() => {}}
            configId="c1"
            override={{ ...EXCEPCION, excludeFromCommissions: false }}
            calcType="FIXED"
          />,
          { wrapper: envolver },
        )
        expect(screen.queryByText('overrides.customRate')).toBeNull()
        expect(screen.getByText('overrides.onlyExcludeInFixed')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'actions.save' })).toBeDisabled()
      })

      it('🔴 en un fijo, una excepción NUEVA arranca excluida (lo único que cuenta) y se puede crear; con porcentaje no', () => {
        const { unmount } = render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" calcType="FIXED" />, {
          wrapper: envolver,
        })
        expect(screen.getByRole('switch', { name: 'overrides.excludeFromCommissions' })).toBeChecked()
        expect(screen.getByRole('button', { name: 'actions.create' })).toBeEnabled()
        unmount()
        render(<CreateOverrideDialog open onOpenChange={() => {}} configId="c1" calcType="PERCENTAGE" />, { wrapper: envolver })
        expect(screen.getByRole('switch', { name: 'overrides.excludeFromCommissions' })).not.toBeChecked()
      })

      it('🔴 la lista de excepciones de un fijo no presenta una tasa propia que no se paga; con porcentaje sí', () => {
        const conTasa = { ...EXCEPCION, excludeFromCommissions: false }
        const { unmount } = render(<CommissionOverrideList configId="c1" calcType="FIXED" overrides={[conTasa]} isLoading={false} />, {
          wrapper: envolver,
        })
        expect(screen.getByText(/Ana/)).toBeInTheDocument()
        expect(screen.queryByText(/overrides\.customRate/)).toBeNull()
        unmount()
        render(<CommissionOverrideList configId="c1" calcType="PERCENTAGE" overrides={[conTasa]} isLoading={false} />, {
          wrapper: envolver,
        })
        expect(screen.getByText(/overrides\.customRate/)).toHaveTextContent('5.00%')
      })

      it('control: con porcentaje sigue ofreciendo la tasa propia y la guarda', async () => {
        render(
          <CreateOverrideDialog
            open
            onOpenChange={() => {}}
            configId="c1"
            override={{ ...EXCEPCION, excludeFromCommissions: false }}
            calcType="PERCENTAGE"
          />,
          { wrapper: envolver },
        )
        expect(screen.getByText('overrides.customRate')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
        await waitFor(() => expect(m.guardarExcepcion).toHaveBeenCalled())
        expect(m.guardarExcepcion.mock.calls[0][0]).toMatchObject({ data: { customRate: 0.05, excludeFromCommissions: false } })
      })
    })
  })
})
