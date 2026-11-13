/**
 * D1 (12-nov): el reembolso del panel viaja con su llave (`idempotencyKey`). Si el primer envío quedó en duda (sin respuesta) y la
 * persona vuelve a tocar «Reembolsar» con lo mismo, va la MISMA llave: el servidor devuelve el reembolso ya hecho en vez de hacer
 * otro. Tras un éxito, o con otro monto, la llave es nueva.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { olvidarTodo } from '@/lib/llaveDeEnvio'

const post = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { IssueRefundSheet } from '../IssueRefundSheet'

const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const llaveDe = (n: number) => (post.mock.calls[n][1] as { idempotencyKey?: string }).idempotencyKey

function montar() {
  return { user: userEvent.setup(), ...render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <IssueRefundSheet venueId="v1" paymentId="p1" maxRefundable={500} methodLabel="Efectivo" open onOpenChange={() => {}} onRefunded={() => {}} />
    </QueryClientProvider>,
  ) }
}

async function reembolsar(user: ReturnType<typeof userEvent.setup>, monto: string, veces: number) {
  const campo = screen.getByRole('textbox')
  await user.clear(campo)
  await user.type(campo, monto)
  await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
  await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(veces))
}

describe('IssueRefundSheet — la llave del reembolso (D1)', () => {
  beforeEach(() => {
    post.mockReset()
    toast.mockReset()
  })
  afterEach(() => olvidarTodo())

  it('🔴 en duda y otra vez con lo mismo ⇒ la MISMA llave (el servidor no hace otro reembolso)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso sin confirmar' })))
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))

    expect(llaveDe(0)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('tras un reembolso confirmado, el siguiente (aunque sea igual) estrena llave', async () => {
    post.mockResolvedValue({ data: { success: true } })
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso emitido' })))
    await reembolsar(user, '50', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('con otro monto, llave nueva (con la vieja el servidor diría IDEMPOTENCY_KEY_REUSED)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await reembolsar(user, '60', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('🔴 Codex r1 #1: cerrar el detalle y volver a abrirlo conserva el reembolso en duda (aviso y MISMA llave)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const primero = montar()
    await reembolsar(primero.user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso sin confirmar' })))
    primero.unmount()

    const { user } = montar()
    expect(screen.getByText(/Hay un reembolso de .*50.* sin confirmar/)).toBeInTheDocument()
    await reembolsar(user, '50', 2)

    expect(llaveDe(1)).toBe(llaveDe(0))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ya quedó registrado' })))
  })

  it('🔴 Codex r1 #2: «Es otro» ⇒ un segundo reembolso idéntico legítimo estrena llave', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const { user } = montar()
    await reembolsar(user, '50', 1)
    await screen.findByText(/Hay un reembolso de .*50.* sin confirmar/)

    await user.click(screen.getByRole('button', { name: 'Es otro' }))
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))

    expect(llaveDe(1)).not.toBe(llaveDe(0))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso emitido' })))
  })

  it('el reembolso en duda de OTRO pago no se ve aquí', async () => {
    post.mockRejectedValueOnce(sinRespuesta())
    const primero = montar()
    await reembolsar(primero.user, '50', 1)
    primero.unmount()

    render(
      <QueryClientProvider client={new QueryClient()}>
        <IssueRefundSheet venueId="v1" paymentId="p2" maxRefundable={500} methodLabel="Efectivo" open onOpenChange={() => {}} onRefunded={() => {}} />
      </QueryClientProvider>,
    )
    expect(screen.queryByText(/sin confirmar/)).not.toBeInTheDocument()
  })

  it('🔴 doble clic del MISMO instante manda UN solo reembolso (hz:1fdd539e:D6: en la D3 salían dos POST)', async () => {
    let soltar: (v: unknown) => void = () => {}
    post.mockImplementation(() => new Promise(r => (soltar = r)))
    const { user } = montar()
    const campo = screen.getByRole('textbox')
    await user.type(campo, '50')
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    const boton = screen.getByRole('button', { name: 'Reembolsar' })

    act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(post).toHaveBeenCalled())
    await act(async () => soltar({ data: { success: true } }))

    expect(post).toHaveBeenCalledTimes(1)
  })
})
