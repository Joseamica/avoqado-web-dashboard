/**
 * IVA por producto (plan B3b, Tarea 3): una venta VIEJA de IVA mixto sin contrato de precio no se
 * factura hasta que alguien confirme que su precio ya incluía IVA. El 422 de «Facturar» trae la vista
 * previa en `priceContract`, y el MISMO diálogo ofrece confirmar — nunca con `window.confirm`.
 *
 * 🔴 Lo que estas pruebas fijan:
 *   - el botón sólo aparece si la vista previa es confirmable Y la persona tiene `cfdi:configure`
 *     (la misma regla que el servidor);
 *   - al confirmar se manda la `version` y la `huella` que la persona vio, y se vuelve a facturar con
 *     los MISMOS datos del receptor;
 *   - si la venta cambió entre la vista y el clic (409), se dice y «Facturar» queda disponible;
 *   - cuando ya no hay nada que confirmar (otro motivo, producto por revisar, no confirmable), el
 *     botón NO vuelve a ofrecerse.
 *
 * Los hooks de TanStack Query corren de verdad: lo que se simula es el servicio HTTP, para afirmar
 * exactamente qué se le manda al servidor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import es from '@/locales/es/cfdi.json'
import en from '@/locales/en/cfdi.json'
import type { PriceContractPreview } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const get = (k: string) => k.split('.').reduce<any>((o, p) => o?.[p], es as any)
  // i18next: con `count`, la forma plural de la llave (`_one` / `_other`, la regla de es) gana si existe.
  const plural = typeof opts?.count === 'number' ? get(`${key}_${opts.count === 1 ? 'one' : 'other'}`) : undefined
  const raw = typeof plural === 'string' ? plural : get(key)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

// `mockReset: true` en la config borra la implementación de cada vi.fn() antes de cada prueba: cada
// prueba dice qué contesta el servidor.
const svc = vi.hoisted(() => ({ issueCfdiForOrder: vi.fn(), confirmPriceContract: vi.fn() }))
vi.mock('@/services/cfdi.service', () => ({ default: svc, cfdiService: svc }))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1' }) }))

const permisos = vi.hoisted(() => ({ actuales: new Set<string>() }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => permisos.actuales.has(p) }),
}))

// La fecha va en el timezone del venue; aquí basta con saber que se pinta la de la venta.
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: (d: string) => `día ${String(d).slice(0, 10)}` }),
}))

// Los selectores del SAT (régimen, uso) son popovers que jsdom no maneja bien. El esquema y el submit
// del diálogo siguen siendo los reales: sólo se cambian los controles por inputs simples.
vi.mock('../receptor-fields', () => ({
  ReceptorFields: ({ form }: { form: UseFormReturn<any> }) => (
    <div>
      {(['rfc', 'razonSocial', 'regimenFiscal', 'codigoPostal', 'usoCfdi', 'email'] as const).map(name => (
        <input key={name} aria-label={name} {...form.register(name)} />
      ))}
    </div>
  ),
}))

import { IssueCfdiDialog } from '../IssueCfdiDialog'
import { DURACION_AVISO_LARGO_MS } from '../issueCfdiErrors'

const RECEPTOR = {
  rfc: 'MAV010101AB1',
  razonSocial: 'MAVERICKS',
  regimenFiscal: '601',
  codigoPostal: '06000',
  usoCfdi: 'G03',
}

const MOTIVO_CONFIRMALO =
  'Esta venta tiene productos con IVA distinto de 16 % y no consta que se cobró con IVA incluido; confírmalo antes de facturar.'
const MOTIVO_CARGO_SERVICIO = 'La cuenta lleva cargo por servicio; la facturación de cargos por servicio llega en la siguiente versión.'
const MOTIVO_PRODUCTO_POR_REVISAR =
  '«GRN TURISMO 2 KG»: Hay un producto con objeto de impuesto 03, que la facturación todavía no soporta; corrígelo en el producto antes de facturar.'
const MOTIVO_NO_CONFIRMABLE = 'Esta venta trae un ajuste de IVA del motor de descuentos anterior; no se puede confirmar hasta revisarla.'

const VISTA: PriceContractPreview = {
  orderId: 'order-1',
  orderNumber: 'ORD-1042',
  createdAt: '2026-09-15T18:30:00.000Z',
  totalMxn: 6040,
  taxAmountMxn: 0,
  source: 'TPV',
  contratoActual: 'DESCONOCIDO',
  version: 7,
  status: 'COMPLETED',
  paymentStatus: 'PAID',
  paidAmountMxn: 6040,
  confirmable: true,
  huella: 'h-7',
}

const errorHttp = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })

const pc = es.issueDialog.priceContract

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueCfdiDialog open onOpenChange={() => {}} orderId="order-1" />
    </QueryClientProvider>,
  )
}

function llenarReceptor(receptor: Record<string, string> = RECEPTOR) {
  for (const [name, value] of Object.entries(receptor)) {
    fireEvent.change(screen.getByLabelText(name), { target: { value } })
  }
}

/** Otra razón social: la que se captura al REABRIR el diálogo (Codex B3b r1 P1 #1). */
const OTRO_RECEPTOR = {
  rfc: 'OTR020202CD2',
  razonSocial: 'OTRO CLIENTE',
  regimenFiscal: '612',
  codigoPostal: '64000',
  usoCfdi: 'G01',
}

