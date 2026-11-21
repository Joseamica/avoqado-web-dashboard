// Máquina de efectivo · fase 1a · B2 (R4-4): «Cobros de la máquina en duda». Lista acotada del SERVIDOR (≤ 100 por página, con
// total y cursor): se ve el total, «Cargar más» trae la siguiente página con el cursor y nunca se recorta en silencio.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Currency } from '@/utils/currency'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key) }),
}))
const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: h.get, post: h.post } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => `FECHA(${d})` }),
}))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))

import CashMachineDoubts from './CashMachineDoubts'

const fila = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `inc${n}`,
  referenceCC: `AQ00000000000${n}`,
  status: 'ABIERTO',
  deviceId: 'd1',
  createdAt: `2026-11-20T19:0${n}:00.000Z`,
  dueCents: 15000 + n,
  saleCents: 13000 + n,
  tipCents: 2000,
  startedAt: `2026-11-20T18:5${n}:00.000Z`,
  lastSeen: null,
  pedido: { items: [{ name: 'Café', quantity: 2 }, { promotionRef: { promotionId: 'p' } }] },
  saleShiftId: null,
  ...extra,
})

const incidencia = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `cinc00000000000000000000${n}`,
  referenceCC: `AQ00000000009${n}`,
  kind: 'CONFLICTO',
  status: 'ABIERTO',
  deviceId: 'd2',
  createdAt: `2026-11-20T20:0${n}:00.000Z`,
  veces: 4,
  version: 2,
  repetidas: 2,
  primerEvento: { motivo: 'OTRA_EVIDENCIA' },
  ultimoEvento: null,
  revision: null,
  revisiones: [{ nota: 'antes', en: '2026-11-19T10:00:00.000Z', version: 1 }],
  ...extra,
})

// H5 del SERVIDOR: la máquina ya cerró el cobro, pero relevaron su PC antes de registrar la venta.
const porTerminar = (n: number) => ({
  id: `cinc00000000000000000pt${n}`,
  referenceCC: `AQ00000000007${n}`,
  kind: 'POR_TERMINAR',
  status: 'ABIERTO',
  deviceId: 'd3',
  createdAt: `2026-11-20T21:0${n}:00.000Z`,
  dueCents: 15000,
  saleCents: null,
  tipCents: null,
  pedido: { items: [{ name: 'Té', quantity: 1 }] },
  saleShiftId: null,
  outcome: 'PAGADO',
  creditCents: 20000,
  changeDispensedCents: 5000,
  occurredAt: null,
  version: 7,
})

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CashMachineDoubts />
    </QueryClientProvider>,
  )
}

const D = 'cashMachineDoubts.'
const texto = () => document.body.textContent ?? ''

