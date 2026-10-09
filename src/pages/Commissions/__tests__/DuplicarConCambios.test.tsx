// ft-graves, B1 · «Duplicar con cambios» (founder, opción A): un esquema que ya calculó comisiones no cambia de tasa; se REEMPLAZA.
// El servidor lo hace en UNA transacción (`POST /configs/:id/copy` con `replace: true`): crea el nuevo con la tasa nueva (copia lo
// demás, niveles y excepciones) y desactiva el original. Nunca pagan los dos y nunca queda nada a medias: el dashboard manda UNA
// llamada, con `Idempotency-Key`, y ya no desactiva por su cuenta.
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
  crear: vi.fn(async (..._a: unknown[]) => ({ id: 'c-mal' })),
  reemplazar: vi.fn(async (_venueId: string, _configId: string, _cuerpo: unknown, _clave?: string) => ({
    id: 'c-nuevo',
    reemplazado: { id: 'c1', active: false },
  })),
  toast: vi.fn((_t: unknown) => {}),
  cliente: null as null | QueryClient,
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
  commissionService: { replaceConfig: m.reemplazar, createConfig: m.crear, createTiersBatch: m.crear, createOverride: m.crear },
}))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))
vi.mock('../components/wizard/CommissionAdvancedConfig', () => ({ default: () => null }))

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={m.cliente!}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

const ORIGINAL: CommissionConfig = {
  id: 'c1', venueId: 'v1', name: 'Bebidas 10%', priority: 2, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.1,
  minAmount: null, maxAmount: 500, includeTips: false, includeDiscount: true, includeTax: true, roleRates: { WAITER: 0.05 },
  filterByCategories: true, categoryIds: ['bebidas'], filterByStaff: true, staffIds: ['maria'], useGoalAsTier: false,
  goalBonusRate: null, attendanceLinked: false, attendanceLatePenaltyRate: null, effectiveFrom: '2026-10-01T06:00:00.000Z',
  effectiveTo: null, aggregationPeriod: 'MONTHLY', active: true, createdAt: '', updatedAt: '', tiers: [], overrides: [],
  _count: { tiers: 0, overrides: 0, calculations: 3 },
} as CommissionConfig

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const conError = (status: number, data: Record<string, unknown>) => Object.assign(new Error(String(status)), { response: { status, data } })

const abrirDuplicar = async (original: CommissionConfig = ORIGINAL, onOpenChange = vi.fn()) => {
  render(<EditConfigDialog open onOpenChange={onOpenChange} config={original} />, { wrapper: envolver })
  fireEvent.click(screen.getByRole('button', { name: 'config.duplicateWithChanges' }))
  fireEvent.change(await screen.findByLabelText('config.replace.rate'), { target: { value: '12' } })
  return onOpenChange
}
const reemplazar = () => screen.getByRole('button', { name: 'config.replace.confirmButton' })
const confirmacion = () => screen.getByText(/config\.replace\.confirm /).textContent!

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  m.cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})

