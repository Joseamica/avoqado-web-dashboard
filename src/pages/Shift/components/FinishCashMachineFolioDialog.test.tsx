// Máquina de efectivo · fase 1a (H5 del SERVIDOR): un folio «por terminar». La máquina ya cerró el cobro pero relevaron su PC antes
// de registrar la venta. La ventana enseña lo que dijo la máquina, manda SÓLO `{ version }` (nunca importes tecleados), dice cómo
// quedó (200/202 TERMINADO, igual que al resolver una duda), con 409 «llegó evidencia nueva» pide confirmar otra vez con la versión
// nueva y con cualquier otro rechazo (400 incompleta) enseña la razón del SERVIDOR.
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

import { FinishCashMachineFolioDialog, type CashMachineFolioToFinish } from './FinishCashMachineFolioDialog'

const FOLIO = 'AQ0000000000B7'
const folio: CashMachineFolioToFinish = {
  id: 'cinc0000000000000000000pt',
  referenceCC: FOLIO,
  kind: 'POR_TERMINAR',
  status: 'ABIERTO',
  deviceId: 'd1',
  createdAt: '2026-11-20T19:00:00.000Z',
  dueCents: 15000,
  saleCents: 13000,
  tipCents: 2000,
  pedido: { items: [{ name: 'Café', quantity: 2 }] },
  saleShiftId: null,
  outcome: 'PAGADO',
  creditCents: 20000,
  changeDispensedCents: 5000,
  occurredAt: '2026-11-20T18:58:00.000Z',
  version: 3,
}

function setup(f: CashMachineFolioToFinish = folio) {
  const onOpenChange = vi.fn()
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const ventana = (x: CashMachineFolioToFinish) => (
    <QueryClientProvider client={client}>
      <FinishCashMachineFolioDialog open onOpenChange={onOpenChange} venueId="v1" folio={x} />
    </QueryClientProvider>
  )
  const { rerender } = render(ventana(f))
  return { onOpenChange, invalidate, cambiarFila: (x: CashMachineFolioToFinish) => rerender(ventana(x)) }
}

const rechazo = (status: number, data: Record<string, unknown>) =>
  Promise.reject(Object.assign(new Error(String(status)), { response: { status, data } }))

const R = 'cashMachineDoubts.resolve.'
const F = 'cashMachineDoubts.toFinish.'
const terminar = () => screen.getByRole('button', { name: `${F}button` })
const texto = () => document.body.textContent ?? ''

