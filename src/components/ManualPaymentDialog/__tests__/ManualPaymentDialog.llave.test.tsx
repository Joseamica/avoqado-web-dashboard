/**
 * D1 (12-nov): el pago manual del panel viaja con su llave. Si el primer envío quedó en duda (sin respuesta), el panel ya no dice
 * «Error: Network Error»: dice que no sabe si se registró, y volver a tocar «Registrar pago» con lo mismo manda la MISMA llave
 * (el servidor devuelve el pago ya registrado en vez de registrar otro). Tras un éxito, la llave es nueva.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/services/manualPayment.service', () => ({
  manualPaymentService: {
    create,
    getExternalSources: vi.fn().mockResolvedValue([]),
    getWaiters: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('../ExternalSourceCombobox', () => ({
  ExternalSourceCombobox: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Proveedor externo" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

import { ManualPaymentDialog } from '../ManualPaymentDialog'

const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const llaveDe = (n: number) => (create.mock.calls[n][1] as { idempotencyKey?: string }).idempotencyKey
const PAGO = { id: 'pay-1', orderId: 'o1', amount: '100.00', source: 'OTHER', externalSource: 'Clip', status: 'COMPLETED', createdAt: '' }

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })}>
      <ManualPaymentDialog open onClose={() => {}} venueId="v1" />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

async function registrar(user: ReturnType<typeof userEvent.setup>, monto: string, veces: number) {
  const campo = screen.getByLabelText('Monto')
  await user.clear(campo)
  await user.type(campo, monto)
  const proveedor = screen.getByLabelText('Proveedor externo')
  fireEvent.change(proveedor, { target: { value: 'Clip' } })
  await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
  await waitFor(() => expect(create).toHaveBeenCalledTimes(veces))
}

describe('ManualPaymentDialog — la llave del pago y el aviso honesto (D1)', () => {
  beforeEach(() => {
    create.mockReset()
    toast.mockReset()
  })

  it('🔴 sin respuesta: dice que no sabe si se registró (no «Network Error»), y el reintento lleva la MISMA llave', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const user = montar()

    await registrar(user, '100', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pago sin confirmar' })))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'Network Error' }))
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))

    expect(llaveDe(0)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('con otro monto, llave nueva', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const user = montar()

    await registrar(user, '100', 1)
    await registrar(user, '120', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('un rechazo del servidor (4xx) sigue diciendo su motivo', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: { message: 'El monto debe ser mayor a cero' } } }))
    const user = montar()

    await registrar(user, '100', 1)

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', description: 'El monto debe ser mayor a cero' })),
    )
  })
})
