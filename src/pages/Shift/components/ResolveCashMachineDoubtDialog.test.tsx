// Máquina de efectivo · fase 1a · B2 (R4-4): el gerente resuelve un cobro de la máquina que la PC no alcanzó a oír. La ventana
// replica la regla del SERVIDOR (`validarCierre`) para no mandar importes imposibles, manda CENTAVOS enteros y la hora del
// comprobante en ISO (zona del negocio), y si el folio ya se resolvió enseña lo que quedó registrado (409). Rediseño r3 del SERVIDOR:
// manda la `version` que ve el gerente; con 409 «llegó evidencia nueva» conserva lo tecleado y pide confirmar con la nueva; y dice si
// quedó la venta, una incidencia (dinero sin venta, con lo que se debe) o si se sigue terminando (202 RECIBIDO).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Currency } from '@/utils/currency'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}${JSON.stringify(o)}` : key) }),
}))
const h = vi.hoisted(() => ({
  impl: (..._a: unknown[]): Promise<unknown> => Promise.resolve({ status: 200, data: {} }),
  calls: [] as unknown[][],
  toast: vi.fn(),
}))
vi.mock('@/api', () => ({
  default: {
    post: (...a: unknown[]) => {
      h.calls.push(a)
      return h.impl(...a)
    },
  },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDateTime: (d: string) => `FECHA(${d})` }),
}))

import {
  ResolveCashMachineDoubtDialog,
  errorDeLaResolucion,
  horaDelComprobante,
  pesosACentavos,
  type CashMachineDoubt,
} from './ResolveCashMachineDoubtDialog'

const FOLIO = 'AQ0000000000A1'
const duda: CashMachineDoubt = {
  id: 'inc1',
  referenceCC: FOLIO,
  status: 'ABIERTO',
  deviceId: 'd1',
  createdAt: '2026-11-20T19:00:00.000Z',
  dueCents: 15000,
  saleCents: 13000,
  tipCents: 2000,
  startedAt: '2026-11-20T18:59:00.000Z',
  lastSeen: 'status: depositing 100',
  pedido: { items: [{ name: 'Café', quantity: 2 }] },
  saleShiftId: null,
  version: 4,
}

function setup(doubt: CashMachineDoubt = duda) {
  const onOpenChange = vi.fn()
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const ventana = (d: CashMachineDoubt) => (
    <QueryClientProvider client={client}>
      <ResolveCashMachineDoubtDialog open onOpenChange={onOpenChange} venueId="v1" doubt={d} />
    </QueryClientProvider>
  )
  const { rerender } = render(ventana(doubt))
  // La página le pasa la fila nueva de la lista (misma `key`): lo tecleado se queda.
  return { onOpenChange, invalidate, cambiarFila: (d: CashMachineDoubt) => rerender(ventana(d)) }
}

const rechazo = (status: number, data: Record<string, unknown>) =>
  Promise.reject(Object.assign(new Error(String(status)), { response: { status, data } }))

const P = 'cashMachineDoubts.resolve.'
const elegir = (outcome: 'PAGADO' | 'CANCELADO' | 'GUARDADO') =>
  fireEvent.click(screen.getByRole('radio', { name: `${P}outcomes.${outcome}.label` }))
const modo = (m: '1' | '2' | 'NO_SE') => fireEvent.click(screen.getByRole('radio', { name: `${P}cancelMode.${m}` }))
const recibio = (v: string) => fireEvent.change(screen.getByLabelText(`${P}received`), { target: { value: v } })
const devolvio = (v: string) => fireEvent.change(screen.getByLabelText(`${P}returned`), { target: { value: v } })
const hora = (v: string) => fireEvent.change(screen.getByLabelText(`${P}receiptTime`), { target: { value: v } })
const vio = (v: string) => fireEvent.change(screen.getByLabelText(`${P}evidence`), { target: { value: v } })
const guardar = () => screen.getByRole('button', { name: `${P}submit` })
const texto = () => document.body.textContent ?? ''

describe('pesosACentavos', () => {
  it('convierte a centavos enteros sin errores de punto flotante', () => {
    expect(pesosACentavos('10')).toBe(1000)
    expect(pesosACentavos('10.5')).toBe(1050)
    expect(pesosACentavos('10.05')).toBe(1005)
    expect(pesosACentavos('0.1')).toBe(10)
    expect(pesosACentavos('1.15')).toBe(115) // 1.15 * 100 = 114.99999999999999
    expect(pesosACentavos(' 200.50 ')).toBe(20050)
  })
  it('rechaza lo que no es un importe', () => {
    for (const malo of ['', '  ', '-1', '10.555', 'abc', '1e3', '.5', '1.']) expect(pesosACentavos(malo)).toBeNull()
  })
})

