/**
 * D1 (founder 13-nov: «A, una ventana = un folio»): el pago manual del panel viaja con su llave. La llave nace al abrir el diálogo y
 * se queda mientras siga abierto. Si el primer envío quedó en duda (sin respuesta), el panel ya no dice «Error: Network Error»: dice
 * que no sabe si se registró, y volver a tocar «Registrar pago» en el mismo diálogo manda la MISMA llave (el servidor devuelve el pago
 * ya registrado en vez de registrar otro). Cerrar y volver a abrir, o un éxito confirmado, estrenan llave.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
const folioDeOtraOperacion = () =>
  Object.assign(new Error('Request failed with status code 409'), {
    response: { status: 409, data: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'La llave de idempotencia ya pertenece a otra operación' } },
  })
const llaveDe = (n: number) => (create.mock.calls[n][1] as { idempotencyKey?: string }).idempotencyKey
const PAGO = { id: 'pay-1', orderId: 'o1', amount: '100.00', source: 'OTHER', externalSource: 'Clip', status: 'COMPLETED', createdAt: '' }

function montar() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  const dialogo = (open: boolean) => (
    <QueryClientProvider client={client}>
      <ManualPaymentDialog open={open} onClose={() => {}} venueId="v1" />
    </QueryClientProvider>
  )
  const vista = render(dialogo(true))
  return { user: userEvent.setup(), ...vista, abrir: (open: boolean) => vista.rerender(dialogo(open)) }
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

describe('ManualPaymentDialog — una ventana = un folio y el aviso honesto (D1, opción A)', () => {
  beforeEach(() => {
    create.mockReset()
    toast.mockReset()
  })

  it('🔴 sin respuesta: dice que no sabe si se registró (no «Network Error»), y el reintento en el mismo diálogo lleva la MISMA llave', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const { user } = montar()

    await registrar(user, '100', 1)
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Pago sin confirmar', description: expect.stringMatching(/misma ventana/) }),
      ),
    )
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'Network Error' }))
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))

    expect(llaveDe(0)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('🔴 en duda y otra vez con OTRO monto en el mismo diálogo ⇒ sigue la MISMA llave', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const { user } = montar()

    await registrar(user, '100', 1)
    await registrar(user, '100.00', 2)

    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('cerrar el diálogo y volver a abrirlo ⇒ llave nueva (cuenta como otro pago)', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce(PAGO)
    const vista = montar()
    await registrar(vista.user, '100', 1)

    vista.abrir(false)
    vista.abrir(true)
    await registrar(vista.user, '100', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('tras un pago confirmado, el siguiente en el mismo diálogo estrena llave', async () => {
    create.mockResolvedValue(PAGO)
    const { user } = montar()

    await registrar(user, '100', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pago registrado' })))
    await registrar(user, '100', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('🔴 «ese folio ya es de otra operación» (409) ⇒ lo dice en llano y NO estrena llave', async () => {
    create.mockRejectedValueOnce(sinRespuesta()).mockRejectedValueOnce(folioDeOtraOperacion()).mockRejectedValueOnce(folioDeOtraOperacion())
    const { user } = montar()

    await registrar(user, '100', 1)
    await registrar(user, '120', 2)
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ya se había registrado un pago', description: expect.stringMatching(/cierra y vuelve a abrir/) }),
      ),
    )
    await registrar(user, '120', 3)
    expect(llaveDe(2)).toBe(llaveDe(0))
  })

  it('🔴 doble clic del MISMO instante manda UN solo pago', async () => {
    let soltar: (v: unknown) => void = () => {}
    create.mockImplementation(() => new Promise(r => (soltar = r)))
    const { user } = montar()
    const campo = screen.getByLabelText('Monto')
    await user.type(campo, '100')
    fireEvent.change(screen.getByLabelText('Proveedor externo'), { target: { value: 'Clip' } })
    const boton = screen.getByRole('button', { name: 'Registrar pago' })

    await act(async () => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(create).toHaveBeenCalled())
    await act(async () => soltar(PAGO))

    expect(create).toHaveBeenCalledTimes(1)
  })
})