/** El diálogo con `open` controlable desde la prueba (cerrar y reabrir SIN desmontarlo, como en OrderActionsSheet). */
function renderDialogControlado() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ui = (open: boolean) => (
    <QueryClientProvider client={queryClient}>
      <IssueCfdiDialog open={open} onOpenChange={() => {}} orderId="order-1" />
    </QueryClientProvider>
  )
  const r = render(ui(true))
  return { cerrar: () => r.rerender(ui(false)), abrir: () => r.rerender(ui(true)) }
}

function diferido<T>() {
  let resolve!: (valor: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Espera un rato a que NO llegue un segundo «Facturar»: si llega, la prueba cae. */
async function sinSegundoFacturar() {
  const llego = await waitFor(
    () => {
      expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(2)
    },
    { timeout: 400 },
  ).then(
    () => true,
    () => false,
  )
  expect(llego).toBe(false)
}

const facturar = () => fireEvent.click(screen.getByRole('button', { name: es.issueDialog.submit }))
const botonConfirmar = () => screen.queryByRole('button', { name: pc.confirmButton })
const tocarConfirmar = () => fireEvent.click(screen.getByRole('button', { name: pc.confirmButton }))

/** Abre el diálogo, llena el receptor y factura; espera a que aparezcan los motivos del 422. */
async function facturarHasta422(primerMotivo: string) {
  renderDialog()
  llenarReceptor()
  facturar()
  await screen.findByText(primerMotivo)
}

describe('IssueCfdiDialog — confirmar que el precio ya incluía IVA', () => {
  beforeEach(() => {
    permisos.actuales = new Set(['cfdi:issue', 'cfdi:view', 'cfdi:configure'])
  })

  it('confirmable + cfdi:configure ⇒ ofrece confirmar, enseña la venta, manda version+huella y vuelve a facturar con el mismo receptor', async () => {
    svc.issueCfdiForOrder
      .mockRejectedValueOnce(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }))
      .mockResolvedValueOnce({ cfdi: { id: 'c1', uuid: 'UUID-1', serie: 'A', folio: '20', status: 'STAMPED', xmlUrl: null, pdfUrl: null } })
    svc.confirmPriceContract.mockResolvedValue({ ok: true })

    await facturarHasta422(MOTIVO_CONFIRMALO)

    tocarConfirmar()

    // El resumen de lo que se va a confirmar: venta, fecha (del venue) y total.
    expect(screen.getByText('#ORD-1042')).toBeInTheDocument()
    expect(screen.getByText('día 2026-09-15')).toBeInTheDocument()
    expect(screen.getByText(/6,040\.00/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: pc.confirmYes }))

    await waitFor(() => expect(svc.confirmPriceContract).toHaveBeenCalledWith('venue-1', 'order-1', 7, 'h-7'))
    await waitFor(() => expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(2))
    expect(svc.issueCfdiForOrder.mock.calls[1]).toEqual(svc.issueCfdiForOrder.mock.calls[0])
    expect(svc.issueCfdiForOrder.mock.calls[1]).toEqual(['venue-1', 'order-1', RECEPTOR])
  })

  it('tras confirmar, si queda otro motivo (cargo por servicio) ⇒ se ve ese motivo y ya NO se ofrece confirmar', async () => {
    svc.issueCfdiForOrder
      .mockRejectedValueOnce(
        errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO, MOTIVO_CARGO_SERVICIO], priceContract: VISTA }),
      )
      .mockRejectedValueOnce(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CARGO_SERVICIO] }))
    svc.confirmPriceContract.mockResolvedValue({ ok: true })

    await facturarHasta422(MOTIVO_CONFIRMALO)
    tocarConfirmar()
    fireEvent.click(screen.getByRole('button', { name: pc.confirmYes }))

    await waitFor(() => expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(MOTIVO_CONFIRMALO)).not.toBeInTheDocument())
    expect(screen.getByText(MOTIVO_CARGO_SERVICIO)).toBeInTheDocument()
    expect(botonConfirmar()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: pc.confirmYes })).not.toBeInTheDocument()
  })

  it('producto por revisar (el servidor no trae priceContract) ⇒ se ve su motivo y no hay botón', async () => {
    svc.issueCfdiForOrder.mockRejectedValueOnce(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_PRODUCTO_POR_REVISAR] }))

    await facturarHasta422(MOTIVO_PRODUCTO_POR_REVISAR)

    expect(botonConfirmar()).not.toBeInTheDocument()
    expect(screen.queryByText(pc.askOwner)).not.toBeInTheDocument()
  })

  it('🔴 la venta cambió entre la vista y el clic (409 CAMBIO_DESDE_LA_VISTA) ⇒ se ve el texto DEL DASHBOARD (no el del MCP) y «Facturar» queda disponible', async () => {
    const textoServidor = 'La venta cambió desde que la revisaste. Vuelve a pedir la vista previa.'
    svc.issueCfdiForOrder.mockRejectedValueOnce(
      errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }),
    )
    svc.confirmPriceContract.mockRejectedValueOnce(errorHttp(409, { error: textoServidor, code: 'CAMBIO_DESDE_LA_VISTA' }))

    await facturarHasta422(MOTIVO_CONFIRMALO)
    tocarConfirmar()
    fireEvent.click(screen.getByRole('button', { name: pc.confirmYes }))

    const textoDashboard = es.issueDialog.priceContract.changedSinceReview.replace('{{submit}}', es.issueDialog.submit)
    expect(await screen.findByText(textoDashboard)).toBeInTheDocument()
    // El texto del servidor habla del MCP («vista previa»): el diálogo no lo muestra para este código.
    expect(screen.queryByText(textoServidor)).not.toBeInTheDocument()
    expect(screen.queryByText(/vista previa/i)).not.toBeInTheDocument()
    // No se volvió a facturar sola, y el botón para hacerlo (que trae una vista previa nueva) está disponible.
    expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: es.issueDialog.submit })).toBeEnabled()
    // La vista vieja ya no sirve: no se ofrece confirmarla otra vez con la misma huella.
    expect(botonConfirmar()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: pc.confirmYes })).not.toBeInTheDocument()
  })

  it('vista previa NO confirmable ⇒ se ve su motivo (ya viene en reasons) y no hay botón', async () => {
    svc.issueCfdiForOrder.mockRejectedValueOnce(
      errorHttp(422, {
        error: 'No se pudo facturar',
        reasons: [MOTIVO_NO_CONFIRMABLE],
        priceContract: { ...VISTA, confirmable: false, motivo: MOTIVO_NO_CONFIRMABLE },
      }),
    )

    await facturarHasta422(MOTIVO_NO_CONFIRMABLE)

    expect(botonConfirmar()).not.toBeInTheDocument()
    expect(screen.queryByText(pc.askOwner)).not.toBeInTheDocument()
  })

  /**
   * 🔴 Codex (B3b, código r1, P1 #1): tras confirmar, el reenvío automático leía el formulario EN ESE MOMENTO. El
   * diálogo se puede cerrar mientras confirma y, al reabrirlo, se reinicia el mismo formulario: si la persona capturaba
   * otro receptor, la confirmación vieja terminaba facturando LA VENTA ORIGINAL CON EL RFC NUEVO, sin que nadie
   * tocara «Emitir».
   */
  it.each([
    ['OTRO receptor', OTRO_RECEPTOR],
    ['el MISMO receptor otra vez', RECEPTOR],
  ])('🔴 confirmación en vuelo + cerrar + reabrir + %s ⇒ NO se factura sola: sólo «Emitir» factura', async (_caso, receptorNuevo) => {
    svc.issueCfdiForOrder
      .mockRejectedValueOnce(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }))
      .mockResolvedValueOnce({ cfdi: { id: 'c1', uuid: 'UUID-1', serie: 'A', folio: '20', status: 'STAMPED', xmlUrl: null, pdfUrl: null } })
    const confirmacion = diferido<{ ok: true }>()
    svc.confirmPriceContract.mockReturnValueOnce(confirmacion.promise)

    const dialogo = renderDialogControlado()
    llenarReceptor()
    facturar()
    await screen.findByText(MOTIVO_CONFIRMALO)
    tocarConfirmar()
    fireEvent.click(screen.getByRole('button', { name: pc.confirmYes }))
    await waitFor(() => expect(svc.confirmPriceContract).toHaveBeenCalledWith('venue-1', 'order-1', 7, 'h-7'))

    // Mientras la confirmación sigue en vuelo: cerrar, reabrir y capturar OTRO receptor sin tocar «Emitir».
    dialogo.cerrar()
    dialogo.abrir()
    llenarReceptor(receptorNuevo)
    expect(screen.queryByText(MOTIVO_CONFIRMALO)).not.toBeInTheDocument()

    await act(async () => {
      confirmacion.resolve({ ok: true })
      await confirmacion.promise
    })
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: pc.confirmed })))
    await sinSegundoFacturar()
    expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(1)

    // La persona sigue mandando: «Emitir» factura lo que ELLA ve en pantalla.
    facturar()
    await waitFor(() => expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(2))
    expect(svc.issueCfdiForOrder.mock.calls[1]).toEqual(['venue-1', 'order-1', receptorNuevo])
  })

  it('confirmación con el diálogo abierto pero el receptor EDITADO tras el 422 ⇒ no se factura sola, se limpia el «confírmalo» y factura ella', async () => {
    svc.issueCfdiForOrder
      .mockRejectedValueOnce(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }))
      .mockResolvedValueOnce({ cfdi: { id: 'c1', uuid: 'UUID-1', serie: 'A', folio: '20', status: 'STAMPED', xmlUrl: null, pdfUrl: null } })
    svc.confirmPriceContract.mockResolvedValue({ ok: true })

    await facturarHasta422(MOTIVO_CONFIRMALO)
    // Antes de confirmar, la persona corrige el RFC: el intento del 422 ya no es lo que está en pantalla.
    fireEvent.change(screen.getByLabelText('rfc'), { target: { value: OTRO_RECEPTOR.rfc } })
    tocarConfirmar()
    fireEvent.click(screen.getByRole('button', { name: pc.confirmYes }))

    await waitFor(() => expect(svc.confirmPriceContract).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(MOTIVO_CONFIRMALO)).not.toBeInTheDocument())
    await sinSegundoFacturar()
    expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(1)
    // Aviso PERSISTENTE en el diálogo (no sólo el toast): ya quedó confirmado y falta tocar «Emitir factura».
    const avisoListo = pc.confirmedManual.replace('{{submit}}', es.issueDialog.submit)
    expect(screen.getByText(avisoListo)).toBeInTheDocument()

    facturar()
    await waitFor(() => expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(2))
    expect(svc.issueCfdiForOrder.mock.calls[1]).toEqual(['venue-1', 'order-1', { ...RECEPTOR, rfc: OTRO_RECEPTOR.rfc }])
    // Al facturar de nuevo el aviso ya no aplica.
    await waitFor(() => expect(screen.queryByText(avisoListo)).not.toBeInTheDocument())
  })

  // Codex (B3b, código r2, N2): Zod recorta los espacios al enviar (" MAVERICKS " ⇒ "MAVERICKS") y así quedó guardado el
  // intento; compararlo contra el formulario SIN normalizar hacía creer que la persona lo había editado y no se reenviaba.
  it('receptor con espacios de sobra y SIN editar ⇒ tras confirmar se reenvía el intento guardado (normalizado)', async () => {
    svc.issueCfdiForOrder
      .mockRejectedValueOnce(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }))
      .mockResolvedValueOnce({ cfdi: { id: 'c1', uuid: 'UUID-1', serie: 'A', folio: '20', status: 'STAMPED', xmlUrl: null, pdfUrl: null } })
    svc.confirmPriceContract.mockResolvedValue({ ok: true })

    renderDialog()
    llenarReceptor({ ...RECEPTOR, razonSocial: '  MAVERICKS  ', rfc: ' mav010101ab1 ' })
    facturar()
    await screen.findByText(MOTIVO_CONFIRMALO)
    expect(svc.issueCfdiForOrder.mock.calls[0]).toEqual(['venue-1', 'order-1', RECEPTOR])

    tocarConfirmar()
    fireEvent.click(screen.getByRole('button', { name: pc.confirmYes }))

    await waitFor(() => expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(2))
    expect(svc.issueCfdiForOrder.mock.calls[1]).toEqual(['venue-1', 'order-1', RECEPTOR])
  })

  it('un 422 que llega DESPUÉS de cerrar y reabrir no pinta motivos ni ofrece confirmar en la sesión nueva', async () => {
    const factura = diferido<never>()
    svc.issueCfdiForOrder.mockReturnValueOnce(factura.promise)

    const dialogo = renderDialogControlado()
    llenarReceptor()
    facturar()
    await waitFor(() => expect(svc.issueCfdiForOrder).toHaveBeenCalledTimes(1))
    dialogo.cerrar()
    dialogo.abrir()

    await act(async () => {
      factura.reject(errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }))
      await factura.promise.catch(() => {})
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByText(MOTIVO_CONFIRMALO)).not.toBeInTheDocument()
    expect(botonConfirmar()).not.toBeInTheDocument()
  })

  it('sin cfdi:configure (MANAGER de fábrica) ⇒ «Pídele al dueño o a un administrador que lo confirme», sin botón', async () => {
    permisos.actuales = new Set(['cfdi:issue', 'cfdi:view'])
    svc.issueCfdiForOrder.mockRejectedValueOnce(
      errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO], priceContract: VISTA }),
    )

    renderDialog()
    llenarReceptor()
    facturar()
    await screen.findByText(pc.askOwner)

    // La tarjeta ya explica qué hacer: la lista roja no repite «confírmalo» (que contradice «Pídele al dueño»).
    expect(screen.queryByText(MOTIVO_CONFIRMALO)).not.toBeInTheDocument()
    expect(screen.queryByText(/confírmalo/i)).not.toBeInTheDocument()
    expect(botonConfirmar()).not.toBeInTheDocument()
    expect(svc.confirmPriceContract).not.toHaveBeenCalled()
  })

  it('sin cfdi:configure pero con OTRO motivo en la lista ⇒ el otro motivo se ve y sólo se oculta el «confírmalo»', async () => {
    permisos.actuales = new Set(['cfdi:issue', 'cfdi:view'])
    svc.issueCfdiForOrder.mockRejectedValueOnce(
      errorHttp(422, { error: 'No se pudo facturar', reasons: [MOTIVO_CONFIRMALO, MOTIVO_CARGO_SERVICIO], priceContract: VISTA }),
    )

    await facturarHasta422(MOTIVO_CARGO_SERVICIO)

    expect(screen.queryByText(MOTIVO_CONFIRMALO)).not.toBeInTheDocument()
    expect(screen.getByText(pc.askOwner)).toBeInTheDocument()
  })

  it('el encabezado de motivos es neutro («No se pudo facturar:»), sin pedir «corregir»', () => {
    expect(es.issueDialog.errors.validation).toBe('No se pudo facturar:')
  })
})

