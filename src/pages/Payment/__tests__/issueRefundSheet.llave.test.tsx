/**
 * D1 (founder 13-nov: «A, una ventana = un folio»): el reembolso del panel viaja con su llave (`idempotencyKey`). La llave nace al
 * abrir la ventana y se queda mientras siga abierta: el «intentar otra vez» tras quedar en duda va con la MISMA llave y el servidor
 * devuelve el reembolso ya hecho en vez de hacer otro. Cerrar y volver a abrir, o un éxito confirmado, estrenan llave.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { IssueRefundSheet } from '../IssueRefundSheet'

const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const folioDeOtraOperacion = () =>
  Object.assign(new Error('Request failed with status code 409'), {
    response: { status: 409, data: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'La llave de idempotencia ya pertenece a otra operación' } },
  })
const llaveDe = (n: number) => (post.mock.calls[n][1] as { idempotencyKey?: string }).idempotencyKey

function hoja(open: boolean) {
  return (
    <IssueRefundSheet venueId="v1" paymentId="p1" maxRefundable={500} methodLabel="Efectivo" open={open} onOpenChange={() => {}} onRefunded={() => {}} />
  )
}

function montar() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const vista = render(<QueryClientProvider client={client}>{hoja(true)}</QueryClientProvider>)
  return {
    user: userEvent.setup(),
    ...vista,
    abrir: (open: boolean) => vista.rerender(<QueryClientProvider client={client}>{hoja(open)}</QueryClientProvider>),
  }
}

async function reembolsar(user: ReturnType<typeof userEvent.setup>, monto: string, veces: number) {
  const campo = screen.getByRole('textbox')
  await user.clear(campo)
  await user.type(campo, monto)
  await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
  await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(veces))
}

describe('IssueRefundSheet — una ventana = un folio (D1, opción A)', () => {
  beforeEach(() => {
    post.mockReset()
    toast.mockReset()
  })

  it('🔴 en duda y otra vez en la MISMA ventana ⇒ la MISMA llave (el servidor no hace otro reembolso)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso sin confirmar' })))
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))

    expect(llaveDe(0)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('🔴 en duda y otra vez con OTRO monto en la misma ventana ⇒ sigue la MISMA llave (si el primero entró, el servidor lo dice; no duplica)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await reembolsar(user, '60', 2)

    expect(llaveDe(1)).toBe(llaveDe(0))
  })

  it('el aviso de duda dice que en la misma ventana no se duplica y que, si la cierras, revises antes', async () => {
    post.mockRejectedValueOnce(sinRespuesta())
    const { user } = montar()
    await reembolsar(user, '50', 1)
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reembolso sin confirmar', description: expect.stringMatching(/misma ventana/) }),
      ),
    )
  })

  it('cerrar la ventana y volver a abrirla ⇒ llave nueva (cuenta como otra operación)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ data: { success: true } })
    const vista = montar()
    await reembolsar(vista.user, '50', 1)

    vista.abrir(false)
    vista.abrir(true)
    await reembolsar(vista.user, '50', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('tras un reembolso confirmado, el siguiente en la misma ventana (aunque sea igual) estrena llave', async () => {
    post.mockResolvedValue({ data: { success: true } })
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reembolso emitido' })))
    await reembolsar(user, '50', 2)

    expect(llaveDe(1)).not.toBe(llaveDe(0))
  })

  it('🔴 «ese folio ya es de otra operación» (409) ⇒ lo dice en llano y NO estrena llave (no se puede duplicar desde esta ventana)', async () => {
    post.mockRejectedValueOnce(sinRespuesta()).mockRejectedValueOnce(folioDeOtraOperacion()).mockRejectedValueOnce(folioDeOtraOperacion())
    const { user } = montar()

    await reembolsar(user, '50', 1)
    await reembolsar(user, '60', 2)
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ya se había emitido un reembolso', description: expect.stringMatching(/cierra y vuelve a abrir/) }),
      ),
    )
    await reembolsar(user, '60', 3)
    expect(llaveDe(2)).toBe(llaveDe(0))
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
