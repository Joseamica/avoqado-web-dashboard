/**
 * D34 · el detalle del pago ofrecía «Eliminar de la transacción» en una venta ya cobrada y el SERVIDOR contestaba 409. El panel nunca
 * ofrece lo que el SERVIDOR rechaza: el botón sale sólo con el «sí» del SERVIDOR (`customerUnlink.allowed === true`) y el permiso de
 * editar órdenes. Si no, en su lugar va la razón. Y si aun así el PUT lo rechaza (la cuenta se cobró en otra caja, le quitaron el
 * permiso), el botón se retira con el mensaje del SERVIDOR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/payment.json'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  return typeof raw === 'string' ? raw : ((opts?.defaultValue as string) ?? key)
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))

const m = vi.hoisted(() => ({
  pago: null as any,
  puede: true,
  puts: [] as Array<{ url: string; body: unknown }>,
  rechazo: null as null | { status: number; message: string },
  /** Lo que contesta el GET del pago DESPUÉS de un rechazo del PUT (`'falla'` = la relectura no llega). */
  trasRechazo: undefined as any,
  rechazado: false,
  lecturas: 0,
  invalidadas: [] as unknown[],
  cargandoPermisos: false,
  /** Si está, el PUT espera a que la prueba lo suelte (respuesta lenta). */
  soltarPut: null as null | (() => void),
  putLento: false,
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Café' }, fullBasePath: '/venues/cafe' }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    can: (p: string) => !m.cargandoPermisos && (p === 'orders:update' ? m.puede : true),
    isLoading: m.cargandoPermisos,
  }),
}))
vi.mock('../IssueRefundSheet', () => ({ IssueRefundSheet: () => null }))
vi.mock('../RefundCreditNotePanel', () => ({ RefundCreditNotePanel: () => null }))
vi.mock('@/api', () => ({
  default: {
    get: async (url: string) => {
      if (url.endsWith('/refunds')) return { data: { data: [] } }
      if (url.endsWith('/receipts')) return { data: [] }
      if (url.includes('/payments/')) {
        m.lecturas += 1
        if (m.rechazado && m.trasRechazo === 'falla') throw { response: { status: 503, data: { message: 'caído' } } }
        return { data: m.rechazado && m.trasRechazo ? m.trasRechazo : m.pago }
      }
      return { data: [] }
    },
    post: async () => ({ data: {} }),
    put: async (url: string, body: unknown) => {
      m.puts.push({ url, body })
      if (m.putLento) await new Promise<void>(resolve => (m.soltarPut = resolve))
      if (m.rechazo) {
        m.rechazado = true
        // Con un 403, los permisos que el panel relee ya no traen `orders:update`.
        if (m.rechazo.status === 403) m.puede = false
        throw { response: { status: m.rechazo.status, data: { message: m.rechazo.message } } }
      }
      // Quitado: el pago releído ya no trae cliente.
      m.pago = { ...m.pago, order: { ...m.pago.order, customer: null } }
      return { data: {} }
    },
  },
}))

import { PaymentDrawerContent } from '../PaymentDrawerContent'

const BOTON = 'Eliminar de la transacción'
const pago = (customerUnlink?: unknown) => ({
  id: 'p1',
  type: 'REGULAR',
  amount: '100.00',
  tipAmount: '0',
  method: 'CASH',
  source: 'POS',
  createdAt: '2026-11-20T18:00:00Z',
  order: { id: 'o1', items: [], customer: { id: 'c1', firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com' } },
  ...(customerUnlink !== undefined && { customerUnlink }),
})

/** Abre el drawer y la ficha del cliente desde «Pagado por». */
async function abrirFichaDelCliente() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = client.invalidateQueries.bind(client)
  client.invalidateQueries = ((filtros?: { queryKey?: unknown }) => {
    m.invalidadas.push(filtros?.queryKey)
    return invalidar(filtros as any)
  }) as typeof client.invalidateQueries
  render(
    <QueryClientProvider client={client}>
      <PaymentDrawerContent paymentId="p1" onClose={() => {}} venueTimezone="America/Mexico_City" />
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Ana Ruiz' }))
  await screen.findByRole('heading', { name: 'Editar cliente' })
}

/** Cierra la ficha con «Cancelar» y la vuelve a abrir desde «Pagado por». */
async function reabrirLaFicha() {
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Editar cliente' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Ana Ruiz' }))
  await screen.findByRole('heading', { name: 'Editar cliente' })
}

beforeEach(() => {
  m.puede = true
  m.puts = []
  m.rechazo = null
  m.trasRechazo = undefined
  m.rechazado = false
  m.lecturas = 0
  m.invalidadas = []
  m.cargandoPermisos = false
  m.soltarPut = null
  m.putLento = false
})

