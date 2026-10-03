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
import type { PriceContractPreview } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
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