describe('«Duplicar con cambios» reemplaza en UNA llamada atómica (opción A)', () => {
  it('🔴 manda UNA llamada `replace: true` con la tasa nueva y su clave; no crea ni desactiva por su cuenta', async () => {
    const cerrar = await abrirDuplicar()
    fireEvent.click(reemplazar())
    await waitFor(() => expect(m.reemplazar).toHaveBeenCalledTimes(1))
    const [venueId, configId, cuerpo, clave] = m.reemplazar.mock.calls[0]
    expect([venueId, configId]).toEqual(['v1', 'c1'])
    expect(clave).toMatch(UUID)
    // `replace: true` lo pone el servicio (ver commission.service.clave.test): aquí, los cambios.
    expect(cuerpo).toEqual({ name: 'Bebidas 10%', calcType: 'PERCENTAGE', defaultRate: 0.12, effectiveTo: null })
    // «Desde hoy»: sin fecha de inicio (el servidor pone «ahora»); lo demás lo copia el servidor del original.
    expect(cuerpo).not.toHaveProperty('effectiveFrom')
    expect(m.crear).not.toHaveBeenCalled()
    expect(m.editar).not.toHaveBeenCalled()
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false))
  })

  it('🔴 la confirmación dice que reemplaza al anterior desde hoy, con las dos tasas', async () => {
    await abrirDuplicar()
    expect(confirmacion()).toContain('"anterior":"Bebidas 10%"')
    expect(confirmacion()).toContain('"tasaAnterior":"10.00%"')
    expect(confirmacion()).toContain('"tasaNueva":"12.00%"')
  })

  it('🔴 si el nuevo es por niveles, avisa que el avance de la meta de cada persona arranca de cero', async () => {
    await abrirDuplicar({ ...ORIGINAL, calcType: 'TIERED' })
    expect(screen.getByText('config.replace.tieredResetHint')).toBeInTheDocument()
  })

  it('pasar a monto fijo limpia lo que en un fijo no aplica (tasas por rol, meta como nivel)', async () => {
    render(<EditConfigDialog open onOpenChange={vi.fn()} config={ORIGINAL} />, { wrapper: envolver })
    fireEvent.click(screen.getByRole('button', { name: 'config.duplicateWithChanges' }))
    fireEvent.click(await screen.findByRole('button', { name: 'wizard.step2.fixedAmount', pressed: false }))
    fireEvent.change(screen.getByLabelText('config.replace.rate'), { target: { value: '15' } })
    fireEvent.click(reemplazar())
    await waitFor(() => expect(m.reemplazar).toHaveBeenCalled())
    expect(m.reemplazar.mock.calls[0][2]).toMatchObject({ calcType: 'FIXED', defaultRate: 15, roleRates: null, useGoalAsTier: false })
  })

  it('🔴 409 ESQUEMA_YA_INACTIVO: recarga los esquemas, avisa y no vuelve a llamar', async () => {
    const recargar = vi.spyOn(m.cliente!, 'invalidateQueries')
    m.reemplazar.mockRejectedValueOnce(conError(409, { code: 'ESQUEMA_YA_INACTIVO', message: 'Ya está inactivo' }))
    const cerrar = await abrirDuplicar()
    fireEvent.click(reemplazar())
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('config.replace.alreadyInactive') })),
    )
    expect(recargar).toHaveBeenCalledWith({ queryKey: ['commissions'] })
    expect(cerrar).toHaveBeenCalledWith(false)
    expect(m.reemplazar).toHaveBeenCalledTimes(1)
    expect(m.editar).not.toHaveBeenCalled()
  })

  it('🔴 un 400 se dice tal cual y avisa que el original sigue igual; nada se desactiva', async () => {
    m.reemplazar.mockRejectedValueOnce(conError(400, { message: 'La tasa de comisión va de 0 % a 100 %.' }))
    await abrirDuplicar()
    fireEvent.click(reemplazar())
    expect(await screen.findByText('La tasa de comisión va de 0 % a 100 %.')).toBeInTheDocument()
    expect(screen.getByText(/config\.replace\.createError/)).toBeInTheDocument()
    expect(m.editar).not.toHaveBeenCalled()
  })

  it('🔴 sin respuesta: lo dice, y el reintento manda la MISMA clave (el servidor devuelve el ya creado, no otro)', async () => {
    m.reemplazar.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
    await abrirDuplicar()
    fireEvent.click(reemplazar())
    expect(await screen.findByText(/config\.replace\.noResponse/)).toBeInTheDocument()
    fireEvent.click(reemplazar())
    await waitFor(() => expect(m.reemplazar).toHaveBeenCalledTimes(2))
    expect(m.reemplazar.mock.calls[1][3]).toBe(m.reemplazar.mock.calls[0][3])
  })

  it('🔴 dos clics en el mismo instante: UNA llamada', async () => {
    await abrirDuplicar()
    const boton = reemplazar()
    await act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(m.reemplazar).toHaveBeenCalled())
    await act(async () => {})
    expect(m.reemplazar).toHaveBeenCalledTimes(1)
  })

  it('una tasa fuera de rango no deja reemplazar y dice el rango', async () => {
    await abrirDuplicar()
    fireEvent.change(screen.getByLabelText('config.replace.rate'), { target: { value: '150' } })
    expect(reemplazar()).toBeDisabled()
    expect(screen.getByText('config.replace.rateRange')).toBeInTheDocument()
  })
})
