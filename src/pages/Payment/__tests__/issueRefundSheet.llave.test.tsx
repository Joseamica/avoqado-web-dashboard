/**
 * D1 (12-nov): el reembolso del panel viaja con su llave (`idempotencyKey`). Si el primer envío quedó en duda (sin respuesta) y la
 * persona vuelve a tocar «Reembolsar» con lo mismo, va la MISMA llave: el servidor devuelve el reembolso ya hecho en vez de hacer
 * otro. Tras un éxito, o con otro monto, la llave es nueva.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { IssueRefundSheet } from '../IssueRefundSheet'

const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const llaveDe = (n: number) => (post.mock.calls[n][1] as { idempotencyKey?: string }).idempotencyKey

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <IssueRefundSheet venueId="v1" paymentId="p1" maxRefundable={500} methodLabel="Efectivo" open onOpenChange={() => {}} onRefunded={() => {}} />
    </QueryClientProvider>,
  )
  return userEvent.setup()
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

  it('🔴 en duda y otra vez con lo mismo ⇒ la MISMA llave (el servidor no hace otro reembolso)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const user = montar()

    await reembolsar(user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso sin confirmar' })))
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))

    expect(llaveDe(0)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('tras un reembolso confirmado, el siguiente (aunque sea igual) estrena llave', async () => {
    post.mockResolvedValue({ data: { success: true } })
    const user = montar()

    await reembolsar(user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso emitido' })))
    await reembolsar(user, '50', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('con otro monto, llave nueva (con la vieja el servidor diría IDEMPOTENCY_KEY_REUSED)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const user = montar()

    await reembolsar(user, '50', 1)
    await reembolsar(user, '60', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })
})