describe('CashMachineDoubts', () => {
  beforeEach(() => {
    h.get.mockReset()
    h.post.mockReset()
  })

  it('pide sólo las ABIERTAS de la sucursal, con su límite', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1)], total: 1, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000001')
    expect(h.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/cash-machine/doubts', {
      params: { status: 'ABIERTO', limit: 50 },
    })
  })

  it('enseña folio, inicio, venta, propina, debía y el carrito, con el total', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1)], total: 1, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000001')
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 1, total: 1 })}`)
    expect(texto()).toContain('FECHA(2026-11-20T18:51:00.000Z)')
    expect(texto()).toContain(Currency(130.01))
    expect(texto()).toContain(Currency(20))
    expect(texto()).toContain(Currency(150.01))
    expect(texto()).toContain('2× Café')
    expect(texto()).toContain(`${D}promotionLine`)
    expect(screen.queryByRole('button', { name: `${D}loadMore` })).not.toBeInTheDocument()
  })

  it('«Cargar más» trae la siguiente página con el cursor y no repite filas', async () => {
    h.get
      .mockResolvedValueOnce({ data: { success: true, data: [fila(1), fila(2)], total: 3, nextCursor: 'cursor-1' } })
      .mockResolvedValueOnce({ data: { success: true, data: [fila(2), fila(3)], total: 3, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000002')
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 2, total: 3 })}`)
    fireEvent.click(screen.getByRole('button', { name: `${D}loadMore` }))
    await screen.findByText('AQ000000000003')
    expect(h.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/cash-machine/doubts', {
      params: { status: 'ABIERTO', limit: 50, cursor: 'cursor-1' },
    })
    expect(screen.getAllByText('AQ000000000002')).toHaveLength(1)
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 3, total: 3 })}`)
    expect(screen.queryByRole('button', { name: `${D}loadMore` })).not.toBeInTheDocument()
  })

  it('sin dudas: lo dice (no es lo mismo que un error)', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [], total: 0, nextCursor: null } })
    pintar()
    expect(await screen.findByText(`${D}empty`)).toBeInTheDocument()
    expect(screen.queryByText(`${D}loadError`)).not.toBeInTheDocument()
  })

  it('si la lista no carga: lo dice y deja reintentar', async () => {
    h.get.mockRejectedValue(new Error('red')) // la consulta reintenta UNA vez (retry: 1) antes de rendirse
    pintar()
    expect(await screen.findByText(`${D}loadError`, undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(`${D}empty`)).not.toBeInTheDocument()
    h.get.mockReset()
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1)], total: 1, nextCursor: null } })
    fireEvent.click(screen.getByRole('button', { name: `${D}retry` }))
    await screen.findByText('AQ000000000001')
  })

  it('las incidencias que no son duda van aparte, de sólo lectura, con veces, repetidas y revisiones previas', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1), incidencia(1)], total: 2, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000091')
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 2, total: 2 })}`)
    expect(texto()).toContain(`${D}incidents.heading`)
    expect(texto()).toContain(`${D}incidents.kinds.CONFLICTO.label`)
    expect(texto()).toContain(`${D}incidents.times${JSON.stringify({ count: 4 })}`)
    expect(texto()).toContain(`${D}incidents.repeated${JSON.stringify({ count: 2 })}`)
    expect(texto()).toContain(`${D}incidents.reviewedBefore${JSON.stringify({ count: 1 })}`)
    // La incidencia no se resuelve como duda: sólo la duda tiene «Resolver».
    expect(screen.getAllByRole('button', { name: `${D}resolveButton` })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: `${D}incidents.reviewButton` })).toHaveLength(1)
  })

  it('sólo incidencias: no dibuja la tabla de dudas ni dice «vacío»', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [incidencia(1)], total: 1, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000091')
    expect(screen.queryByText(`${D}columns.due`)).not.toBeInTheDocument()
    expect(screen.queryByText(`${D}empty`)).not.toBeInTheDocument()
  })

  it('«Revisar» → 409 «llegó evidencia nueva»: vuelve a pedir la lista y la ventana manda la versión NUEVA', async () => {
    h.get
      .mockResolvedValueOnce({ data: { success: true, data: [incidencia(1)], total: 1, nextCursor: null } })
      .mockResolvedValueOnce({ data: { success: true, data: [incidencia(1, { version: 3 })], total: 1, nextCursor: null } })
    h.post
      .mockRejectedValueOnce(
        Object.assign(new Error('409'), {
          response: { status: 409, data: { code: 'CASH_MACHINE_INCIDENT_CHANGED', details: { version: 3 } } },
        }),
      )
      .mockResolvedValueOnce({ status: 200, data: { success: true, status: 'RESUELTO', version: 3 } })
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: `${D}incidents.reviewButton` }))
    fireEvent.change(screen.getByLabelText(`${D}incidents.note`), { target: { value: 'revisé' } })
    fireEvent.click(screen.getByRole('button', { name: `${D}incidents.markReviewed` }))
    expect(await screen.findByRole('alert')).toHaveTextContent(`${D}incidents.changed`)
    await waitFor(() => expect(h.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: `${D}incidents.markReviewed` })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: `${D}incidents.markReviewed` }))
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(2))
    expect(h.post.mock.calls[0][1]).toEqual({ note: 'revisé', version: 2 })
    expect(h.post.mock.calls[1][1]).toEqual({ note: 'revisé', version: 3 })
  })

  it('«Resolver» → 409 «llegó evidencia nueva»: vuelve a pedir la lista, la ventana enseña lo nuevo, conserva lo tecleado y manda la versión NUEVA', async () => {
    h.get
      .mockResolvedValueOnce({ data: { success: true, data: [fila(1, { version: 1 })], total: 1, nextCursor: null } })
      .mockResolvedValueOnce({
        data: { success: true, data: [fila(1, { version: 2, lastSeen: 'credit 150' })], total: 1, nextCursor: null },
      })
    h.post
      .mockRejectedValueOnce(
        Object.assign(new Error('409'), {
          response: { status: 409, data: { code: 'CASH_MACHINE_DOUBT_CHANGED', details: { version: 2 } } },
        }),
      )
      .mockResolvedValueOnce({ status: 200, data: { success: true, ack: 'TERMINADO', owedCents: 0 } })
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: `${D}resolveButton` }))
    const R = `${D}resolve.`
    // Lo congelado del folio, para compararlo con la pantalla de la máquina.
    expect(screen.getByRole('dialog')).toHaveTextContent(`${R}cart${JSON.stringify({ items: `2× Café, ${D}promotionLine` })}`)
    fireEvent.click(screen.getByRole('radio', { name: `${R}outcomes.PAGADO.label` }))
    fireEvent.change(screen.getByLabelText(`${R}received`), { target: { value: '150.01' } })
    fireEvent.change(screen.getByLabelText(`${R}evidence`), { target: { value: 'pagado' } })
    fireEvent.click(screen.getByRole('button', { name: `${R}submit` }))
    expect(await screen.findByRole('alert')).toHaveTextContent(`${R}changed`)
    await waitFor(() => expect(h.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('credit 150'))
    expect(screen.getByLabelText(`${R}evidence`)).toHaveValue('pagado')
    await waitFor(() => expect(screen.getByRole('button', { name: `${R}submit` })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: `${R}submit` }))
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(2))
    expect(h.post.mock.calls[0][1]).toMatchObject({ creditCents: 15001, evidence: 'pagado', version: 1 })
    expect(h.post.mock.calls[1][1]).toMatchObject({ creditCents: 15001, evidence: 'pagado', version: 2 })
  })

  it('H1: la fila de la duda enseña lo MÁS que la PC vio entrar; sin número, «—»', async () => {
    h.get.mockResolvedValueOnce({
      data: { success: true, data: [fila(1, { creditCents: 12345 }), fila(2, { creditCents: null })], total: 2, nextCursor: null },
    })
    pintar()
    await screen.findByText('AQ000000000002')
    expect(texto()).toContain(`${D}columns.seen`)
    const [conNumero, sinNumero] = document.querySelectorAll('[data-tour="cash-machine-doubt-seen"]')
    expect(conNumero).toHaveTextContent(Currency(123.45))
    expect(sinNumero).toHaveTextContent('—')
  })

  it('venta y propina en null: «—», nunca «N/A», y la página no truena', async () => {
    h.get.mockResolvedValueOnce({
      data: { success: true, data: [fila(1, { saleCents: null, tipCents: null })], total: 1, nextCursor: null },
    })
    pintar()
    await screen.findByText('AQ000000000001')
    expect(texto()).toContain(Currency(150.01))
    expect(texto()).not.toContain('N/A')
  })

  it('POR_TERMINAR: va en su propia tabla con la etiqueta, lo que dijo la máquina y «Terminar» (nunca «Revisar» ni «Resolver»)', async () => {
    const pt = porTerminar(1)
    h.get.mockResolvedValueOnce({ data: { success: true, data: [pt], total: 1, nextCursor: null } })
    pintar()
    await screen.findByText(pt.referenceCC)
    expect(texto()).toContain(`${D}toFinish.label`)
    expect(texto()).toContain(`${D}resolve.outcomes.PAGADO.label`)
    expect(texto()).toContain(`${D}resolve.conflict.received${JSON.stringify({ amount: Currency(200) })}`)
    expect(texto()).not.toContain('N/A') // venta y propina en null → «—»
    expect(screen.queryByRole('button', { name: `${D}incidents.reviewButton` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `${D}resolveButton` })).not.toBeInTheDocument()
    expect(screen.queryByText(`${D}incidents.heading`)).not.toBeInTheDocument()
    expect(texto()).toContain(`${D}showing${JSON.stringify({ shown: 1, total: 1 })}`)
  })

  it('«Terminar» abre la ventana de ese folio y manda SÓLO su versión', async () => {
    const pt = porTerminar(1)
    h.get.mockResolvedValue({ data: { success: true, data: [fila(1), pt, incidencia(1)], total: 3, nextCursor: null } })
    h.post.mockResolvedValueOnce({ status: 200, data: { success: true, ack: 'TERMINADO', owedCents: 0 } })
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: `${D}toFinish.button` }))
    expect(screen.getByRole('dialog')).toHaveTextContent(`${D}toFinish.title${JSON.stringify({ folio: pt.referenceCC })}`)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: `${D}toFinish.button` }))
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1))
    expect(h.post).toHaveBeenCalledWith(`/api/v1/dashboard/venues/v1/cash-machine/doubts/${pt.referenceCC}/resolve`, { version: 7 })
  })

  it('«Resolver» abre la ventana de ese folio', async () => {
    h.get.mockResolvedValueOnce({ data: { success: true, data: [fila(1), fila(2)], total: 2, nextCursor: null } })
    pintar()
    await screen.findByText('AQ000000000002')
    fireEvent.click(screen.getAllByRole('button', { name: `${D}resolveButton` })[1])
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent(`${D}resolve.title${JSON.stringify({ folio: 'AQ000000000002' })}`),
    )
  })
})
