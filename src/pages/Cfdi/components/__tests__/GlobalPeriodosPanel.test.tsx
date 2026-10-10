/**
 * C1 · Tarea 13 — el panel de periodos RECIENTES de la factura global (C1-P16 = B: sin «periodos anteriores»; uno más viejo se
 * pide a soporte). «Emitir» manda el `desde` del periodo tal cual; «Emitir complementaria» va por el id de la principal (C1-25).
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/cfdi.json'
import en from '@/locales/en/cfdi.json'
import type { GlobalDeOtraPeriodicidad, PeriodoDeLaGlobal } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
// I3 (ronda 1): el negocio está en Tijuana. Si la pantalla escribiera el periodo con la fecha del NEGOCIO, el día 4 de CDMX saldría «3 oct».
vi.mock('@/utils/datetime', async () => {
  const { DateTime } = await import('luxon')
  const enTijuana = (d: string | Date) =>
    (typeof d === 'string' ? DateTime.fromISO(d, { zone: 'utc' }) : DateTime.fromJSDate(d))
      .setZone('America/Tijuana')
      .setLocale('es-MX')
      .toLocaleString(DateTime.DATE_MED)
  return { useVenueDateTime: () => ({ formatDate: enTijuana, formatDateTime: enTijuana }) }
})

const m = vi.hoisted(() => ({ getGlobalPeriodos: vi.fn(), triggerGlobalCfdi: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/cfdi.service', () => ({
  default: { getGlobalPeriodos: m.getGlobalPeriodos, triggerGlobalCfdi: m.triggerGlobalCfdi },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
// Los dos diálogos tienen sus propias pruebas: aquí sólo importa CON QUÉ se abren.
vi.mock('../GlobalComplementariaDialog', () => ({
  GlobalComplementariaDialog: ({ emisorId, principalId }: { emisorId: string | null; principalId: string | null }) =>
    principalId ? <div data-testid="complementaria">{`${emisorId}:${principalId}`}</div> : null,
}))
vi.mock('../GlobalExcluidasDialog', () => ({
  GlobalExcluidasDialog: ({ open, principalId, desde }: { open: boolean; principalId?: string; desde?: string }) =>
    open ? <div data-testid="excluidas">{principalId ?? desde}</div> : null,
}))

import { GlobalPeriodosPanel } from '../GlobalPeriodosPanel'

const g = es.globalInvoice
const dia = (d: number) => `2026-10-0${d}T06:00:00.000Z`
const periodo = (d: number, over: Partial<PeriodoDeLaGlobal>): PeriodoDeLaGlobal => ({
  desde: dia(d),
  hasta: dia(d + 1),
  meses: '10',
  anio: 2026,
  estado: 'SIN_GLOBAL',
  cfdiId: null,
  folio: null,
  motivo: null,
  corregidasPendientes: null,
  complementarias: [],
  ...over,
})
const MOTIVO = 'Lo cobrado no coincide con sus productos; revísala o repórtala a soporte.'
const CUATRO: PeriodoDeLaGlobal[] = [
  periodo(6, {
    estado: 'TIMBRADA',
    cfdiId: 'g1',
    folio: 'G-10',
    corregidasPendientes: { n: 2, completo: true },
    complementarias: [{ cfdiId: 'g1c2', folio: 'G-11', estado: 'TIMBRADA' }],
  }),
  periodo(5, { estado: 'SIN_TIMBRAR', cfdiId: 'g2', motivo: MOTIVO }),
  periodo(4, { estado: 'SIN_GLOBAL' }),
  periodo(3, { estado: 'CANCELADA', cfdiId: 'g4', folio: 'G-8', corregidasPendientes: { n: 3, completo: false } }),
]

function pintar(csdStatus: 'ACTIVE' | 'EXPIRED' = 'ACTIVE') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <GlobalPeriodosPanel emisor={{ id: 'e1', csdStatus }} />
    </QueryClientProvider>,
  )
}
/** La forma real de `GET …/global/periodos` (T8 + T10): `periodos` y, aparte, `otrasPeriodicidades`. */
const respuesta = (periodos: PeriodoDeLaGlobal[], otras: GlobalDeOtraPeriodicidad[] = [], completo = true) => ({
  periodos,
  otrasPeriodicidades: { globales: otras, completo },
})
const fila = (d: number) => screen.getByTestId(`periodo-${dia(d)}`)
const confirmar = () => fireEvent.click(screen.getByRole('button', { name: g.confirm.confirm }))

