/**
 * D1 (12-nov): el pago manual del panel viaja con su llave. Si el primer envío quedó en duda (sin respuesta), el panel ya no dice
 * «Error: Network Error»: dice que no sabe si se registró, y volver a tocar «Registrar pago» con lo mismo manda la MISMA llave
 * (el servidor devuelve el pago ya registrado en vez de registrar otro). Tras un éxito, la llave es nueva.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { olvidarTodo } from '@/lib/llaveDeEnvio'

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
  return { user: userEvent.setup(), ...render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })}>
      <ManualPaymentDialog open onClose={() => {}} venueId="v1" />
    </QueryClientProvider>,
  ) }
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
  afterEach(() => olvidarTodo())

  it('🔴 sin respuesta: dice que no sabe si se registró (no «Network Error»), y el reintento lleva la MISMA llave', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const { user } = montar()

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
    const { user } = montar()

    await registrar(user, '100', 1)
    await registrar(user, '120', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('un rechazo del servidor (4xx) sigue diciendo su motivo', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: { message: 'El monto debe ser mayor a cero' } } }))
    const { user } = montar()

    await registrar(user, '100', 1)

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', description: 'El monto debe ser mayor a cero' })),
    )
  })

  it('🔴 Codex r1 #1: cerrar y volver a abrir conserva el envío en duda: aviso, y reenviar lo mismo lleva la MISMA llave', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const primero = montar()
    await registrar(primero.user, '100', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pago sin confirmar' })))
    primero.unmount()

    const { user } = montar()
    expect(screen.getByText(/Hay un pago de .*100.* sin confirmar/)).toBeInTheDocument()
    await registrar(user, '100', 2)

    expect(llaveDe(1)).toBe(llaveDe(0))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ya quedó registrado' })))
    expect(screen.queryByText(/sin confirmar/)).not.toBeInTheDocument()
  })

  it('🔴 Codex r1 #2: «Es otro» ⇒ el mismo contenido estrena llave (un segundo pago legítimo idéntico no se pierde)', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const { user } = montar()
    await registrar(user, '100', 1)
    await screen.findByText(/Hay un pago de .*100.* sin confirmar/)

    await user.click(screen.getByRole('button', { name: 'Es otro' }))
    expect(screen.queryByText(/sin confirmar/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))

    expect(llaveDe(1)).not.toBe(llaveDe(0))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pago registrado' })))
  })

  it('un rechazo definitivo (4xx) olvida la llave: el siguiente envío estrena', async () => {
    create
      .mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: { message: 'No' } } }))
      .mockResolvedValueOnce(PAGO)
    const { user } = montar()
    await registrar(user, '100', 1)
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))

    expect(llaveDe(1)).not.toBe(llaveDe(0))
    expect(screen.queryByText(/sin confirmar/)).not.toBeInTheDocument()
  })

  it('🔴 doble clic del MISMO instante registra UN solo pago', async () => {
    let soltar: (v: unknown) => void = () => {}
    create.mockImplementation(() => new Promise(r => (soltar = r)))
    const { user } = montar()
    await user.type(screen.getByLabelText('Monto'), '100')
    fireEvent.change(screen.getByLabelText('Proveedor externo'), { target: { value: 'Clip' } })
    const boton = screen.getByRole('button', { name: 'Registrar pago' })

    act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(create).toHaveBeenCalled())
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
      soltar(PAGO)
    })

    expect(create).toHaveBeenCalledTimes(1)
  })

  it('🔴 Codex r2 #3: salir y volver ANTES de que falle: al fallar, la pantalla nueva avisa y el reenvío lleva la MISMA llave', async () => {
    let fallar: (e: unknown) => void = () => {}
    create.mockImplementationOnce(() => new Promise((_, rechazar) => (fallar = rechazar))).mockResolvedValueOnce(PAGO)
    const primero = montar()
    await registrar(primero.user, '100', 1)
    primero.unmount()

    const { user } = montar()
    expect(screen.queryByText(/sin confirmar/)).not.toBeInTheDocument() // sigue en vuelo: todavía no es una duda
    await act(async () => fallar(sinRespuesta()))
    expect(await screen.findByText(/Hay un pago de .*100.* sin confirmar/)).toBeInTheDocument()

    await registrar(user, '100', 2)
    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('🔴 Codex r2 #2: A en duda, B confirmado, reintentar A ⇒ la llave de A (no se duplica A)', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO).mockResolvedValueOnce(PAGO)
    const { user } = montar()
    await registrar(user, '100', 1)
    await registrar(user, '120', 2)
    await registrar(user, '100', 3)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
    expect(llaveDe(2)).toBe(llaveDe(0))
  })
})

