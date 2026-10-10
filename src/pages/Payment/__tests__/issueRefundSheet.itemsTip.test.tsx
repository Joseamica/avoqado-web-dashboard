import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { post } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => o?.defaultValue ?? k }),
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { IssueRefundSheet } from '../IssueRefundSheet'

const items = [
  { id: 'a', productId: 'pa', productName: 'Café', quantity: 1, unitPrice: 80, total: 80 },
  { id: 'b', productId: 'pb', productName: 'Pan', quantity: 1, unitPrice: 65, total: 65 },
]

function mount(over: Partial<React.ComponentProps<typeof IssueRefundSheet>> = {}) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <IssueRefundSheet
        venueId="v1"
        paymentId="p1"
        maxRefundable={159.5}
        methodLabel="Tarjeta"
        orderItems={items}
        paymentTipAmount={14.5}
        remainingSaleAmount={145}
        remainingTipAmount={14.5}
        open
        onOpenChange={() => {}}
        onRefunded={() => {}}
        {...over}
      />
    </QueryClientProvider>,
  )
}

// El botón del pie es el último: la pestaña de arriba se llama igual.
const next = () => {
  const botones = screen.getAllByRole('button', { name: 'Reembolsar artículos' })
  return botones[botones.length - 1]
}

async function toConfirm(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const n of names) await user.click(screen.getByText(n))
  await user.click(next())
}

describe('IssueRefundSheet: casilla propina en el reembolso por artículos', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: {} })
  })

  it('todos los artículos ⇒ marcada, total con propina, manda tipRefundCents', async () => {
    const user = userEvent.setup()
    mount()
    await toConfirm(user, ['Café', 'Pan'])
    const box = screen.getByRole('checkbox')
    expect(box).toBeChecked()
    expect(screen.getByText('Reembolso de $159.50')).toBeInTheDocument()
    expect(screen.getByText('Incluye $14.50 de propina')).toBeInTheDocument()
    expect(screen.getByText('Se devuelve también la propina del cobro.')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toEqual({
      reason: 'OTHER',
      items: [
        { orderItemId: 'a', quantity: 1 },
        { orderItemId: 'b', quantity: 1 },
      ],
      tipRefundCents: 1450,
    })
  })

  it('una parte ⇒ desmarcada, sin tipRefundCents', async () => {
    const user = userEvent.setup()
    mount()
    await toConfirm(user, ['Café'])
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByText('Reembolso de $80.00')).toBeInTheDocument()
    expect(screen.getByText('Sin tocar la propina del mesero')).toBeInTheDocument()
    expect(screen.getByText('Solo se reembolsan los artículos; la propina del mesero queda intacta.')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).not.toHaveProperty('tipRefundCents')
  })

  it('parcial + el cajero la marca ⇒ manda la propina y el total sube; y su elección se queda', async () => {
    const user = userEvent.setup()
    mount()
    await toConfirm(user, ['Café'])
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Reembolso de $94.50')).toBeInTheDocument()
    // vuelve, suma el otro artículo (ahora cubre todo): sigue marcada por su elección
    await user.click(screen.getAllByRole('button')[0])
    await user.click(screen.getByText('Pan'))
    await user.click(next())
    expect(screen.getByRole('checkbox')).toBeChecked()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1].tipRefundCents).toBe(1450)
  })

  it('todo + la desmarca ⇒ sin tipRefundCents, y se queda desmarcada al volver', async () => {
    const user = userEvent.setup()
    mount()
    await toConfirm(user, ['Café', 'Pan'])
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Reembolso de $145.00')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button')[0])
    await user.click(next())
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).not.toHaveProperty('tipRefundCents')
  })

  it('sin propina que devolver ⇒ no hay casilla ni línea', async () => {
    const user = userEvent.setup()
    mount({ remainingTipAmount: 0, paymentTipAmount: 0, maxRefundable: 145 })
    await toConfirm(user, ['Café', 'Pan'])
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText(/propina/i)).toBeNull()
    expect(screen.getByText('Reembolso de $145.00')).toBeInTheDocument()
  })

  it('un artículo que pasa de la venta que queda no deja avanzar', async () => {
    const user = userEvent.setup()
    mount({ remainingSaleAmount: 70 })
    await user.click(screen.getByText('Café'))
    expect(next()).toBeDisabled()
  })

  // ── Task 6: los topes se comparan en CENTAVOS enteros y no dejan ofrecer más de lo que el servidor permite ──

  it('B3 (importe): $0.33 cabe en el máximo de $1.00 − $0.67 (en dobles 0.33 > 0.32999999999999996 lo bloqueaba)', async () => {
    const user = userEvent.setup()
    mount({ orderItems: [], paymentTipAmount: 0, remainingTipAmount: 0, maxRefundable: 1 - 0.67, remainingSaleAmount: 1 - 0.67 })
    await user.type(screen.getByPlaceholderText('0,00 $'), '0.33')
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    expect(screen.queryByText('El importe excede el máximo reembolsable')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reembolsar' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toMatchObject({ amount: 33 })
  })

  it('B3 (importe): un centavo por encima del máximo sigue bloqueado y se avisa', async () => {
    const user = userEvent.setup()
    mount({ orderItems: [], paymentTipAmount: 0, remainingTipAmount: 0, maxRefundable: 1 - 0.67, remainingSaleAmount: 1 - 0.67 })
    await user.type(screen.getByPlaceholderText('0,00 $'), '0.34')
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    expect(screen.getByText('El importe excede el máximo reembolsable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reembolsar' })).toBeDisabled()
  })

  it('B3 (artículos): $0.33 de artículo cabe en la venta restante de $1.00 − $0.67', async () => {
    const user = userEvent.setup()
    const centavos = [{ id: 'c', productId: 'pc', productName: 'Chicle', quantity: 1, unitPrice: 0.33, total: 0.33 }]
    mount({ orderItems: centavos, paymentTipAmount: 0, remainingTipAmount: 0, maxRefundable: 1 - 0.67, remainingSaleAmount: 1 - 0.67 })
    await user.click(screen.getByText('Chicle'))
    expect(next()).toBeEnabled()
  })

  it('B4 (artículos): si el total restante no alcanza para venta + propina, la propina se topa y el total NO pasa del tope', async () => {
    const user = userEvent.setup()
    // Acumulado histórico sin filas: quedan $150 del total aunque venta ($145) + propina ($14.50) sumen $159.50.
    mount({ maxRefundable: 150, remainingSaleAmount: 145, remainingTipAmount: 14.5 })
    await toConfirm(user, ['Café', 'Pan'])
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText('Reembolso de $150.00')).toBeInTheDocument()
    expect(screen.getByText('Incluye $5.00 de propina')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1].tipRefundCents).toBe(500)
  })

  it('B4 (artículos): si los artículos ya agotan el total restante, no queda propina que ofrecer (sin casilla, sin tipRefundCents)', async () => {
    const user = userEvent.setup()
    mount({ maxRefundable: 145, remainingSaleAmount: 145, remainingTipAmount: 14.5 })
    await toConfirm(user, ['Café', 'Pan'])
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('Reembolso de $145.00')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).not.toHaveProperty('tipRefundCents')
  })
})