// C2 · ronda QA (D1): con el PAC sin contestar, la factura quedó EN DUDA (el servidor manda `timbreEnDuda`): el aviso no dice «rechazó».
describe('IssueCfdiDialog — 502: en duda no es rechazo (ronda QA, D1)', () => {
  beforeEach(() => {
    permisos.actuales = new Set(['cfdi:issue', 'cfdi:view', 'cfdi:configure'])
  })
  it.each([
    [
      '🔴 en duda ⇒ «No hubo respuesta clara del PAC» y que no la vuelva a emitir (nunca «fetch failed»)',
      { error: 'El PAC rechazó el timbrado', message: 'fetch failed', cfdiId: 'c1', timbreEnDuda: true },
      es.issueDialog.errors.pacNoAnswer,
      es.issueDialog.errors.pacNoAnswerDetail,
      // C2-pulido (G5), cambia A PROPÓSITO: «en espera» no es un error ⇒ ámbar (`warning`), no rojo.
      'warning',
      // C2-pulido (M2), cambia A PROPÓSITO: trae una instrucción («No la vuelvas a emitir…») ⇒ dura lo de los avisos largos.
      { duration: DURACION_AVISO_LARGO_MS },
    ],
    [
      'control — rechazo (o servidor viejo) ⇒ «rechazó» + el porqué del PAC',
      { error: 'El PAC rechazó el timbrado', message: 'RFC del receptor inválido', cfdiId: 'c1' },
      es.issueDialog.errors.pacRejected,
      'RFC del receptor inválido',
      'destructive',
      // control (M2): el rechazo dura lo de siempre (sin `duration`).
      {},
    ],
  ])('%s', async (_caso, data, title, description, variant, extra) => {
    svc.issueCfdiForOrder.mockRejectedValueOnce(errorHttp(502, data))
    renderDialog()
    llenarReceptor()
    facturar()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title, description, variant, ...extra }))
  })
})