describe('D34 · «Eliminar de la transacción» sólo cuando el SERVIDOR lo acepta', () => {
  it('cuenta abierta (el SERVIDOR dice que sí): sale el botón y quita al cliente con customerId null', async () => {
    m.pago = pago({ allowed: true })
    await abrirFichaDelCliente()
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    await waitFor(() => expect(m.puts).toEqual([{ url: '/api/v1/dashboard/venues/v1/orders/o1', body: { customerId: null } }]))
    // Se cierra la ficha y «Pagado por» deja de enseñar al cliente.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ana Ruiz' })).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Editar cliente' })).not.toBeInTheDocument()
  })

  it('🔴 venta cobrada: no sale el botón; sale la razón en llano', async () => {
    m.pago = pago({ allowed: false, code: 'SALE_CUSTOMER_ALREADY_ASSIGNED', reason: 'razón del servidor' })
    await abrirFichaDelCliente()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    expect(screen.getByText(es.customer.unlinkBlocked.paid)).toBeInTheDocument()
  })

  it('venta cancelada: su propia razón', async () => {
    m.pago = pago({ allowed: false, code: 'ORDER_CANCELLED_NO_EDIT', reason: 'razón del servidor' })
    await abrirFichaDelCliente()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    expect(screen.getByText(es.customer.unlinkBlocked.cancelled)).toBeInTheDocument()
  })

  it('un código que el panel no conoce: enseña la razón que manda el SERVIDOR', async () => {
    m.pago = pago({ allowed: false, code: 'OTRO_CODIGO', reason: 'La razón nueva del servidor.' })
    await abrirFichaDelCliente()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    expect(screen.getByText('La razón nueva del servidor.')).toBeInTheDocument()
  })

  it('sin el permiso de editar órdenes: no sale el botón; dice qué permiso falta', async () => {
    m.puede = false
    m.pago = pago({ allowed: true })
    await abrirFichaDelCliente()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    expect(screen.getByText(es.customer.unlinkBlocked.permission)).toBeInTheDocument()
  })

  it('un SERVIDOR que todavía no manda el campo: no se ofrece (no hay un «sí»)', async () => {
    m.pago = pago()
    await abrirFichaDelCliente()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
  })

  it('🔴 si el PUT lo rechaza (la cuenta se cobró en otra caja): el botón se retira con el mensaje del SERVIDOR; al reabrir, manda el pago releído', async () => {
    m.pago = pago({ allowed: true })
    m.rechazo = { status: 409, message: 'Esta venta ya tiene un cliente asignado y no se puede reemplazar.' }
    m.trasRechazo = pago({ allowed: false, code: 'SALE_CUSTOMER_ALREADY_ASSIGNED', reason: 'razón del servidor' })
    await abrirFichaDelCliente()
    const lecturasAntes = m.lecturas
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    expect(await screen.findByText(m.rechazo.message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    await waitFor(() => expect(m.lecturas).toBeGreaterThan(lecturasAntes))
    // Aunque el pago se relea mientras la ficha sigue abierta, el botón no vuelve.
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    await reabrirLaFicha()
    expect(screen.getByText(es.customer.unlinkBlocked.paid)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
  })

  it('🔴 rechazo y la relectura del pago no llega: con la ficha abierta, el botón no vuelve; queda el mensaje del SERVIDOR', async () => {
    m.pago = pago({ allowed: true })
    m.rechazo = { status: 409, message: 'Esta venta ya tiene un cliente asignado y no se puede reemplazar.' }
    m.trasRechazo = 'falla'
    await abrirFichaDelCliente()
    const lecturasAntes = m.lecturas
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    expect(await screen.findByText(m.rechazo.message)).toBeInTheDocument()
    await waitFor(() => expect(m.lecturas).toBeGreaterThan(lecturasAntes))
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
  })

  it('403 (le quitaron el permiso con la pantalla abierta): se releen los permisos; al reabrir dice qué permiso falta, y con el permiso de vuelta sale el botón', async () => {
    m.pago = pago({ allowed: true })
    m.rechazo = { status: 403, message: 'No tienes permiso.' }
    await abrirFichaDelCliente()
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    expect(await screen.findByText('No tienes permiso.')).toBeInTheDocument()
    await waitFor(() => expect(m.invalidadas).toContainEqual(['user-access', 'v1']))
    await reabrirLaFicha()
    expect(screen.getByText(es.customer.unlinkBlocked.permission)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    m.puede = true // le devolvieron el permiso
    m.rechazo = null
    await reabrirLaFicha()
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument()
  })

  it('mientras los permisos se leen: ni botón ni «te falta el permiso» (no es una negativa)', async () => {
    m.cargandoPermisos = true
    m.pago = pago({ allowed: true })
    await abrirFichaDelCliente()
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument()
    expect(screen.queryByText(es.customer.unlinkBlocked.permission)).not.toBeInTheDocument()
  })

  it('🔴 un rechazo que llega tarde de la ficha anterior no se le pega a la ficha nueva', async () => {
    m.pago = pago({ allowed: true })
    m.rechazo = { status: 409, message: 'Esta venta ya tiene un cliente asignado y no se puede reemplazar.' }
    m.putLento = true
    await abrirFichaDelCliente()
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    await waitFor(() => expect(m.soltarPut).not.toBeNull())
    await reabrirLaFicha()
    m.soltarPut!()
    await waitFor(() => expect(m.rechazado).toBe(true))
    await waitFor(() => expect(m.lecturas).toBeGreaterThan(0))
    expect(screen.queryByText(m.rechazo.message)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument()
  })

  it('regresión: un 5xx o la red caída no retira el botón (se puede reintentar)', async () => {
    m.pago = pago({ allowed: true })
    m.rechazo = { status: 500, message: 'Error interno' }
    await abrirFichaDelCliente()
    fireEvent.click(screen.getByRole('button', { name: BOTON }))
    await waitFor(() => expect(m.puts).toHaveLength(1))
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument()
  })
})
