/**
 * C1 · Tarea 13 — el diálogo de las ventas que no entraron a la factura global.
 *
 * Lo que no puede pasar: que el total mezcle la estadística vieja de la captura con lo de hoy (Codex C1-18), que diga un número
 * exacto cuando el servidor dejó de revisar («al menos»), o que diga «ninguna quedó fuera» mientras todavía hay páginas.
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/cfdi.json'
import type { GlobalExcluidasPage } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: (d: string) => `fecha(${d})`, formatDateTime: (d: string) => `fecha(${d})` }),
}))

const m = vi.hoisted(() => ({ getGlobalExcluidas: vi.fn() }))
vi.mock('@/services/cfdi.service', () => ({ default: { getGlobalExcluidas: m.getGlobalExcluidas } }))

import { GlobalExcluidasDialog } from '../GlobalExcluidasDialog'

const DESDE = '2026-09-01T06:00:00.000Z'
const g = es.globalInvoice

const pagina = (over: Partial<GlobalExcluidasPage> = {}): GlobalExcluidasPage => ({
  periodo: { meses: '09', anio: 2026, desde: DESDE, hasta: '2026-10-01T06:00:00.000Z' },
  estadoDelPeriodo: 'SIN_GLOBAL',
  totales: { porMotivo: { PRODUCTO_POR_REVISAR: 1, EFECTIVO: 1 }, total: 2, completo: true, revisadas: 2 },
  corregidasPendientes: { n: 0, completo: true },
  ultimaCaptura: null,
  excluidas: [],
  siguiente: null,
  revisadas: 2,
  ...over,
})

const venta = (orderId: string, folio: string, cobradoCents: number, detalle: string, texto = 'TEXTO GENÉRICO DEL MOTIVO') => ({
  orderId,
  folio,
  cobradoCents,
  motivo: 'PRODUCTO_POR_REVISAR',
  texto,
  detalle,
})

function pintar(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('GlobalExcluidasDialog', () => {
  it('🔴 dos páginas: pinta folio, importe y el DETALLE de cada venta; «Cargar más» pide la siguiente con su cursor y conserva los totales de la primera', async () => {
    m.getGlobalExcluidas
      .mockResolvedValueOnce(
        pagina({ excluidas: [venta('o1', 'A-101', 12550, 'El producto «Café en grano» tiene el IVA por revisar.')], siguiente: 'o1' }),
      )
      .mockResolvedValueOnce(
        pagina({
          totales: null,
          corregidasPendientes: null,
          excluidas: [venta('o2', 'A-102', 5000, 'Se cobró $50.00 en efectivo.')],
          siguiente: null,
        }),
      )
    pintar(<GlobalExcluidasDialog emisorId="e1" desde={DESDE} open onOpenChange={() => {}} />)

    await screen.findByText('A-101')
    expect(m.getGlobalExcluidas).toHaveBeenNthCalledWith(1, 'v1', 'e1', { desde: DESDE })
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveTextContent('El producto «Café en grano» tiene el IVA por revisar.')
    expect(dialogo).toHaveTextContent('125.50')
    // I3 (ronda 1): el periodo en la zona fiscal (CDMX), del 1 al 30 de septiembre; nunca con la fecha del negocio.
    expect(dialogo).toHaveTextContent(/Periodo 1 sept?\.? 2026 – 30 sept?\.? 2026/)
    expect(dialogo).toHaveTextContent(traducir('globalInvoice.excluded.total', { count: 2 }))

    fireEvent.click(screen.getByRole('button', { name: g.excluded.loadMore }))
    await screen.findByText('A-102')
    expect(m.getGlobalExcluidas).toHaveBeenNthCalledWith(2, 'v1', 'e1', { desde: DESDE, cursor: 'o1' })
    expect(screen.getByRole('dialog')).toHaveTextContent('Se cobró $50.00 en efectivo.')
    // Los totales siguen siendo los de la primera página (la segunda trae `totales: null`).
    expect(screen.getByRole('dialog')).toHaveTextContent(traducir('globalInvoice.excluded.total', { count: 2 }))
    expect(screen.queryByRole('button', { name: g.excluded.loadMore })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveTextContent(g.excluded.empty)
  })

  it('🔴 con `completo: false` dice «al menos N», nunca un total exacto', async () => {
    m.getGlobalExcluidas.mockResolvedValueOnce(
      pagina({
        totales: { porMotivo: { PRODUCTO_POR_REVISAR: 500 }, total: 500, completo: false, revisadas: 500 },
        excluidas: [venta('o1', 'A-101', 100, 'detalle')],
        siguiente: 'o1',
      }),
    )
    pintar(<GlobalExcluidasDialog emisorId="e1" open onOpenChange={() => {}} />)
    await screen.findByText('A-101')
    expect(m.getGlobalExcluidas).toHaveBeenCalledWith('v1', 'e1', {})
    expect(screen.getByRole('dialog')).toHaveTextContent(traducir('globalInvoice.excluded.totalAtLeast', { count: 500 }))
    expect(screen.getByRole('dialog')).not.toHaveTextContent(traducir('globalInvoice.excluded.total', { count: 500 }))
  })

  it('con total 0 y sin más páginas dice «Ninguna venta quedó fuera»; con total 0 pero con otra página, todavía no', async () => {
    m.getGlobalExcluidas.mockResolvedValueOnce(pagina({ totales: { porMotivo: {}, total: 0, completo: true, revisadas: 3 } }))
    const { unmount } = pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} />)
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(g.excluded.empty))
    expect(m.getGlobalExcluidas).toHaveBeenCalledWith('v1', 'e1', { principalId: 'g1' })
    unmount()

    m.getGlobalExcluidas.mockResolvedValueOnce(
      pagina({ totales: { porMotivo: {}, total: 0, completo: false, revisadas: 200 }, siguiente: 'o200' }),
    )
    pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} />)
    await screen.findByRole('button', { name: g.excluded.loadMore })
    expect(screen.getByRole('dialog')).not.toHaveTextContent(g.excluded.empty)
  })

  it('🔴 C1-18: la última captura se dice aparte («Al emitir la global el …») y nunca se suma al total de hoy', async () => {
    m.getGlobalExcluidas.mockResolvedValueOnce(
      pagina({
        estadoDelPeriodo: 'TIMBRADA',
        totales: { porMotivo: { CORREGIDA_DESPUES: 2 }, total: 2, completo: true, revisadas: 5 },
        ultimaCaptura: { al: '2026-10-01T09:00:00.000Z', excluidas: { PRODUCTO_POR_REVISAR: 3, EFECTIVO: 1 } },
        excluidas: [venta('o1', 'A-101', 100, 'detalle uno'), venta('o2', 'A-102', 100, 'detalle dos')],
      }),
    )
    pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} />)
    await screen.findByText('A-101')
    const lista = [
      traducir('globalInvoice.excluded.motiveItem', { label: g.excluded.motives.PRODUCTO_POR_REVISAR, count: 3 }),
      traducir('globalInvoice.excluded.motiveItem', { label: g.excluded.motives.EFECTIVO, count: 1 }),
    ].join(', ')
    const captura = traducir('globalInvoice.excluded.lastCapture', { date: 'fecha(2026-10-01T09:00:00.000Z)', list: lista })
    expect(screen.getByText(captura)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(traducir('globalInvoice.excluded.total', { count: 2 }))
    expect(screen.getByRole('dialog')).not.toHaveTextContent(traducir('globalInvoice.excluded.total', { count: 6 }))
  })

  it('🔴 con ventas pendientes y la principal timbrada ofrece «Emitir complementaria» con el id de la principal; sin pendientes, no', async () => {
    const onEmitir = vi.fn()
    m.getGlobalExcluidas.mockResolvedValueOnce(
      pagina({
        estadoDelPeriodo: 'TIMBRADA',
        totales: { porMotivo: { CORREGIDA_DESPUES: 2 }, total: 2, completo: true, revisadas: 2 },
        corregidasPendientes: { n: 2, completo: true },
        excluidas: [venta('o1', 'A-101', 100, 'detalle')],
      }),
    )
    const { unmount } = pintar(
      <GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} onEmitirComplementaria={onEmitir} />,
    )
    fireEvent.click(await screen.findByRole('button', { name: traducir('globalInvoice.periods.complementaryCount', { count: 2 }) }))
    expect(onEmitir).toHaveBeenCalledWith('g1')
    unmount()

    m.getGlobalExcluidas.mockResolvedValueOnce(pagina({ estadoDelPeriodo: 'TIMBRADA', corregidasPendientes: { n: 0, completo: true } }))
    pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} onEmitirComplementaria={onEmitir} />)
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(traducir('globalInvoice.excluded.total', { count: 2 })))
    expect(screen.queryByRole('button', { name: /complementaria/ })).not.toBeInTheDocument()
  })

  it('🔴 M1: cuando el detalle ya contiene el texto del motivo, la frase no sale dos veces', async () => {
    const TEXTO = 'Tiene un producto con el IVA por revisar (objeto de impuesto 03 o 04); corrígelo en el catálogo.'
    m.getGlobalExcluidas.mockResolvedValueOnce(pagina({ excluidas: [venta('o1', 'A-101', 100, `${TEXTO} (Café en grano)`, TEXTO)] }))
    pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} />)
    await screen.findByText(`${TEXTO} (Café en grano)`)
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument()
  })

  it('🔴 I4: un 524 del proxy dice el texto de la pantalla en español, nunca «Request failed…» de axios', async () => {
    m.getGlobalExcluidas.mockRejectedValue({
      response: { status: 524, data: 'error code: 524' },
      message: 'Request failed with status code 524',
    })
    pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} />)
    expect(await screen.findByText(g.excluded.loadError, undefined, { timeout: 3_000 })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/Request failed/)
  })

  it('control — I4: un 400 con texto del servidor («pídelo a soporte») se muestra tal cual', async () => {
    const TEXTO = 'Ese periodo ya no se emite desde aquí; pídelo a soporte.'
    m.getGlobalExcluidas.mockRejectedValue({ response: { status: 400, data: { error: TEXTO } } })
    pintar(<GlobalExcluidasDialog emisorId="e1" desde={DESDE} open onOpenChange={() => {}} />)
    expect(await screen.findByText(TEXTO)).toBeInTheDocument()
  })

  it('🔴 ronda 2 (T10): `SIN_TERMINAL` sale con su texto del servidor y en el «Por qué» del resumen', async () => {
    const TEXTO =
      'Se cobró fuera de la terminal y tu configuración no incluye esas ventas en la factura global. Puedes activarlo en Facturación → tu RFC.'
    m.getGlobalExcluidas.mockResolvedValueOnce(
      pagina({
        totales: { porMotivo: { SIN_TERMINAL: 3 }, total: 3, completo: true, revisadas: 0 },
        excluidas: [{ orderId: 'o1', folio: 'A-101', cobradoCents: 5000, motivo: 'SIN_TERMINAL', texto: TEXTO, detalle: TEXTO }],
      }),
    )
    pintar(<GlobalExcluidasDialog emisorId="e1" desde={DESDE} open onOpenChange={() => {}} />)
    expect(await screen.findByText(TEXTO)).toBeInTheDocument()
    const porQue = traducir('globalInvoice.excluded.byReason', {
      list: traducir('globalInvoice.excluded.motiveItem', { label: g.excluded.motives.SIN_TERMINAL, count: 3 }),
    })
    expect(screen.getByText(porQue)).toBeInTheDocument()
  })
})

/**
 * Ola final (I1 de la re-revisión 2): cerrar el listado no pide nada y reabrirlo con los datos viejos pide UNA página, no todas las que
 * alguien cargó con «Cargar más». Con el diálogo y el hook REALES, en las tres formas en que se usa: el panel (al cerrar, `principalId` y
 * `desde` pasan a `undefined` en el MISMO render), Configuración (`emisorId` pasa a `null`) y el sub-diálogo de la complementaria (la llave
 * no cambia; sólo `open`). La prueba de la ronda 2 dejaba `principalId` fijo y sólo contaba llamadas en total: no veía ninguno de los dos.
 */
