/**
 * Pagos › Reembolso de siempre sobre el cobro de un pedido en línea con tarjeta (fase 2, D4): el servidor responde
 * `409 ONLINE_ORDER_REFUND_VIA_ONLINE_ORDERS`. La hoja muestra su texto y una liga al detalle de la cuenta, donde vive
 * «Devolver a la tarjeta».
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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key }),
}))

import { IssueRefundSheet } from '../IssueRefundSheet'

const SERVER = 'Este cobro es de un pedido en línea: devuélvelo desde el pedido.'

async function reembolsar(orderHref?: string) {
  post.mockRejectedValueOnce(
    Object.assign(new Error('Request failed with status code 409'), {
      response: { status: 409, data: { code: 'ONLINE_ORDER_REFUND_VIA_ONLINE_ORDERS', message: SERVER } },
    }),
  )
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <IssueRefundSheet
        venueId="v1"
        paymentId="p1"
        maxRefundable={500}
        methodLabel="Tarjeta"
        orderHref={orderHref}
        open
        onOpenChange={() => {}}
        onRefunded={() => {}}
      />
    </QueryClientProvider>,
  )
  await user.type(screen.getByRole('textbox'), '500')
  await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
  await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
  await waitFor(() => expect(toast).toHaveBeenCalled())
  return toast.mock.calls[0][0]
}

describe('IssueRefundSheet: cobro de un pedido en línea con tarjeta', () => {
  beforeEach(() => {
    post.mockReset()
    toast.mockReset()
  })

  it('🔴 el 409 muestra el texto del servidor y una liga al detalle de la cuenta', async () => {
    const shown = await reembolsar('/venues/t/orders/o1')
    expect(shown.description).toBe(SERVER)
    expect(shown.action).toBeTruthy()
    expect(shown.action.props.children.props.to).toBe('/venues/t/orders/o1')
  })

  it('sin la cuenta a la mano, sólo el texto (nunca una liga rota)', async () => {
    const shown = await reembolsar()
    expect(shown.description).toBe(SERVER)
    expect(shown.action).toBeUndefined()
  })
})
