/**
 * «Nueva factura» (Facturas, 28-oct-2026): el buscador de la venta a facturar.
 *
 * 🔴 Lo que estas pruebas fijan:
 *   - sólo pide ventas cerradas, con su estado de factura (`conFactura`), por páginas, y nada con la ventana cerrada;
 *   - una venta que el servidor marca `facturada` no se puede elegir (dice «Ya facturada»); las demás sí, por su id;
 *   - una venta con la cancelación de su factura en trámite SÍ se puede elegir (sólo el servidor sabe si ya se puede; Codex plan r1 #2);
 *   - «Cargar más» llega hasta el total y no repite ventas;
 *   - vacío, sin resultados y error se distinguen;
 *   - teclear en el buscador no le quita el foco (la búsqueda va al servidor).
 *
 * TanStack Query corre de verdad: lo que se simula es el servicio HTTP de ventas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/cfdi.json'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const get = (k: string) => k.split('.').reduce<any>((o, p) => o?.[p], es as any)
  const plural = typeof opts?.count === 'number' ? get(`${key}_${opts.count === 1 ? 'one' : 'other'}`) : undefined
  const raw = typeof plural === 'string' ? plural : get(key)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

const svc = vi.hoisted(() => ({ getOrders: vi.fn() }))
vi.mock('@/services/order.service', () => ({ getOrders: svc.getOrders }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-1', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => `día ${String(d).slice(0, 10)}` }) }))
// El modal real anima y usa un portal de Radix; aquí basta con pintar su contenido cuando está abierto.
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}))

import { PickOrderToInvoiceDialog } from '../PickOrderToInvoiceDialog'

const venta = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  orderNumber: `ORD-${id}`,
  total: 116,
  createdAt: '2026-10-20T18:00:00.000Z',
  completedAt: '2026-10-20T18:05:00.000Z',
  customerName: null,
  orderCustomers: [],
  ...over,
})

function montar(props: Partial<{ open: boolean; onSelect: (id: string) => void }> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSelect = props.onSelect ?? vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <PickOrderToInvoiceDialog open={props.open ?? true} onOpenChange={() => {}} onSelect={onSelect} />
    </QueryClientProvider>,
  )
  return { onSelect }
}

beforeEach(() => {
  svc.getOrders.mockReset()
})

describe('PickOrderToInvoiceDialog', () => {
  it('pide sólo ventas cerradas con su estado de factura, de 20 en 20, y nada con la ventana cerrada', async () => {
    svc.getOrders.mockResolvedValue({ data: [], meta: { total: 0 } })

    montar({ open: false })
    expect(svc.getOrders).not.toHaveBeenCalled()

    montar()
    await waitFor(() => expect(svc.getOrders).toHaveBeenCalledTimes(1))
    const [venueId, paginacion, filtros] = svc.getOrders.mock.calls[0]
    expect(venueId).toBe('venue-1')
    expect(paginacion).toEqual({ pageIndex: 0, pageSize: 20 })
    expect(filtros).toEqual({ statuses: ['COMPLETED'], search: undefined, conFactura: true })
  })

  it('una venta ya facturada no se puede elegir; las demás se eligen por su id', async () => {
    svc.getOrders.mockResolvedValue({
      data: [venta('a', { facturada: true }), venta('b', { facturada: false }), venta('c')],
      meta: { total: 3 },
    })
    const { onSelect } = montar()

    await screen.findByText('ORD-a')
    expect(screen.getByText(es.pickOrder.alreadyInvoiced)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Facturar la venta ORD-a' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Facturar la venta ORD-b' }))
    expect(onSelect).toHaveBeenCalledWith('b')
    // Un servidor anterior no manda `facturada`: la venta sale elegible y el candado del servidor la protege.
    expect(screen.getByRole('button', { name: 'Facturar la venta ORD-c' })).toBeEnabled()
    expect(screen.getByText('3 ventas cerradas')).toBeInTheDocument()
  })

  it('con la cancelación de su factura en trámite avisa, pero sí se puede elegir', async () => {
    svc.getOrders.mockResolvedValue({ data: [venta('k', { facturada: false, facturaEnCancelacion: true })], meta: { total: 1 } })
    const { onSelect } = montar()

    expect(await screen.findByText(es.pickOrder.cancellationPending)).toBeInTheDocument()
    expect(screen.queryByText(es.pickOrder.alreadyInvoiced)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Facturar la venta ORD-k' }))
    expect(onSelect).toHaveBeenCalledWith('k')
  })

  it('«Cargar más» trae la siguiente página hasta el total, sin repetir ventas', async () => {
    const primera = Array.from({ length: 20 }, (_, i) => venta(`p${i}`))
    svc.getOrders
      .mockResolvedValueOnce({ data: primera, meta: { total: 22 } })
      // `p19` cambió entre una página y otra y vuelve a salir: se pinta una vez.
      .mockResolvedValueOnce({ data: [venta('p19'), venta('x1'), venta('x2')], meta: { total: 22 } })
    montar()

    await screen.findByText('ORD-p0')
    fireEvent.click(screen.getByRole('button', { name: es.pickOrder.loadMore }))

    await screen.findByText('ORD-x2')
    expect(svc.getOrders.mock.calls[1][1]).toEqual({ pageIndex: 1, pageSize: 20 })
    expect(screen.getAllByText('ORD-p19')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: es.pickOrder.loadMore })).not.toBeInTheDocument()
  })

  it('sin ventas dice que no hay; con búsqueda dice que no coincide', async () => {
    svc.getOrders.mockResolvedValue({ data: [], meta: { total: 0 } })
    montar()

    expect(await screen.findByText(es.pickOrder.empty)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: es.pickOrder.search }))
    fireEvent.change(screen.getByLabelText(es.pickOrder.search), { target: { value: 'zzz' } })
    expect(await screen.findByText('Ninguna venta coincide con «zzz».', {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('un error se ve como error, con «Reintentar», no como lista vacía', async () => {
    // El buscador reintenta UNA vez (lista pesada, `retry: 1`): el error se ve cuando fallan los dos intentos.
    svc.getOrders
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue({ data: [venta('z')], meta: { total: 1 } })
    montar()

    expect(await screen.findByText(es.pickOrder.error, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(es.pickOrder.empty)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: es.pickOrder.retry }))
    expect(await screen.findByText('ORD-z')).toBeInTheDocument()
  })

  it('teclear en el buscador no le quita el foco y manda la búsqueda al servidor', async () => {
    svc.getOrders.mockResolvedValue({ data: [venta('a')], meta: { total: 1 } })
    montar()
    await screen.findByText('ORD-a')

    fireEvent.click(screen.getByRole('button', { name: es.pickOrder.search }))
    const buscador = screen.getByLabelText(es.pickOrder.search)
    buscador.focus()
    fireEvent.change(buscador, { target: { value: '0851' } })

    await waitFor(() => expect(svc.getOrders.mock.calls.some(c => c[2].search === '0851')).toBe(true), { timeout: 2000 })
    expect(screen.getByLabelText(es.pickOrder.search)).toBe(buscador)
    expect(buscador).toHaveFocus()
    expect(buscador).toHaveValue('0851')
  })
})