describe('GlobalPeriodosPanel', () => {
  it('pinta cada periodo con su estado, el motivo del que no se timbró y sus complementarias; sin «periodos anteriores»: uno más viejo se pide a soporte', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(m.getGlobalPeriodos).toHaveBeenCalledWith('v1', 'e1')
    expect(fila(6)).toHaveTextContent(g.periods.stamped)
    expect(fila(6)).toHaveTextContent('G-11')
    expect(fila(6)).toHaveTextContent(g.periods.complementaries)
    expect(fila(5)).toHaveTextContent(g.periods.pending)
    expect(fila(5)).toHaveTextContent(MOTIVO)
    expect(fila(4)).toHaveTextContent(g.periods.missing)
    expect(fila(3)).toHaveTextContent(g.periods.cancelled)
    expect(screen.getByText(g.periods.olderAsk)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anterior/i })).not.toBeInTheDocument()
    // «Emitir» sólo donde no hay global timbrada ni cancelada.
    expect(within(fila(6)).queryByRole('button', { name: g.periods.issue })).not.toBeInTheDocument()
    expect(within(fila(3)).queryByRole('button', { name: g.periods.issue })).not.toBeInTheDocument()
  })

  it('🔴 «Emitir» en SIN_TIMBRAR y en SIN_GLOBAL llama al disparo con el `desde` de ESE periodo, tal cual; el aviso dice que se emite tarde', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    m.triggerGlobalCfdi.mockResolvedValue({
      cfdi: { id: 'gx', uuid: 'U', serie: 'G', folio: '12', globalPeriod: null, pdfUrl: null },
      excluidas: {},
    })
    pintar()
    await screen.findByTestId(`periodo-${dia(5)}`)

    fireEvent.click(within(fila(5)).getByRole('button', { name: g.periods.issue }))
    // M7 (a): timbrar es irreversible: nada sale antes de confirmar.
    expect(m.triggerGlobalCfdi).not.toHaveBeenCalled()
    confirmar()
    await waitFor(() => expect(m.triggerGlobalCfdi).toHaveBeenCalledWith('v1', 'e1', dia(5)))
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining(g.periods.issueLate) })),
    )

    fireEvent.click(within(fila(4)).getByRole('button', { name: g.periods.issue }))
    confirmar()
    await waitFor(() => expect(m.triggerGlobalCfdi).toHaveBeenCalledWith('v1', 'e1', dia(4)))
    expect(m.triggerGlobalCfdi).toHaveBeenCalledTimes(2)
  })

  it('🔴 «Emitir complementaria (2)» en el timbrado y «(al menos 3)» en el cancelado abren el diálogo con el id de SU principal', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    fireEvent.click(within(fila(6)).getByRole('button', { name: traducir('globalInvoice.periods.complementaryCount', { count: 2 }) }))
    expect(screen.getByTestId('complementaria').textContent).toBe('e1:g1')
    fireEvent.click(within(fila(3)).getByRole('button', { name: traducir('globalInvoice.periods.complementaryAtLeast', { count: 3 }) }))
    expect(screen.getByTestId('complementaria').textContent).toBe('e1:g4')
  })

  it('🔴 C1-27: con { n: 0, completo: false } el botón no lleva número y la ayuda dice «Hay más de 200…» (nunca «200 o más»); con { n: 0, completo: true } no hay botón', async () => {
    m.getGlobalPeriodos.mockResolvedValue(
      respuesta([
        periodo(6, { estado: 'TIMBRADA', cfdiId: 'g1', folio: 'G-10', corregidasPendientes: { n: 0, completo: false } }),
        periodo(5, { estado: 'TIMBRADA', cfdiId: 'g2', folio: 'G-9', corregidasPendientes: { n: 0, completo: true } }),
      ]),
    )
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(within(fila(6)).getByRole('button', { name: g.periods.complementary })).toBeInTheDocument()
    expect(fila(6)).toHaveTextContent(g.periods.complementaryUnknown)
    expect(fila(6)).not.toHaveTextContent('200 o más')
    expect(within(fila(5)).queryByRole('button', { name: /complementaria/ })).not.toBeInTheDocument()
  })

  it('🔴 un 409 dice «Se está emitiendo; intenta en un minuto»', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    m.triggerGlobalCfdi.mockRejectedValue({
      response: { status: 409, data: { error: 'La factura de esta venta se está procesando; intenta de nuevo en unos minutos.' } },
    })
    pintar()
    await screen.findByTestId(`periodo-${dia(4)}`)
    fireEvent.click(within(fila(4)).getByRole('button', { name: g.periods.issue }))
    confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: g.periods.busy, variant: 'destructive' })))
  })

  it('«Ver cuáles» abre el listado de excluidas: por el id de la principal si existe (C1-32), si no por el `desde` del periodo', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    fireEvent.click(within(fila(6)).getByRole('button', { name: g.excluded.see }))
    expect(screen.getByTestId('excluidas').textContent).toBe('g1')
    fireEvent.click(within(fila(4)).getByRole('button', { name: g.excluded.see }))
    expect(screen.getByTestId('excluidas').textContent).toBe(dia(4))
  })

  it('🔴 I3: con el negocio en Tijuana, el periodo que empieza el 4-oct en CDMX se llama «4 oct» en la fila y en la confirmación', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByTestId(`periodo-${dia(4)}`)
    expect(fila(4)).toHaveTextContent(/4 oct\.? 2026/)
    expect(fila(4)).not.toHaveTextContent(/3 oct/)
    fireEvent.click(within(fila(4)).getByRole('button', { name: g.periods.issue }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/4 oct\.? 2026/)
  })

  it('🔴 I2: un periodo SIN_GLOBAL que el job detuvo trae `motivo`: se ve el motivo y «escríbenos a soporte»', async () => {
    const DETENIDO = 'La entrada fiscal de esta factura requiere revisión de soporte.'
    m.getGlobalPeriodos.mockResolvedValue(respuesta([periodo(6, { estado: 'SIN_GLOBAL', motivo: DETENIDO })]))
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(fila(6)).toHaveTextContent(DETENIDO)
    expect(fila(6)).toHaveTextContent(g.periods.supportHint)
  })

  it('control — M7 (c): el periodo MÁS reciente no se emite «tarde»: ni la confirmación ni el aviso lo dicen', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta([periodo(6, { estado: 'SIN_GLOBAL' }), periodo(5, { estado: 'SIN_GLOBAL' })]))
    m.triggerGlobalCfdi.mockResolvedValue({
      status: 'NOTHING_TO_INVOICE',
      message: 'No hay tickets por facturar en el periodo.',
      excluidas: {},
    })
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    fireEvent.click(within(fila(6)).getByRole('button', { name: g.periods.issue }))
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(g.periods.issueLate)
    confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalled())
    expect(JSON.stringify(m.toast.mock.calls)).not.toContain(g.periods.issueLate)
  })

  it('🔴 M5 / M7 (a): con el CSD inactivo no pide los periodos ni ofrece «Emitir» ni «Emitir complementaria»', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar('EXPIRED')
    await new Promise(r => setTimeout(r, 30))
    expect(m.getGlobalPeriodos).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: g.periods.issue })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complementaria/ })).not.toBeInTheDocument()
  })

  const RECHAZO = 'El SAT rechazó: CFDI40147'
  const otra = (over: Partial<GlobalDeOtraPeriodicidad>): GlobalDeOtraPeriodicidad => ({
    cfdiId: 'b1',
    periodicidad: 'BIMESTRAL',
    desde: '2026-03-01T06:00:00.000Z',
    hasta: '2026-05-01T06:00:00.000Z',
    meses: '14',
    anio: 2026,
    estado: 'APARTADA',
    folio: null,
    motivo: 'Esta factura global bimestral ya tiene ventas apartadas; escríbenos a soporte para resolverla.',
    complementariaDe: null,
    ...over,
  })

  it('🔴 ronda 2 (T10): las globales de una periodicidad anterior van APARTE, sólo para mostrar: periodicidad, fechas, estado y motivo, SIN «Emitir»', async () => {
    m.getGlobalPeriodos.mockResolvedValue(
      respuesta(
        CUATRO,
        [
          otra({}),
          otra({
            cfdiId: 'c1',
            periodicidad: 'MENSUAL',
            estado: 'DETENIDA',
            motivo: 'Esta global complementaria espera a que una persona la emita.',
            complementariaDe: 'g0',
          }),
        ],
        false,
      ),
    )
    pintar()
    const seccion = await screen.findByTestId('otras-periodicidades')
    expect(seccion).toHaveTextContent(g.periods.other.title)
    const b1 = within(seccion).getByTestId('otra-b1')
    expect(b1).toHaveTextContent(es.periodicity.BIMESTRAL)
    expect(b1).toHaveTextContent(g.periods.other.estados.APARTADA)
    expect(b1).toHaveTextContent(/1 mar\.? 2026 – 30 abr\.? 2026/)
    expect(b1).toHaveTextContent('ventas apartadas; escríbenos a soporte')
    expect(within(seccion).getByTestId('otra-c1')).toHaveTextContent(g.periods.other.complementaria)
    expect(seccion).toHaveTextContent(g.periods.other.more)
    expect(within(seccion).queryByRole('button', { name: g.periods.issue })).not.toBeInTheDocument()
    // Nunca mezcladas con los periodos de hoy.
    expect(screen.getAllByTestId(/^periodo-/)).toHaveLength(4)
  })

  it('🔴 ronda 2 (revisión de la T12): «Ver cuáles» de una COMPLEMENTARIA manda el id de su PRINCIPAL (`complementariaDe`); el de una principal, el suyo', async () => {
    m.getGlobalPeriodos.mockResolvedValue(
      respuesta(CUATRO, [otra({}), otra({ cfdiId: 'c1', periodicidad: 'MENSUAL', estado: 'DETENIDA', complementariaDe: 'g0' })]),
    )
    pintar()
    const seccion = await screen.findByTestId('otras-periodicidades')
    fireEvent.click(within(within(seccion).getByTestId('otra-c1')).getByRole('button', { name: g.excluded.see }))
    expect(screen.getByTestId('excluidas').textContent).toBe('g0')
    fireEvent.click(within(within(seccion).getByTestId('otra-b1')).getByRole('button', { name: g.excluded.see }))
    expect(screen.getByTestId('excluidas').textContent).toBe('b1')
  })

  it('🔴 M4 (ola final): una global de otra periodicidad RECHAZADA dice «Rechazada al timbrar» (el dueño no sabe qué es un PAC), nunca «por el SAT»', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO, [otra({ estado: 'RECHAZADA', motivo: RECHAZO })]))
    pintar()
    const b1 = within(await screen.findByTestId('otras-periodicidades')).getByTestId('otra-b1')
    expect(b1).toHaveTextContent('Rechazada al timbrar')
    expect(b1).not.toHaveTextContent('Rechazada por el SAT')
    expect(en.globalInvoice.periods.other.estados.RECHAZADA).toBe('Rejected when stamping')
  })

  it('control — ronda 2: sin globales de otra periodicidad no hay sección', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(screen.queryByTestId('otras-periodicidades')).not.toBeInTheDocument()
  })

  it('🔴 ronda 2 (T11 m2 + decisión A): una complementaria rechazada muestra su motivo; la principal rechazada, su motivo y «Emitir»', async () => {
    m.getGlobalPeriodos.mockResolvedValue(
      respuesta([
        periodo(6, {
          estado: 'TIMBRADA',
          cfdiId: 'g1',
          folio: 'G-10',
          corregidasPendientes: { n: 0, completo: true },
          complementarias: [{ cfdiId: 'g1c2', folio: null, estado: 'SIN_TIMBRAR', motivo: RECHAZO }],
        }),
        periodo(5, { estado: 'SIN_TIMBRAR', cfdiId: 'g2', motivo: RECHAZO }),
      ]),
    )
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(fila(6)).toHaveTextContent(RECHAZO)
    expect(fila(5)).toHaveTextContent(RECHAZO)
    expect(within(fila(5)).getByRole('button', { name: g.periods.issue })).toBeEnabled()
  })

  it('🔴 N2 (re-revisión): si la carga falla, «Actualizar» la vuelve a pedir', async () => {
    m.getGlobalPeriodos.mockRejectedValueOnce({ response: { status: 524, data: 'error code: 524' } }).mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByText(g.periods.loadError)
    fireEvent.click(screen.getByRole('button', { name: g.periods.refresh }))
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(m.getGlobalPeriodos).toHaveBeenCalledTimes(2)
  })

  // Ola final, punto 6 (principio del founder: «apagado se VE y se EXPLICA»). Testarudo hoy: un RFC, 0 comercios en la global y el
  // interruptor de ventas fuera de la terminal apagado ⇒ el servidor manda `globalApagada: true`.
  it('🔴 6 (ola final): con `globalApagada: true` el panel explica que está apagada y cómo prenderla, SIN periodos, «Emitir» ni «Ver cuáles»', async () => {
    m.getGlobalPeriodos.mockResolvedValue({ ...respuesta(CUATRO, [otra({})]), globalApagada: true })
    pintar()
    await waitFor(() => expect(screen.queryByTestId('global-apagada')).toBeInTheDocument())
    const estado = screen.getByTestId('global-apagada')
    expect(estado).toHaveTextContent(g.off.title)
    expect(estado).toHaveTextContent(g.off.description)
    expect(estado).toHaveTextContent(g.off.howToTurnOn)
    expect(screen.queryAllByTestId(/^periodo-/)).toHaveLength(0)
    expect(screen.queryByRole('button', { name: g.periods.issue })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: g.excluded.see })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /complementaria/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('otras-periodicidades')).not.toBeInTheDocument()
    expect(screen.queryByText(g.periods.olderAsk)).not.toBeInTheDocument()
    // «Actualizar» se queda: si la prenden en otra pestaña u otro aparato, se ve sin salir de la pantalla.
    expect(screen.getByRole('button', { name: g.periods.refresh })).toBeEnabled()
  })

  it('control — 6 (ola final): los textos de «apagada» nombran los interruptores REALES de la pantalla, en `es` y en `en`', () => {
    const corta = (etiqueta: string) => etiqueta.split(' (')[0]
    for (const [loc, abre, cierra] of [
      [es, '«', '»'],
      [en, '"', '"'],
    ] as const) {
      const como = loc.globalInvoice.off.howToTurnOn
      expect(como).toContain(`${abre}${loc.merchants.title}${cierra}`)
      expect(como).toContain(`${abre}${loc.merchants.includeInGlobal}${cierra}`)
      expect(como).toContain(`${abre}${loc.merchants.facturacionEnabled}${cierra}`)
      expect(como).toContain(`${abre}${corta(loc.emisorForm.includeOffTerminalSalesInGlobal)}${cierra}`)
    }
  })

  it('control — 6 (ola final): con `globalApagada: false` o sin el campo (servidor anterior) el panel es el de siempre, sin el estado «apagada»', async () => {
    m.getGlobalPeriodos.mockResolvedValue({ ...respuesta(CUATRO), globalApagada: false })
    const { unmount } = pintar()
    await screen.findByTestId(`periodo-${dia(4)}`)
    expect(within(fila(4)).getByRole('button', { name: g.periods.issue })).toBeInTheDocument()
    expect(screen.queryByTestId('global-apagada')).not.toBeInTheDocument()
    unmount()

    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    pintar()
    await screen.findByTestId(`periodo-${dia(4)}`)
    expect(within(fila(4)).getByRole('button', { name: g.periods.issue })).toBeInTheDocument()
    expect(screen.queryByTestId('global-apagada')).not.toBeInTheDocument()
  })

  const pulsarVerCuales = async (count: number) => {
    await waitFor(() =>
      expect(m.toast.mock.calls.some(c => c[0].title === traducir('globalInvoice.excluded.summary', { count }))).toBe(true),
    )
    const accion = m.toast.mock.calls.map(c => c[0]).find(a => a.title === traducir('globalInvoice.excluded.summary', { count }))!.action
    act(() => accion.props.onClick())
  }

  it('control — N4 (re-revisión): «Ver cuáles» del aviso de una global timbrada abre el listado por el id de ESA global', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    m.triggerGlobalCfdi.mockResolvedValue({
      cfdi: { id: 'gx', uuid: 'U', serie: 'G', folio: '12', globalPeriod: null, pdfUrl: null },
      excluidas: { EFECTIVO: 2 },
    })
    pintar()
    await screen.findByTestId(`periodo-${dia(4)}`)
    fireEvent.click(within(fila(4)).getByRole('button', { name: g.periods.issue }))
    confirmar()
    await pulsarVerCuales(2)
    expect(screen.getByTestId('excluidas').textContent).toBe('gx')
  })

  it('control — N4: «Ver cuáles» de un 422 abre el listado del periodo que se pidió (por su `desde`)', async () => {
    m.getGlobalPeriodos.mockResolvedValue(respuesta(CUATRO))
    m.triggerGlobalCfdi.mockRejectedValue({
      response: { status: 422, data: { error: 'No se pudo generar la factura global', reasons: ['x'], excluidas: { NO_CUADRA: 3 } } },
    })
    pintar()
    await screen.findByTestId(`periodo-${dia(4)}`)
    fireEvent.click(within(fila(4)).getByRole('button', { name: g.periods.issue }))
    confirmar()
    await pulsarVerCuales(3)
    expect(screen.getByTestId('excluidas').textContent).toBe(dia(4))
  })
})