// D2 del /full-testing: «Esta venta se devolvió completa» es una situación normal, no un error: salía en rojo.
describe('IssueCfdiDialog — 409: venta devuelta completa no es un error (F6, D2)', () => {
  beforeEach(() => {
    permisos.actuales = new Set(['cfdi:issue', 'cfdi:view', 'cfdi:configure'])
  })
  it.each([
    [
      '🔴 CFDI_VENTA_DEVUELTA ⇒ aviso ÁMBAR (no destructivo) con el texto del dashboard',
      { code: 'CFDI_VENTA_DEVUELTA', error: 'Esta venta se devolvió completa: no hay nada que facturar.' },
      es.issueDialog.errors.saleRefunded,
      es.issueDialog.errors.saleRefundedDetail,
      'warning',
    ],
    [
      'control — ya tiene factura vigente ⇒ sigue en rojo',
      { code: 'CFDI_ALREADY_ISSUED', error: 'Esta venta ya tiene la factura F-1 vigente.' },
      es.issueDialog.errors.alreadyIssued,
      'Esta venta ya tiene la factura F-1 vigente.',
      'destructive',
    ],
  ])('%s', async (_caso, data, title, description, variant) => {
    svc.issueCfdiForOrder.mockRejectedValueOnce(errorHttp(409, data))
    renderDialog()
    llenarReceptor()
    facturar()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title, description, variant })))
  })
})

