// ft-graves, B1 · «Duplicar con cambios» (founder, opción A): un esquema que ya calculó comisiones no cambia de tasa; se REEMPLAZA.
// El nuevo copia todo lo demás con la tasa nueva y el original se desactiva. Nunca pagan los dos: si crear el nuevo falla, el
// original sigue igual; si desactivar el original falla, se dice con todas sus letras y se puede reintentar sin crear otro.
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import EditConfigDialog from '../components/EditConfigDialog'
import { olvidarPendientes } from '../envioUnico'

const m = vi.hoisted(() => ({
  editar: vi.fn(async (_input: unknown) => ({})),
  crear: vi.fn(async (_venueId: string, _input: unknown, _clave?: string) => ({ id: 'c-nuevo', name: 'x' })),
  crearNiveles: vi.fn(async (..._a: unknown[]) => []),
  crearExcepcion: vi.fn(async (..._a: unknown[]) => ({})),
  toast: vi.fn((_t: unknown) => {}),
  orden: [] as string[],
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: { id: 'v1', timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ activeRoles: [], getDisplayName: (r: string) => r }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  commissionKeys: { all: ['commissions'] },
}))
vi.mock('@/services/commission.service', () => ({
  commissionService: { createConfig: m.crear, createTiersBatch: m.crearNiveles, createOverride: m.crearExcepcion },
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
vi.mock('../components/wizard/CommissionAdvancedConfig', () => ({ default: () => null }))

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

const ORIGINAL: CommissionConfig = {
  id: 'c1', venueId: 'v1', name: 'Bebidas 10%', priority: 2, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.1,
  minAmount: null, maxAmount: 500, includeTips: false, includeDiscount: true, includeTax: true, roleRates: null,
  filterByCategories: true, categoryIds: ['bebidas'], filterByStaff: true, staffIds: ['maria'], useGoalAsTier: false,
  goalBonusRate: null, attendanceLinked: false, attendanceLatePenaltyRate: null, effectiveFrom: '2026-10-01T06:00:00.000Z',
  effectiveTo: null, aggregationPeriod: 'MONTHLY', active: true, createdAt: '', updatedAt: '', tiers: [],
  overrides: [
    { id: 'o1', staffId: 'carlos', customRate: 0, excludeFromCommissions: true, active: true, effectiveTo: null } as never,
  ],
  _count: { tiers: 0, overrides: 1, calculations: 3 },
} as CommissionConfig

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const conEstado = (status: number, message = 'x') => Object.assign(new Error(String(status)), { response: { status, data: { message } } })

const abrirDuplicar = async (onOpenChange = vi.fn()) => {
  render(<EditConfigDialog open onOpenChange={onOpenChange} config={ORIGINAL} />, { wrapper: envolver })
  fireEvent.click(screen.getByRole('button', { name: 'config.duplicateWithChanges' }))
  const tasa = await screen.findByLabelText('config.replace.rate')
  fireEvent.change(tasa, { target: { value: '12' } })
  return onOpenChange
}
const reemplazar = () => screen.getByRole('button', { name: 'config.replace.confirmButton' })

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  m.orden = []
  m.crear.mockImplementation(async () => {
    m.orden.push('crear')
    return { id: 'c-nuevo', name: 'Bebidas 10%' }
  })
  m.editar.mockImplementation(async (input: unknown) => {
    m.orden.push(`editar:${JSON.stringify(input)}`)
    return {}
  })
})

describe('«Duplicar con cambios» reemplaza al original (opción A)', () => {
  it('🔴 la confirmación dice que el nuevo reemplaza al anterior desde hoy, con las dos tasas', async () => {
    await abrirDuplicar()
    const texto = screen.getByText(/config\.replace\.confirm /).textContent!
    expect(texto).toContain('"anterior":"Bebidas 10%"')
    expect(texto).toContain('"tasaAnterior":"10.00%"')
    expect(texto).toContain('"tasaNueva":"12.00%"')
  })

  it('🔴 crea el nuevo (con clave, copiando todo lo demás y las excepciones) y DESPUÉS desactiva el original', async () => {
    await abrirDuplicar()
    fireEvent.click(reemplazar())
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    const [venueId, cuerpo, clave] = m.crear.mock.calls[0]
    expect(venueId).toBe('v1')
    expect(clave).toMatch(UUID)
    expect(cuerpo).toMatchObject({
      calcType: 'PERCENTAGE', defaultRate: 0.12, recipient: 'SERVER', includeTax: true, includeDiscount: true, maxAmount: 500,
      filterByCategories: true, categoryIds: ['bebidas'], filterByStaff: true, staffIds: ['maria'], priority: 2,
    })
    expect(m.crearExcepcion.mock.calls[0][2]).toMatchObject({ staffId: 'carlos', excludeFromCommissions: true })
    expect(m.crearExcepcion.mock.calls[0][3]).toMatch(UUID)
    expect(m.orden).toEqual(['crear', `editar:${JSON.stringify({ configId: 'c1', data: { active: false } })}`])
  })

  it('🔴 si crear el nuevo falla, el original NO se desactiva y se dice por qué', async () => {
    m.crear.mockRejectedValueOnce(conEstado(400, 'La tasa de comisión va de 0 % a 100 %.'))
    await abrirDuplicar()
    fireEvent.click(reemplazar())
    await waitFor(() => expect(screen.getByText('La tasa de comisión va de 0 % a 100 %.')).toBeInTheDocument())
    expect(m.editar).not.toHaveBeenCalled()
  })

  it('🔴 si desactivar el original falla, lo dice sin esconderlo y el reintento sólo desactiva (no crea otro)', async () => {
    m.editar.mockRejectedValueOnce(conEstado(500))
    await abrirDuplicar()
    fireEvent.click(reemplazar())
    expect(await screen.findByText(/config\.replace\.originalStillActive /)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /config\.replace\.retryDeactivate/ }))
    await waitFor(() => expect(m.editar).toHaveBeenCalledTimes(2))
    expect(m.crear).toHaveBeenCalledTimes(1)
    expect(m.editar.mock.calls[1][0]).toEqual({ configId: 'c1', data: { active: false } })
  })

  it('🔴 dos clics en el mismo instante crean UN reemplazo', async () => {
    await abrirDuplicar()
    const boton = reemplazar()
    await act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(m.editar).toHaveBeenCalled())
    expect(m.crear).toHaveBeenCalledTimes(1)
  })

  it('una tasa fuera de rango no deja reemplazar y dice el rango', async () => {
    await abrirDuplicar()
    fireEvent.change(screen.getByLabelText('config.replace.rate'), { target: { value: '150' } })
    expect(reemplazar()).toBeDisabled()
    expect(screen.getByText('config.replace.rateRange')).toBeInTheDocument()
  })
})