describe('FinishCashMachineFolioDialog', () => {
  beforeEach(() => {
    h.calls.length = 0
    h.toast.mockReset()
    h.impl = () =>
      Promise.resolve({ status: 200, data: { success: true, ack: 'TERMINADO', referenceCC: FOLIO, outcome: 'PAGADO', owedCents: 0 } })
  })

  it('dice por qué está por terminar y enseña lo que dijo la máquina, lo congelado y la hora del comprobante; sin campos para teclear', () => {
    setup()
    expect(texto()).toContain(`${F}label`)
    expect(texto()).toContain(`${R}outcomes.PAGADO.label`)
    expect(texto()).toContain(`${R}conflict.received${JSON.stringify({ amount: Currency(200) })}`)
    expect(texto()).toContain(`${R}conflict.returned${JSON.stringify({ amount: Currency(50) })}`)
    expect(texto()).toContain(`${R}due${JSON.stringify({ due: Currency(150), sale: Currency(130), tip: Currency(20) })}`)
    expect(texto()).toContain(`${R}cart${JSON.stringify({ items: '2× Café' })}`)
    expect(texto()).toContain(`${F}receiptTime${JSON.stringify({ time: 'FECHA(2026-11-20T18:58:00.000Z)' })}`)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('sin reparto venta/propina ni hora: «—» y «turno por conciliar», sin tronar', () => {
    setup({ ...folio, saleCents: null, tipCents: null, occurredAt: null, outcome: null, creditCents: null, changeDispensedCents: null })
    expect(texto()).toContain(`${R}due${JSON.stringify({ due: Currency(150), sale: '—', tip: '—' })}`)
    expect(texto()).toContain(`${R}conflict.received${JSON.stringify({ amount: '—' })}`)
    expect(texto()).toContain(`${F}noReceiptTime`)
    expect(texto()).not.toContain('N/A')
  })

  it('«Terminar» manda SÓLO la versión que vio, avisa «Listo» y refresca la lista', async () => {
    const { onOpenChange, invalidate } = setup()
    fireEvent.click(terminar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls).toEqual([[`/api/v1/dashboard/venues/v1/cash-machine/doubts/${FOLIO}/resolve`, { version: 3 }]])
    expect(h.toast).toHaveBeenCalledWith({ title: `${R}saved${JSON.stringify({ folio: FOLIO })}` })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
  })

  it('dos clics seguidos mandan UNA sola petición', async () => {
    h.impl = () => new Promise(() => {})
    setup()
    fireEvent.click(terminar())
    fireEvent.click(terminar())
    await waitFor(() => expect(terminar()).toBeDisabled())
    expect(h.calls).toHaveLength(1)
  })

  it('202 TERMINADO sin venta y TERMINADO con venta/propina en null: el mismo aviso que al resolver, sin tronar', async () => {
    h.impl = () =>
      Promise.resolve({
        status: 202,
        data: {
          success: true,
          ack: 'TERMINADO',
          incident: 'NO_SE_PUDO_REGISTRAR',
          motivo: 'VENTA_RECHAZADA',
          saleCents: null,
          tipCents: null,
          owedCents: 5000,
        },
      })
    const { onOpenChange } = setup()
    fireEvent.click(terminar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    const motivo = `${R}motivos.VENTA_RECHAZADA${JSON.stringify({ defaultValue: 'VENTA_RECHAZADA' })}`
    expect(h.toast).toHaveBeenCalledWith({
      title: `${R}notRegistered${JSON.stringify({ motivo })}`,
      variant: 'destructive',
      description: `${R}owed${JSON.stringify({ amount: Currency(50) })}`,
    })
  })

  it('409 «llegó evidencia nueva»: lo dice, refresca y sólo deja confirmar otra vez con la versión NUEVA', async () => {
    h.impl = () => rechazo(409, { code: 'CASH_MACHINE_DOUBT_CHANGED', message: 'Llegó evidencia nueva…', details: { version: 4 } })
    const { onOpenChange, invalidate, cambiarFila } = setup()
    fireEvent.click(terminar())
    expect(await screen.findByRole('alert')).toHaveTextContent(`${R}changed`)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cash-machine-doubts', 'v1'] })
    expect(onOpenChange).not.toHaveBeenCalled()
    await waitFor(() => expect(terminar()).toBeDisabled())
    fireEvent.click(terminar())
    expect(h.calls).toHaveLength(1)

    h.impl = () => Promise.resolve({ status: 200, data: { success: true, ack: 'TERMINADO', owedCents: 0 } })
    act(() => cambiarFila({ ...folio, version: 4, creditCents: 25000, changeDispensedCents: 10000 }))
    expect(texto()).toContain(`${R}conflict.received${JSON.stringify({ amount: Currency(250) })}`)
    expect(terminar()).toBeEnabled()
    fireEvent.click(terminar())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(h.calls[1][1]).toEqual({ version: 4 })
  })

  it('400 «resolución incompleta»: enseña la razón del SERVIDOR y no cierra', async () => {
    h.impl = () =>
      rechazo(400, {
        code: 'CASH_MACHINE_DOUBT_RESOLUTION_INCOMPLETE',
        message: 'Para resolver un cobro en duda escribe el desenlace, lo que entró, el cambio entregado y lo que viste en la máquina.',
      })
    const { onOpenChange } = setup()
    fireEvent.click(terminar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Para resolver un cobro en duda escribe el desenlace')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(h.toast).not.toHaveBeenCalled()
  })
})