describe('horaDelComprobante', () => {
  it('lee la hora tecleada en la zona del NEGOCIO, no la del navegador', () => {
    expect(horaDelComprobante('2026-11-20T14:05', 'America/Mexico_City')).toBe('2026-11-20T20:05:00.000Z')
    expect(horaDelComprobante('2026-11-20T14:05', 'America/Tijuana')).toBe('2026-11-20T22:05:00.000Z')
  })
  it('vacía o inválida → null (la venta queda por conciliar)', () => {
    expect(horaDelComprobante('', 'America/Mexico_City')).toBeNull()
    expect(horaDelComprobante('ayer', 'America/Mexico_City')).toBeNull()
  })
})

describe('errorDeLaResolucion (espejo de validarCierre del SERVIDOR)', () => {
  const due = 15000
  it('Se cobró: recibido ≥ debía y 0 ≤ devolvió ≤ recibido − debía', () => {
    expect(errorDeLaResolucion({ outcome: 'PAGADO', creditCents: 14999, changeCents: 0, dueCents: due })?.key).toBe('paidNeedsFull')
    expect(errorDeLaResolucion({ outcome: 'PAGADO', creditCents: 20000, changeCents: 5001, dueCents: due })?.key).toBe('changeTooHigh')
    expect(errorDeLaResolucion({ outcome: 'PAGADO', creditCents: 20000, changeCents: 5000, dueCents: due })).toBeNull()
    expect(errorDeLaResolucion({ outcome: 'PAGADO', creditCents: 15000, changeCents: 0, dueCents: due })).toBeNull()
  })
  it('Se canceló y devolvió: recibido < debía y devolvió ≤ recibido', () => {
    expect(errorDeLaResolucion({ outcome: 'CANCELADO', creditCents: 15000, changeCents: 0, dueCents: due })?.key).toBe('cancelNeedsLess')
    expect(errorDeLaResolucion({ outcome: 'CANCELADO', creditCents: 10000, changeCents: 10001, dueCents: due })?.key).toBe('refundTooHigh')
    expect(errorDeLaResolucion({ outcome: 'CANCELADO', creditCents: 10000, changeCents: 10000, dueCents: due })).toBeNull()
    expect(errorDeLaResolucion({ outcome: 'CANCELADO', creditCents: 0, changeCents: 0, dueCents: due })).toBeNull()
  })
  it('Se canceló y se quedó con el dinero: recibido < debía y devolvió = 0', () => {
    expect(errorDeLaResolucion({ outcome: 'GUARDADO', creditCents: 15000, changeCents: 0, dueCents: due })?.key).toBe('cancelNeedsLess')
    expect(errorDeLaResolucion({ outcome: 'GUARDADO', creditCents: 10000, changeCents: 1, dueCents: due })?.key).toBe('keptMustBeZero')
    expect(errorDeLaResolucion({ outcome: 'GUARDADO', creditCents: 10000, changeCents: 0, dueCents: due })).toBeNull()
  })
  it('el modo de la cancelación cuadra con el desenlace: CANCELADO ↔ «1», GUARDADO ↔ «2»', () => {
    const base = { creditCents: 10000, changeCents: 0, dueCents: due }
    expect(errorDeLaResolucion({ ...base, outcome: 'CANCELADO', cancelMode: '1' })).toBeNull()
    expect(errorDeLaResolucion({ ...base, outcome: 'CANCELADO', cancelMode: '2' })?.key).toBe('cancelModeMismatch')
    expect(errorDeLaResolucion({ ...base, outcome: 'GUARDADO', cancelMode: '2' })).toBeNull()
    expect(errorDeLaResolucion({ ...base, outcome: 'GUARDADO', cancelMode: '1' })?.key).toBe('cancelModeMismatch')
  })
})