// Ronda QA (hermanos): un periodo SIN_TIMBRAR cuya global quedó EN DUDA (`timbreEnDuda`): se ve el motivo del servidor (que ya dice «no la
// vuelvas a emitir»), sin «escríbenos a soporte» (no hay nada que escalar: la conciliación la confirma sola).
describe('GlobalPeriodosPanel — ronda QA (hermanos): timbre en duda', () => {
  it('🔴 en duda ⇒ el motivo del servidor y SIN «escríbenos a soporte»; uno rechazado conserva el aviso de soporte', async () => {
    const EN_DUDA = 'No hubo respuesta clara del PAC: la factura global quedó en espera de confirmación…'
    m.getGlobalPeriodos.mockResolvedValue(
      respuesta([
        periodo(6, { estado: 'SIN_TIMBRAR', cfdiId: 'g6', motivo: EN_DUDA, timbreEnDuda: true }),
        periodo(5, { estado: 'SIN_TIMBRAR', cfdiId: 'g5', motivo: 'CFDI40999' }),
      ]),
    )
    pintar()
    await screen.findByTestId(`periodo-${dia(6)}`)
    expect(fila(6)).toHaveTextContent(EN_DUDA)
    expect(fila(6)).not.toHaveTextContent(g.periods.supportHint)
    expect(fila(5)).toHaveTextContent(g.periods.supportHint)
  })
})