describe('IssueCfdiDialog — F6: la factura de una venta con devolución', () => {
  beforeEach(() => {
    permisos.actuales = new Set(['cfdi:issue', 'cfdi:view', 'cfdi:configure'])
  })
  const emitida = { id: 'c1', uuid: 'U-1', serie: 'F', folio: '9', status: 'STAMPED', xmlUrl: null, pdfUrl: null }
  async function facturarCon(respuesta: Record<string, unknown>) {
    svc.issueCfdiForOrder.mockResolvedValue(respuesta)
    renderDialog()
    llenarReceptor()
    facturar()
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    return toast.mock.calls[0][0]
  }
  it('🔴 N10: notas automáticas PENDIENTES ⇒ aviso ÁMBAR largo con CUÁNTAS faltan y el folio; el motivo de cada una vive en su pago', async () => {
    const aviso = await facturarCon({
      cfdi: emitida,
      devoluciones: 'CON_NOTA',
      notasDeDevolucion: [
        { refundPaymentId: 'r1', status: 'PENDIENTE', motivo: 'Falta el XML de la factura.' },
        { refundPaymentId: 'r2', status: 'PENDIENTE', motivo: 'Falta el XML de la factura.' },
      ],
    })
    expect(aviso).toMatchObject({
      title: 'La factura se emitió; faltan 2 notas de crédito de devoluciones',
      variant: 'warning',
      duration: DURACION_AVISO_LARGO_MS,
    })
    expect(aviso.description).toContain('F-9')
    expect(aviso.description).not.toContain('Falta el XML') // ni concatenados ni repetidos
    expect(aviso.description).not.toMatch(/reintentamos/i)
  })
  it('🔴 D3 (full-testing integral 15-oct): UNA nota pendiente ⇒ el aviso va en singular, no «…que faltan: 1»', async () => {
    const aviso = await facturarCon({
      cfdi: emitida,
      devoluciones: 'CON_NOTA',
      notasDeDevolucion: [{ refundPaymentId: 'r1', status: 'PENDIENTE', motivo: 'Falta el XML de la factura.' }],
    })
    expect(aviso.title).toBe('La factura se emitió; falta 1 nota de crédito de una devolución')
  })
  it('las notas salieron ⇒ el éxito lo dice', async () => {
    const aviso = await facturarCon({
      cfdi: emitida,
      devoluciones: 'CON_NOTA',
      notasDeDevolucion: [{ refundPaymentId: 'r1', status: 'STAMPED', folio: 'NC-3' }],
    })
    expect(aviso.title).toBe(es.issueDialog.toast.success)
    expect(aviso.description).toContain('También se emitió la nota de crédito de la devolución.')
  })
  // D3 del /full-testing: con 2 notas el aviso decía «la nota de crédito de la devolución», en singular.
  it('🔴 D3: varias notas salieron ⇒ el éxito lo dice en PLURAL (es y en); con una, en singular', async () => {
    const dos = await facturarCon({
      cfdi: emitida,
      devoluciones: 'CON_NOTA',
      notasDeDevolucion: [
        { refundPaymentId: 'r1', status: 'STAMPED', folio: 'NC-3' },
        { refundPaymentId: 'r2', status: 'STAMPED', folio: 'NC-4' },
      ],
    })
    expect(dos.description).toContain('También se emitieron las notas de crédito de las devoluciones.')
    expect(dos.description).not.toContain('la nota de crédito de la devolución')
    const t = en.issueDialog.toast as Record<string, string>
    expect(t.successWithNote_one).toBe("The refund's credit note was issued too.")
    expect(t.successWithNote_other).toBe("The refunds' credit notes were issued too.")
  })
  it('🔴 la factura salió sólo con lo que el cliente se quedó ⇒ el éxito lo explica (el total es menor que la venta a propósito)', async () => {
    const aviso = await facturarCon({ cfdi: emitida, devoluciones: 'DESCONTADAS' })
    expect(aviso.title).toBe(es.issueDialog.toast.success)
    expect(aviso.description).toContain(es.issueDialog.toast.successNet)
    expect(aviso.duration).toBe(DURACION_AVISO_LARGO_MS)
  })
  it('control — sin devoluciones, el aviso de éxito de siempre', async () => {
    const aviso = await facturarCon({ cfdi: emitida })
    expect(aviso).toEqual({ title: es.issueDialog.toast.success, description: 'Folio F-9 · UUID U-1' })
  })
})
