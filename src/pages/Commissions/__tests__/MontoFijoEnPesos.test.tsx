// final-comisiones-viejas, D-FIJO: un monto fijo de comisión no se podía guardar. En un esquema FIXED, `CommissionConfig.defaultRate`
// guarda PESOS, pero la columna era Decimal(5,4) (tope $9.9999) y el servidor lo validaba como tasa (0-1): un fijo de $2 respondía
// 500 en la sucursal y uno de $10 desbordaba la columna en todas partes. El servidor pasa la columna a Decimal(12,4) y en un fijo
// exige 0 < monto ≤ 999,999.99, con 400 en texto humano. Aquí, las tres pantallas donde se escribe un monto fijo (panel de la
// sucursal, asistente de la organización y «Editar configuración»): aceptan pesos con centavos hasta $999,999.99, no dejan pasar
// ni $0 ni más del tope (lo dicen en el campo), y pintan el 400 del servidor tal cual.
import { createRef, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import CreateCommissionWizard, { type WizardHandle } from '../components/wizard/CreateCommissionWizard'
import EditConfigDialog from '../components/EditConfigDialog'
import RateCard from '../components/setup-panel/cards/RateCard'
import CommissionSetupPanel from '../components/setup-panel/CommissionSetupPanel'
import { initialState } from '../components/setup-panel/useSetupReducer'
import type { CommissionSetupState } from '../components/setup-panel/types'

const m = vi.hoisted(() => ({
  crear: vi.fn(async (_input: unknown) => ({ id: 'c-nuevo' })),
  editar: vi.fn(async (_input: unknown) => ({})),
  crearAlta: vi.fn(async (_venueId: string, _input: unknown) => ({ id: 'c-panel' })),
  toast: vi.fn((_t: unknown) => {}),
  estadoDelPanel: null as null | CommissionSetupState,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => {
  const valor = { activeRoles: [{ role: 'WAITER' }], getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({
  // El panel refresca con `commissionKeys.all` al crear (y si falla después de crear el esquema).
  commissionKeys: { all: ['commissions'] },
  useCreateCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useCreateOrgCommissionConfig: () => ({ mutateAsync: m.crear, isPending: false }),
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  useEffectiveCommissionConfigs: () => ({ data: [] }),
}))
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crearAlta, createTiersBatch: vi.fn(async () => []), createOverride: vi.fn(async () => ({})) },
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
vi.mock('../components/setup-panel/useSetupReducer', async importOriginal => {
  const real = await importOriginal<typeof import('../components/setup-panel/useSetupReducer')>()
  return { ...real, initialState: () => (m.estadoDelPanel ? structuredClone(m.estadoDelPanel) : real.initialState()) }
})

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const RANGO = 'wizard.step2.fixedAmountRange'
// El campo del monto es el número que lleva «$» al lado (en las tres pantallas).
const campoDelMonto = () => {
  const campo = screen.getAllByRole('spinbutton').find(el => el.parentElement?.textContent?.includes('$'))
  if (!campo) throw new Error('no encontré el campo del monto fijo')
  return campo
}
const teclear = (valor: string) => fireEvent.change(campoDelMonto(), { target: { value: valor } })
const errorDelServidor = (message: string) => Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data: { message } } })

beforeEach(() => {
  vi.clearAllMocks()
  m.estadoDelPanel = null
})

describe('Monto fijo en pesos (final-comisiones-viejas, D-FIJO)', () => {
  describe('asistente (organización)', () => {
    const montar = () => {
      const ref = createRef<WizardHandle>()
      render(<CreateCommissionWizard ref={ref} onSuccess={() => {}} isOrgLevel hideNavigation />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('button', { name: 'wizard.step2.fixedAmount' }))
      return ref
    }
    const guardar = async (ref: React.RefObject<WizardHandle | null>) => {
      await act(async () => {
        await ref.current!.submit()
      })
      return m.crear.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    }

    it('control: un fijo de $10 y uno de $999,999.99 se mandan tal cual, en pesos', async () => {
      let ref = montar()
      expect((await guardar(ref))?.defaultRate).toBe(10)
      document.body.innerHTML = ''
      vi.clearAllMocks()
      ref = montar()
      teclear('999999.99')
      fireEvent.blur(campoDelMonto())
      expect(screen.queryByText(RANGO)).toBeNull()
      expect(await guardar(ref)).toMatchObject({ calcType: 'FIXED', defaultRate: 999999.99 })
    })

    it('🔴 más de $999,999.99 no se acepta: lo dice en el campo y no viaja', async () => {
      const ref = montar()
      teclear('1000000')
      expect(screen.getByText(RANGO)).toBeInTheDocument()
      fireEvent.blur(campoDelMonto())
      expect(campoDelMonto()).toHaveValue(10)
      expect((await guardar(ref))?.defaultRate).toBe(10)
    })

    it('🔴 $0 no es un monto fijo: lo dice en el campo y no viaja', async () => {
      const ref = montar()
      teclear('0')
      expect(screen.getByText(RANGO)).toBeInTheDocument()
      fireEvent.blur(campoDelMonto())
      expect((await guardar(ref))?.defaultRate).toBe(10)
    })

    it('🔴 los pesos van con centavos: $2.555 se guarda como $2.56', async () => {
      const ref = montar()
      teclear('2.555')
      fireEvent.blur(campoDelMonto())
      expect(campoDelMonto()).toHaveValue(2.56)
      expect((await guardar(ref))?.defaultRate).toBe(2.56)
    })

    it('control: el 400 del servidor se pinta tal cual', async () => {
      m.crear.mockRejectedValueOnce(errorDelServidor('El monto fijo por venta puede ser de hasta $999,999.99.'))
      const ref = montar()
      await guardar(ref)
      expect(m.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'El monto fijo por venta puede ser de hasta $999,999.99.' }),
      )
    })
  })

  describe('«Editar configuración»', () => {
    const FIJO = {
      id: 'c1', venueId: 'v1', name: 'Fijo', priority: 1, recipient: 'SERVER', calcType: 'FIXED', defaultRate: 5, minAmount: null,
      maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null, filterByCategories: false,
      categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false, attendanceLatePenaltyRate: null,
      effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY', active: true,
      createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
    } as unknown as CommissionConfig
    const montar = () => render(<EditConfigDialog open onOpenChange={() => {}} config={FIJO} />, { wrapper: envolver })
    const guardar = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await waitFor(() => expect(m.editar).toHaveBeenCalled())
      return (m.editar.mock.calls[0][0] as { data: Record<string, unknown> }).data
    }
    /** Sin cambios no se manda nada (el monto de antes sigue guardado). */
    const guardarSinCambios = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await act(async () => {})
      return m.editar.mock.calls.length === 0
    }

    it('control: un fijo de $10 se guarda en pesos', async () => {
      montar()
      teclear('10')
      fireEvent.blur(campoDelMonto())
      // ft-graves B1: sólo viaja lo que cambió (el tipo sigue FIXED y no se manda).
      expect(await guardar()).toEqual({ defaultRate: 10 })
    })

    it('🔴 más de $999,999.99 no se acepta: lo dice en el campo y se queda el monto de antes', async () => {
      montar()
      teclear('1000000')
      expect(screen.getByText(RANGO)).toBeInTheDocument()
      fireEvent.blur(campoDelMonto())
      expect(campoDelMonto()).toHaveValue(5)
      // El monto de antes se queda: no hay nada que guardar (ft-graves B1, sólo lo que cambió).
      expect(await guardarSinCambios()).toBe(true)
    })

    it('🔴 $0 no es un monto fijo', async () => {
      montar()
      teclear('0')
      expect(screen.getByText(RANGO)).toBeInTheDocument()
      fireEvent.blur(campoDelMonto())
      expect(await guardarSinCambios()).toBe(true)
    })

    it('🔴 los pesos van con centavos: $12.345 se guarda como $12.35', async () => {
      montar()
      teclear('12.345')
      fireEvent.blur(campoDelMonto())
      expect((await guardar()).defaultRate).toBe(12.35)
    })

    it('control: el 400 del servidor se pinta tal cual', async () => {
      m.editar.mockRejectedValueOnce(errorDelServidor('El monto fijo por venta debe ser mayor que $0.'))
      montar()
      teclear('7')
      fireEvent.blur(campoDelMonto())
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      await waitFor(() =>
        expect(m.toast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive', description: 'El monto fijo por venta debe ser mayor que $0.' }),
        ),
      )
    })
  })

  describe('panel de la sucursal (tarjeta «Tasa de Comisión»)', () => {
    const conFijo = () => {
      const s = initialState()
      s.rate.calcType = 'FIXED'
      return s
    }
    const abrir = (dispatch: (a: unknown) => void) => {
      render(<RateCard state={conFijo()} dispatch={dispatch} />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('button', { name: /setup\.rate\.title/ }))
    }

    it('control: $250,000 se guarda en pesos', () => {
      const dispatch = vi.fn()
      abrir(dispatch)
      teclear('250000')
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_RATE', data: expect.objectContaining({ fixedAmount: 250000 }) })
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('🔴 más de $999,999.99 no se guarda: el diálogo sigue abierto y dice el rango', () => {
      const dispatch = vi.fn()
      abrir(dispatch)
      teclear('1000000')
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fixedAmount: 1000000 }) }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(RANGO)).toBeInTheDocument()
    })

    it('🔴 $0 no se guarda como monto fijo', () => {
      const dispatch = vi.fn()
      abrir(dispatch)
      teclear('0')
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
      expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fixedAmount: 0 }) }))
      expect(screen.getByText(RANGO)).toBeInTheDocument()
    })

    it('🔴 la tarjeta presenta el monto como pesos con formato, no «$250000»', () => {
      const s = conFijo()
      s.rate.fixedAmount = 250000
      render(<RateCard state={s} dispatch={() => {}} />, { wrapper: envolver })
      expect(screen.getByRole('button', { name: /\$250,000\.00/ })).toBeInTheDocument()
    })

    it('control: el panel manda un fijo de $10 como FIXED en pesos, y pinta el 400 del servidor tal cual', async () => {
      const s = conFijo()
      s.rate.fixedAmount = 10
      s.name.value = 'Fijo'
      m.estadoDelPanel = s
      m.crearAlta.mockRejectedValueOnce(errorDelServidor('El monto fijo por venta puede ser de hasta $999,999.99.'))
      render(<CommissionSetupPanel open onOpenChange={() => {}} />, { wrapper: envolver })
      fireEvent.click(screen.getByRole('button', { name: 'setup.createButton' }))
      await waitFor(() => expect(m.crearAlta).toHaveBeenCalled())
      expect(m.crearAlta.mock.calls[0][1]).toMatchObject({ calcType: 'FIXED', defaultRate: 10 })
      await waitFor(() =>
        expect(m.toast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive', description: 'El monto fijo por venta puede ser de hasta $999,999.99.' }),
        ),
      )
    })
  })
})