describe('ResolveCashMachineDoubtDialog', () => {
  beforeEach(() => {
    h.calls.length = 0
    h.toast.mockReset()
    h.impl = () =>
      Promise.resolve({ status: 200, data: { success: true, ack: 'TERMINADO', referenceCC: FOLIO, outcome: 'PAGADO', owedCents: 0 } })
  })

  it('es un FullScreenModal: el formulario va dentro, «Guardar» arriba en el encabezado y la X cierra', () => {
    const { onOpenChange } = setup()
    const contenido = document.querySelector('[data-fsm-content]')
    expect(contenido).toContainElement(screen.getByLabelText(`${P}evidence`))
    expect(contenido).toContainElement(screen.getByRole('radio', { name: `${P}outcomes.PAGADO.label` }))
    expect(guardar().closest('header')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'common:close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('mientras guarda, la X no cierra (el resultado tiene que verse)', async () => {
    h.impl = () => new Promise(() => {})
    const { onOpenChange } = setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    fireEvent.click(screen.getByRole('button', { name: 'common:close' }))
    await waitFor(() => expect(guardar()).toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'common:close' }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('enseña lo congelado del folio para compararlo con la máquina: debía (venta + propina), el carrito y lo último que vio la PC', () => {
    setup()
    expect(texto()).toContain(FOLIO)
    expect(texto()).toContain(Currency(150))
    expect(texto()).toContain(Currency(130))
    expect(texto()).toContain(Currency(20))
    expect(texto()).toContain(`${P}cart${JSON.stringify({ items: '2× Café' })}`)
    expect(texto()).toContain('status: depositing 100')
  })

  it('H1: enseña, a la vista, lo MÁS que la PC vio entrar (y nada si la PC no lo dijo en números); no lo pre-llena', () => {
    const { cambiarFila } = setup({ ...duda, creditCents: 12000, lastSeen: 'status: credit 120' })
    expect(texto()).toContain(`${P}seen${JSON.stringify({ amount: Currency(120) })}`)
    expect(texto()).toContain('status: credit 120')
    expect(screen.getByLabelText(`${P}received`)).toHaveValue(null)
    act(() => cambiarFila({ ...duda, creditCents: null }))
    expect(texto()).not.toContain(`${P}seen`)
  })

  it('venta y propina en null (el reparto no llegó en números): «—», nunca «N/A»; y un TERMINADO con ellas en null no truena', async () => {
    h.impl = () =>
      Promise.resolve({
        status: 200,
        data: { success: true, ack: 'TERMINADO', referenceCC: FOLIO, outcome: 'PAGADO', saleCents: null, tipCents: null, owedCents: 0 },
      })
    const { onOpenChange } = setup({ ...duda, saleCents: null, tipCents: null })
    expect(texto()).toContain(`${P}due${JSON.stringify({ due: Currency(150), sale: '—', tip: '—' })}`)
    expect(texto()).not.toContain('N/A')
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    expect(guardar()).toBeEnabled() // el adeudo basta para resolver
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.toast).toHaveBeenCalledWith({ title: `${P}saved${JSON.stringify({ folio: FOLIO })}` })
  })

  it('sin los importes del folio no deja guardar (no hay contra qué comparar)', () => {
    setup({ ...duda, dueCents: null, saleCents: null, tipCents: null, pedido: null })
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    expect(texto()).toContain(`${P}cart${JSON.stringify({ items: '—' })}`)
    expect(guardar()).toBeDisabled()
  })

  it('no deja guardar sin elegir qué pasó, sin lo recibido o sin lo que vio', () => {
    setup()
    expect(guardar()).toBeDisabled()
    elegir('PAGADO')
    expect(guardar()).toBeDisabled()
    recibio('150')
    expect(guardar()).toBeDisabled()
    vio('   ')
    expect(guardar()).toBeDisabled()
    vio('La pantalla dice pagado')
    expect(guardar()).toBeEnabled()
  })

  it('Se cobró: avisa si recibió menos de lo que debía o si devolvió de más', () => {
    setup()
    elegir('PAGADO')
    vio('pagado')
    recibio('100')
    expect(texto()).toContain(`${P}errors.paidNeedsFull`)
    expect(guardar()).toBeDisabled()
    recibio('200')
    devolvio('60')
    expect(texto()).toContain(`${P}errors.changeTooHigh`)
    expect(guardar()).toBeDisabled()
    devolvio('50')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(guardar()).toBeEnabled()
  })

  it('Se canceló y devolvió: avisa si recibió todo o si devolvió más de lo recibido', () => {
    setup()
    elegir('CANCELADO')
    vio('cancelado')
    recibio('150')
    expect(texto()).toContain(`${P}errors.cancelNeedsLess`)
    expect(guardar()).toBeDisabled()
    recibio('100')
    devolvio('120')
    expect(texto()).toContain(`${P}errors.refundTooHigh`)
    expect(guardar()).toBeDisabled()
    devolvio('100')
    expect(guardar()).toBeDisabled() // falta decir qué hizo la máquina con el dinero
    modo('1')
    expect(guardar()).toBeEnabled()
  })

  it('Se canceló y se quedó con el dinero: lo devuelto tiene que ser $0', () => {
    setup()
    elegir('GUARDADO')
    vio('guardado')
    recibio('100')
    devolvio('10')
    expect(texto()).toContain(`${P}errors.keptMustBeZero`)
    expect(guardar()).toBeDisabled()
    devolvio('0')
    modo('2')
    expect(guardar()).toBeEnabled()
  })

  it('un importe que no es dinero no se manda', () => {
    setup()
    elegir('PAGADO')
    vio('x')
    recibio('150.555')
    expect(texto()).toContain(`${P}errors.invalidAmount`)
    expect(guardar()).toBeDisabled()
  })

  it('manda CENTAVOS enteros y la hora del comprobante en ISO (zona del negocio)', async () => {
    const { onOpenChange, invalidate } = setup()
    elegir('PAGADO')
    recibio('200.50')
    devolvio('50.50')
    hora('2026-11-20T14:05')
    vio('  La pantalla dice pagado  ')
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls).toHaveLength(1)
    const [url, body] = h.calls[0]
    expect(url).toBe(`/api/v1/dashboard/venues/v1/cash-machine/doubts/${FOLIO}/resolve`)
    expect(body).toEqual({
      outcome: 'PAGADO',
      creditCents: 20050,
      changeDispensedCents: 5050,
      occurredAt: '2026-11-20T20:05:00.000Z',
      evidence: 'La pantalla dice pagado',
      version: 4,
    })
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: `${P}saved${JSON.stringify({ folio: FOLIO })}` }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
  })

  it('sin hora del comprobante no manda occurredAt (el SERVIDOR la deja por conciliar)', async () => {
    const { onOpenChange } = setup()
    elegir('GUARDADO')
    modo('2')
    recibio('100')
    devolvio('0')
    vio('guardó el dinero')
    expect(texto()).toContain(`${P}receiptTimeHelp`)
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls[0][1]).toEqual({
      outcome: 'GUARDADO',
      creditCents: 10000,
      changeDispensedCents: 0,
      cancelMode: '2',
      evidence: 'guardó el dinero',
      version: 4,
    })
  })

  it('si a la clienta se le debe dinero, el aviso de éxito lo dice', async () => {
    h.impl = () =>
      Promise.resolve({
        status: 200,
        data: { success: true, status: 'RESUELTO', ack: 'TERMINADO', referenceCC: FOLIO, outcome: 'GUARDADO', owedCents: 10000 },
      })
    const { onOpenChange } = setup()
    elegir('GUARDADO')
    modo('2')
    recibio('100')
    devolvio('0')
    vio('guardó')
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: `${P}owed${JSON.stringify({ amount: Currency(100) })}` }))
  })

  it('202 TERMINADO sin venta: «Registrado como incidencia: <motivo>» y lo que se le debe al cliente', async () => {
    h.impl = () =>
      Promise.resolve({
        status: 202,
        data: {
          success: true,
          ack: 'TERMINADO',
          referenceCC: FOLIO,
          incident: 'NO_SE_PUDO_REGISTRAR',
          incidentId: 'cinc1',
          motivo: 'DESCUENTO',
          outcome: 'PAGADO',
          owedKind: 'CAMBIO',
          owedCents: 5000,
        },
      })
    const { onOpenChange, invalidate } = setup()
    elegir('PAGADO')
    recibio('200')
    vio('pagado')
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    const motivo = `${P}motivos.DESCUENTO${JSON.stringify({ defaultValue: 'DESCUENTO' })}`
    expect(h.toast).toHaveBeenCalledWith({
      title: `${P}notRegistered${JSON.stringify({ motivo })}`,
      variant: 'destructive',
      description: `${P}owed${JSON.stringify({ amount: Currency(50) })}`,
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
  })

  it('202 TERMINADO sin venta y sin deuda: no inventa un monto, y un 202 nunca dice «Listo»', async () => {
    h.impl = () =>
      Promise.resolve({ status: 202, data: { success: true, ack: 'TERMINADO', incident: 'NO_SE_PUDO_REGISTRAR', owedCents: 0 } })
    setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    await waitFor(() => expect(h.toast).toHaveBeenCalled())
    const aviso = h.toast.mock.calls[0][0]
    expect(aviso.title).toContain(`${P}notRegistered`)
    expect(aviso.title).toContain(`${P}motivos.VENTA_RECHAZADA`)
    expect(aviso).not.toHaveProperty('description')
  })

  it('202 RECIBIDO: «Recibido: se está terminando de registrar» y refresca la lista', async () => {
    h.impl = () => Promise.resolve({ status: 202, data: { success: true, ack: 'RECIBIDO', referenceCC: FOLIO, outcome: 'PAGADO' } })
    const { onOpenChange, invalidate } = setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.toast).toHaveBeenCalledWith({ title: `${P}processing` })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
  })

  it('409 «llegó evidencia nueva»: lo dice, refresca, conserva lo tecleado y pide confirmar otra vez con la versión NUEVA', async () => {
    h.impl = () => rechazo(409, { code: 'CASH_MACHINE_DOUBT_CHANGED', message: 'Llegó evidencia nueva…', details: { version: 5 } })
    const { onOpenChange, invalidate, cambiarFila } = setup()
    elegir('CANCELADO')
    modo('1')
    recibio('100')
    devolvio('100')
    hora('2026-11-20T14:05')
    vio('regresó los $100')
    fireEvent.click(guardar())
    expect(await screen.findByRole('alert')).toHaveTextContent(`${P}changed`)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
    expect(onOpenChange).not.toHaveBeenCalled()
    // Mientras la lista no traiga la versión nueva, no se vuelve a mandar la vieja.
    await waitFor(() => expect(guardar()).toBeDisabled())
    fireEvent.click(guardar())
    expect(h.calls).toHaveLength(1)

    h.impl = () => Promise.resolve({ status: 200, data: { success: true, ack: 'TERMINADO', referenceCC: FOLIO, owedCents: 0 } })
    act(() => cambiarFila({ ...duda, version: 5, lastSeen: 'status: credit 100, cancelled' }))
    expect(texto()).toContain('status: credit 100, cancelled') // lo nuevo que vio la PC
    expect(screen.getByLabelText(`${P}received`)).toHaveValue(100)
    expect(screen.getByLabelText(`${P}evidence`)).toHaveValue('regresó los $100')
    expect(guardar()).toBeEnabled()
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls).toHaveLength(2)
    expect(h.calls[0][1]).toMatchObject({ version: 4 })
    expect(h.calls[1][1]).toEqual({
      outcome: 'CANCELADO',
      creditCents: 10000,
      changeDispensedCents: 10000,
      cancelMode: '1',
      occurredAt: '2026-11-20T20:05:00.000Z',
      evidence: 'regresó los $100',
      version: 5,
    })
  })

  it('409 «llegó evidencia nueva» sin versión en la respuesta: espera una MAYOR que la que mandó', async () => {
    h.impl = () => rechazo(409, { code: 'CASH_MACHINE_DOUBT_CHANGED' })
    const { cambiarFila } = setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    expect(await screen.findByRole('alert')).toHaveTextContent(`${P}changed`)
    await waitFor(() => expect(guardar()).toBeDisabled())
    act(() => cambiarFila({ ...duda })) // la lista volvió con la MISMA versión: sigue sin dejar
    expect(guardar()).toBeDisabled()
    act(() => cambiarFila({ ...duda, version: 5 }))
    expect(guardar()).toBeEnabled()
  })

  it('dos clics seguidos mandan UNA sola resolución', async () => {
    setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    fireEvent.click(guardar())
    await waitFor(() => expect(h.toast).toHaveBeenCalled())
    expect(h.calls).toHaveLength(1)
  })

  it('cancelación: pregunta qué hizo la máquina con el dinero y lo manda (cancelMode); con «Se cobró» ni se pregunta ni se manda', async () => {
    const { onOpenChange } = setup()
    elegir('PAGADO')
    expect(screen.queryByRole('radio', { name: `${P}cancelMode.1` })).not.toBeInTheDocument()
    elegir('CANCELADO')
    expect(texto()).toContain(`${P}cancelMode.question`)
    recibio('100')
    devolvio('100')
    hora('2026-11-20T14:05')
    vio('regresó los $100')
    expect(guardar()).toBeDisabled()
    modo('1')
    fireEvent.click(guardar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls[0][1]).toEqual({
      outcome: 'CANCELADO',
      creditCents: 10000,
      changeDispensedCents: 10000,
      cancelMode: '1',
      occurredAt: '2026-11-20T20:05:00.000Z',
      evidence: 'regresó los $100',
      version: 4,
    })
  })

  it('«No sé» no deja guardar y dice que deje el cobro en duda', () => {
    setup()
    elegir('GUARDADO')
    recibio('100')
    vio('no vi bien')
    modo('NO_SE')
    expect(texto()).toContain(`${P}cancelMode.unknown`)
    expect(guardar()).toBeDisabled()
    fireEvent.click(guardar())
    expect(h.calls).toHaveLength(0)
    modo('2')
    expect(screen.queryByText(`${P}cancelMode.unknown`)).not.toBeInTheDocument()
    expect(guardar()).toBeEnabled()
  })

  it('lo que hizo la máquina tiene que cuadrar con el desenlace (espejo del SERVIDOR)', () => {
    setup()
    elegir('CANCELADO')
    recibio('100')
    devolvio('100')
    vio('x')
    modo('2')
    expect(texto()).toContain(`${P}errors.cancelModeMismatch`)
    expect(guardar()).toBeDisabled()
    modo('1')
    expect(guardar()).toBeEnabled()
  })

  it('409 CASH_MACHINE_CLOSE_RETRY no es «ya estaba resuelto»: enseña el mensaje y deja reintentar', async () => {
    h.impl = () =>
      Promise.reject(
        Object.assign(new Error('409'), {
          response: {
            status: 409,
            data: { message: 'Otro registro de este folio estaba en curso. Intenta otra vez.', code: 'CASH_MACHINE_CLOSE_RETRY' },
          },
        }),
      )
    setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Otro registro de este folio estaba en curso. Intenta otra vez.')
    expect(screen.queryByText(`${P}conflict.title`)).not.toBeInTheDocument()
    expect(guardar()).toBeEnabled()
  })

  it('409: enseña lo que ya estaba registrado para ese folio y refresca la lista', async () => {
    h.impl = () =>
      Promise.reject(
        Object.assign(new Error('409'), {
          response: {
            status: 409,
            data: {
              message: 'Este folio de la máquina ya se registró con otros importes.',
              code: 'CASH_MACHINE_CLOSE_CONFLICT',
              details: { registrado: { referenceCC: FOLIO, outcome: 'CANCELADO', creditCents: 5000, changeDispensedCents: 5000 } },
            },
          },
        }),
      )
    const { onOpenChange, invalidate } = setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    expect(await screen.findByText(`${P}conflict.title`)).toBeInTheDocument()
    expect(texto()).toContain(`${P}outcomes.CANCELADO.label`)
    expect(texto()).toContain(Currency(50))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
    expect(screen.queryByRole('button', { name: `${P}submit` })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `${P}close` }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('409 de una duda cerrada sin venta: enseña también lo que vio el otro gerente', async () => {
    h.impl = () =>
      Promise.reject(
        Object.assign(new Error('409'), {
          response: {
            status: 409,
            data: {
              message: 'Esta duda de la máquina ya se resolvió de otra forma.',
              code: 'CASH_MACHINE_DOUBT_CONFLICT',
              details: { registrada: { outcome: 'GUARDADO', creditCents: 8000, changeDispensedCents: 0, evidence: 'Se tragó $80' } },
            },
          },
        }),
      )
    setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    expect(await screen.findByText(`${P}conflict.title`)).toBeInTheDocument()
    expect(texto()).toContain(`${P}outcomes.GUARDADO.label`)
    expect(texto()).toContain(Currency(80))
    expect(texto()).toContain('Se tragó $80')
  })

  it('422: enseña el mensaje del SERVIDOR (importes imposibles)', async () => {
    h.impl = () =>
      Promise.reject(
        Object.assign(new Error('422'), {
          response: {
            status: 422,
            data: { message: 'Los importes de este cierre de la máquina no son posibles.', code: 'CASH_MACHINE_CLOSE_IMPOSSIBLE' },
          },
        }),
      )
    const { onOpenChange } = setup()
    elegir('PAGADO')
    recibio('150')
    vio('pagado')
    fireEvent.click(guardar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Los importes de este cierre de la máquina no son posibles.')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