// Decisión A (9-oct, IVA C2): con `chargedTotal` la hoja enseña, compara y suma lo COBRADO del renglón, no el bruto.
// Café $80 −10 % = $72 y Pan $65 −10 % = $58.50: el cobro fue $130.50 de venta + $14.50 de propina.
describe('IssueRefundSheet: lo que se devuelve por artículo es lo COBRADO (chargedTotal)', () => {
  const conDescuento = [
    { id: 'a', productId: 'pa', productName: 'Café', quantity: 1, unitPrice: 80, total: 80, chargedTotal: 72 },
    { id: 'b', productId: 'pb', productName: 'Pan', quantity: 1, unitPrice: 65, total: 65, chargedTotal: 58.5 },
  ]
  const cobro = { orderItems: conDescuento, maxRefundable: 145, remainingSaleAmount: 130.5, remainingTipAmount: 14.5 }

  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: {} })
  })

  it('cada renglón muestra lo cobrado; todo cabe en la venta que queda, la propina arranca marcada y se manda', async () => {
    const user = userEvent.setup()
    mount(cobro)
    expect(screen.getByText('$72.00')).toBeInTheDocument()
    expect(screen.getByText('$58.50')).toBeInTheDocument()
    expect(screen.queryByText('$80.00')).toBeNull()
    await user.click(screen.getByText('Café'))
    await user.click(screen.getByText('Pan'))
    // Con el bruto ($145) no cabía en la venta que queda ($130.50) y el botón se quedaba apagado.
    expect(next()).toBeEnabled()
    await user.click(next())
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText('Reembolso de $145.00')).toBeInTheDocument()
    expect(screen.getByText('Incluye $14.50 de propina')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toMatchObject({
      items: [
        { orderItemId: 'a', quantity: 1 },
        { orderItemId: 'b', quantity: 1 },
      ],
      tipRefundCents: 1450,
    })
  })

  it('una parte (Pan) ⇒ el importe es lo cobrado ($58.50, no $65.00) y la propina arranca desmarcada', async () => {
    const user = userEvent.setup()
    mount(cobro)
    await user.click(screen.getByText('Pan'))
    await user.click(next())
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByText('Reembolso de $58.50')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'OTHER')
    await user.click(screen.getByRole('button', { name: 'Reembolsar' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).not.toHaveProperty('tipRefundCents')
  })

  it('el paso de reabastecer enseña lo cobrado del renglón', async () => {
    const user = userEvent.setup()
    mount({ ...cobro, orderItems: [{ ...conDescuento[0], trackInventory: true }, conDescuento[1]] })
    await user.click(screen.getByText('Café'))
    await user.click(next())
    expect(screen.getByText('Seleccionar artículos para reabastecer')).toBeInTheDocument()
    expect(screen.getByText('$72.00')).toBeInTheDocument()
    expect(screen.queryByText('$80.00')).toBeNull()
  })

  it('un renglón ya devuelto sin importe previo registrado enseña lo cobrado, no el bruto', () => {
    mount({ ...cobro, orderItems: [{ ...conDescuento[0], priorRefundedQty: 1, priorRefundedAmount: 0 }, conDescuento[1]] })
    expect(screen.getByText('$72.00')).toBeInTheDocument()
    expect(screen.queryByText('$80.00')).toBeNull()
  })

  it('una cortesía (cobró $0) sola muestra $0.00 y no deja avanzar', async () => {
    const user = userEvent.setup()
    mount({
      ...cobro,
      orderItems: [{ id: 'c', productId: 'pc', productName: 'Galleta', quantity: 1, unitPrice: 50, total: 50, chargedTotal: 0 }],
    })
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    await user.click(screen.getByText('Galleta'))
    expect(next()).toBeDisabled()
  })
})