describe('GlobalExcluidasDialog · cerrar y reabrir (ola final, I1)', () => {
  const LLAVE = ['global-excluidas', 'v1', 'e1', 'g1', null]
  const TRES_PAGINAS = async (_v: string, _e: string, q: { cursor?: string }) => {
    if (q.cursor === 'o1')
      return pagina({ totales: null, corregidasPendientes: null, excluidas: [venta('o2', 'A-102', 100, 'segunda')], siguiente: 'o2' })
    if (q.cursor === 'o2')
      return pagina({ totales: null, corregidasPendientes: null, excluidas: [venta('o3', 'A-103', 100, 'tercera')], siguiente: null })
    return pagina({ excluidas: [venta('o1', 'A-101', 100, 'primera')], siguiente: 'o1' })
  }
  const unRato = () => act(() => new Promise(r => setTimeout(r, 50)))

  type Props = { emisorId: string | null; principalId?: string; open: boolean }
  function montar(inicial: Props, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const ui = (p: Props) => (
      <QueryClientProvider client={qc}>
        <GlobalExcluidasDialog emisorId={p.emisorId} principalId={p.principalId} open={p.open} onOpenChange={() => {}} />
      </QueryClientProvider>
    )
    const r = render(ui(inicial))
    return { qc, cambiar: (p: Props) => r.rerender(ui(p)), desmontar: r.unmount }
  }
  async function cargarTresPaginas() {
    fireEvent.click(await screen.findByRole('button', { name: g.excluded.loadMore }))
    await screen.findByText('A-102')
    fireEvent.click(await screen.findByRole('button', { name: g.excluded.loadMore }))
    await screen.findByText('A-103')
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
  }
  /** Como si hubiera pasado el minuto: la llave queda vieja sin pedir nada (lo que hace cualquier invalidación con el diálogo cerrado). */
  const envejecer = (qc: QueryClient) => act(() => qc.invalidateQueries({ queryKey: ['global-excluidas'], refetchType: 'none' }))
  async function reabrirYContar(cambiar: (p: Props) => void, p: Props) {
    cambiar(p)
    await screen.findByText('A-101')
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(4)
    expect(m.getGlobalExcluidas).toHaveBeenLastCalledWith('v1', 'e1', { principalId: 'g1' })
    expect(screen.queryByText('A-102')).not.toBeInTheDocument()
    expect(screen.queryByText('A-103')).not.toBeInTheDocument()
  }

  it('🔴 panel: al cerrar, `principalId` se limpia en el mismo render; cerrar no pide nada y reabrir con datos viejos pide UNA página', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { qc, cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    cambiar({ emisorId: 'e1', principalId: undefined, open: false })
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
    await envejecer(qc)
    await reabrirYContar(cambiar, { emisorId: 'e1', principalId: 'g1', open: true })
  })

  it('🔴 Configuración: al cerrar, `emisorId` pasa a `null`; cerrar no pide nada y reabrir con datos viejos pide UNA página', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { qc, cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    cambiar({ emisorId: null, principalId: undefined, open: false })
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
    await envejecer(qc)
    await reabrirYContar(cambiar, { emisorId: 'e1', principalId: 'g1', open: true })
  })

  it('🔴 sub-diálogo de la complementaria (la llave no cambia): cerrar no pide nada y reabrir con datos viejos pide UNA página', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { qc, cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    cambiar({ emisorId: 'e1', principalId: 'g1', open: false })
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
    await envejecer(qc)
    await reabrirYContar(cambiar, { emisorId: 'e1', principalId: 'g1', open: true })
  })

  it('🔴 salir de la pantalla con el listado abierto (se desmonta) también lo recorta: al volver con datos viejos pide UNA página', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { qc, desmontar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    desmontar()
    await envejecer(qc)
    const { cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: false }, qc)
    await reabrirYContar(cambiar, { emisorId: 'e1', principalId: 'g1', open: true })
  })

  it('🔴 recortar no rejuvenece: la llave conserva la fecha de sus datos, así que lo viejo sigue viejo al reabrir', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { qc, cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    const antes = qc.getQueryState(LLAVE)!.dataUpdatedAt
    await unRato()
    cambiar({ emisorId: 'e1', principalId: 'g1', open: false })
    await unRato()
    const despues = qc.getQueryState<{ pages: unknown[] }>(LLAVE)!
    expect(despues.data!.pages).toHaveLength(1)
    expect(despues.dataUpdatedAt).toBe(antes)
  })

  it('🔴 una llave que ya estaba invalidada al cerrar sigue invalidada: al reabrir (aun dentro del minuto) pide UNA página', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { qc, cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    await envejecer(qc)
    cambiar({ emisorId: 'e1', principalId: undefined, open: false })
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
    await reabrirYContar(cambiar, { emisorId: 'e1', principalId: 'g1', open: true })
  })

  it('🔴 reabrir dentro del minuto (datos frescos) no pide nada y enseña sólo la primera página', async () => {
    m.getGlobalExcluidas.mockImplementation(TRES_PAGINAS)
    const { cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    await cargarTresPaginas()
    cambiar({ emisorId: 'e1', principalId: undefined, open: false })
    await unRato()
    cambiar({ emisorId: 'e1', principalId: 'g1', open: true })
    await screen.findByText('A-101')
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
    expect(screen.queryByText('A-102')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: g.excluded.loadMore })).toBeInTheDocument()
  })

  it('🔴 cerrar con «Cargar más» en vuelo: la página que llega tarde no vuelve a pegarse, y al reabrir se pide UNA página', async () => {
    let soltar: (p: GlobalExcluidasPage) => void = () => {}
    m.getGlobalExcluidas.mockImplementation((_v: string, _e: string, q: { cursor?: string }) =>
      q.cursor
        ? new Promise<GlobalExcluidasPage>(r => {
            soltar = r
          })
        : TRES_PAGINAS(_v, _e, q),
    )
    const { qc, cambiar } = montar({ emisorId: 'e1', principalId: 'g1', open: true })
    fireEvent.click(await screen.findByRole('button', { name: g.excluded.loadMore }))
    await waitFor(() => expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(2))
    cambiar({ emisorId: 'e1', principalId: undefined, open: false })
    await unRato()
    await act(async () => soltar(pagina({ totales: null, excluidas: [venta('o2', 'A-102', 100, 'segunda')], siguiente: null })))
    await unRato()
    expect(qc.getQueryState<{ pages: unknown[] }>(LLAVE)!.data!.pages).toHaveLength(1)
    cambiar({ emisorId: 'e1', principalId: 'g1', open: true })
    await screen.findByText('A-101')
    await unRato()
    expect(m.getGlobalExcluidas).toHaveBeenCalledTimes(3)
    expect(m.getGlobalExcluidas).toHaveBeenLastCalledWith('v1', 'e1', { principalId: 'g1' })
    expect(screen.queryByText('A-102')).not.toBeInTheDocument()
  })
})
