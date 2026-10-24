import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreatePaymentLinkDialog from './CreatePaymentLinkDialog'
import { PaymentLinkDiscountSection } from './PaymentLinkDiscountSection'
import { discountError, discountFromLink, discountPayload, type DiscountFormValue } from './payment-link-discount.utils'

const mocks = vi.hoisted(() => ({ getDiscounts: vi.fn(), getDiscount: vi.fn(), update: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key) }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-a' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, activeVenue: { timezone: 'UTC' } }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/services/customer.service', () => ({ default: { getCustomers: async () => ({ data: [], meta: {} }) } }))
vi.mock('@/services/team.service', () => ({ default: { getTeamMembers: async () => ({ data: [] }) } }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [] } }))
vi.mock('@/services/paymentLink.service', () => ({
  default: {
    getSettings: async () => ({}),
    updatePaymentLink: mocks.update,
    getPaymentLink: async () => ({
      data: {
        id: 'l1',
        shortCode: 'A',
        title: 'Servicio',
        amountType: 'FIXED',
        amount: 1000,
        purpose: 'PAYMENT',
        isReusable: false,
        discount: { name: 'Amigos', type: 'PERCENTAGE', value: 15, origen: 'MANUAL' },
      },
    }),
  },
}))
vi.mock('./components/PaymentLinkPreview', () => ({ PaymentLinkPreview: () => null }))
vi.mock('./components/DonationPreview', () => ({ DonationPreview: () => null }))
vi.mock('./components/ItemPreview', () => ({ ItemPreview: () => null }))
vi.mock('./components/ItemFormSection', () => ({ ItemFormSection: () => null }))
vi.mock('./components/ShareActions', () => ({ ShareActions: () => null }))
vi.mock('@/services/discount.service', () => ({ default: { getDiscounts: mocks.getDiscounts, getDiscount: mocks.getDiscount } }))

const day = 86_400_000
const disc = (o: Record<string, unknown>) => ({
  id: 'd1',
  name: 'Mayo',
  type: 'PERCENTAGE',
  value: 10,
  scope: 'ORDER',
  active: true,
  requiresApproval: false,
  paymentLinkCompatibility: { ok: true, razon: null },
  ...o,
})

function Harness(p: {
  initial?: DiscountFormValue
  base?: number | null
  canApply?: boolean
  canRead?: boolean
  onSetExpiry?: (iso: string) => void
  spy?: (v: DiscountFormValue) => void
}) {
  const [value, setValue] = useState<DiscountFormValue>(p.initial ?? { mode: 'NONE' })
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PaymentLinkDiscountSection
        value={value}
        onChange={v => {
          p.spy?.(v)
          setValue(v)
        }}
        base={p.base === undefined ? 1000 : p.base}
        amountType={p.base === null ? 'OPEN' : 'FIXED'}
        canApply={p.canApply ?? true}
        canRead={p.canRead ?? true}
        onSetExpiry={p.onSetExpiry ?? vi.fn()}
      />
    </QueryClientProvider>
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PaymentLinkDiscountSection', () => {
  it('arranca en «Sin descuento»', () => {
    render(<Harness />)
    expect(screen.getByLabelText('discount.none')).toBeChecked()
  })

  it('escribir 15 % con base 1000 muestra el total $850.00', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('discount.manual'))
    fireEvent.change(screen.getByLabelText('discount.valueField'), { target: { value: '15' } })
    expect(screen.getByText(/\$850\.00/)).toBeInTheDocument()
  })

  it('en importe abierto no hay total: explica que se aplica sobre lo que escriba el cliente', () => {
    render(<Harness base={null} initial={{ mode: 'MANUAL', type: 'PERCENTAGE', value: '15', name: '' }} />)
    expect(screen.getByText('discount.openAmountHint')).toBeInTheDocument()
    expect(screen.queryByText(/\$850/)).toBeNull()
  })

  it('el selector lista los vigentes, y el incompatible sale con candado, su razón y sin poder elegirse', async () => {
    mocks.getDiscounts.mockResolvedValue({
      data: [
        disc({}),
        disc({
          id: 'd2',
          name: 'Primeros 50',
          maxTotalUses: 50,
          paymentLinkCompatibility: { ok: false, razon: 'Tiene límite de usos: escríbelo a mano' },
        }),
        disc({ id: 'd3', name: 'Vencido', validUntil: new Date(Date.now() - day).toISOString() }),
        disc({ id: 'd4', name: 'Cortesía', type: 'COMP', paymentLinkCompatibility: { ok: false, razon: 'Es una cortesía' } }),
      ],
    })
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    fireEvent.click(screen.getByLabelText('discount.catalog'))
    const ok = await screen.findByRole('button', { name: /Mayo/ })
    const locked = screen.getByRole('button', { name: /Primeros 50/ })
    expect(locked).toBeDisabled()
    expect(screen.getByText('Tiene límite de usos: escríbelo a mano')).toBeInTheDocument()
    expect(screen.queryByText('Vencido')).toBeNull()
    expect(screen.getByRole('button', { name: /Cortesía/ })).toBeDisabled()
    expect(screen.getByText('Es una cortesía')).toBeInTheDocument()
    fireEvent.click(locked)
    fireEvent.click(ok)
    expect(spy).toHaveBeenLastCalledWith({ mode: 'CATALOG', discountId: 'd1' })
    expect(mocks.getDiscounts).toHaveBeenCalledWith('venue-a', expect.objectContaining({ active: true, scope: 'ORDER' }))
  })

  it('con validUntil en 3 días avisa y el botón pone la expiración de la liga', async () => {
    const validUntil = new Date(Date.now() + 3 * day).toISOString()
    mocks.getDiscounts.mockResolvedValue({ data: [disc({ validUntil })] })
    const onSetExpiry = vi.fn()
    render(<Harness initial={{ mode: 'CATALOG', discountId: 'd1' }} onSetExpiry={onSetExpiry} />)
    expect(await screen.findByText(/discount\.expiresSoon.*"days":3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /discount\.alsoExpire/ }))
    expect(onSetExpiry).toHaveBeenCalledWith(validUntil)
  })

  it('con vencimiento lejano (30 días) no avisa', async () => {
    mocks.getDiscounts.mockResolvedValue({ data: [disc({ validUntil: new Date(Date.now() + 30 * day).toISOString() })] })
    render(<Harness initial={{ mode: 'CATALOG', discountId: 'd1' }} />)
    await screen.findByRole('button', { name: /Mayo/ })
    expect(screen.queryByText(/discount\.expiresSoon/)).toBeNull()
  })

  it('sin discounts:apply la sección se deshabilita con la razón', () => {
    render(<Harness canApply={false} />)
    expect(screen.getByText('discount.noApplyPermission')).toBeInTheDocument()
    expect(screen.getByLabelText('discount.manual')).toBeDisabled()
    expect(screen.getByLabelText('discount.none')).toBeDisabled()
  })

  it('sin discounts:read la opción del catálogo se deshabilita con su razón', () => {
    render(<Harness canRead={false} />)
    expect(screen.getByLabelText('discount.catalog')).toBeDisabled()
    expect(screen.getByText('discount.noReadPermission')).toBeInTheDocument()
  })

  it('«Quitar» vuelve a «Sin descuento»', () => {
    const spy = vi.fn()
    render(<Harness spy={spy} initial={{ mode: 'MANUAL', type: 'PERCENTAGE', value: '15', name: '' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'discount.remove' }))
    expect(spy).toHaveBeenLastCalledWith({ mode: 'NONE' })
  })
})

describe('catálogo grande, tope y mínimo', () => {
  it('busca en el servidor y muestra «N de total» con «Refina tu búsqueda»', async () => {
    mocks.getDiscounts.mockResolvedValue({ data: [disc({})], meta: { totalCount: 250 } })
    render(<Harness initial={{ mode: 'CATALOG', discountId: '' }} />)
    expect(await screen.findByText(/discount\.count.*"total":250/)).toBeInTheDocument()
    expect(screen.getByText(/discount\.refine/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('discount.search'), { target: { value: 'may' } })
    await waitFor(() => expect(mocks.getDiscounts).toHaveBeenLastCalledWith('venue-a', expect.objectContaining({ search: 'may' })))
  })

  it('un descuento elegido que no está en la página se trae por id y alimenta el aviso', async () => {
    const validUntil = new Date(Date.now() + 2 * day).toISOString()
    mocks.getDiscounts.mockResolvedValue({ data: [disc({ id: 'otro', name: 'Otro' })], meta: { totalCount: 1 } })
    mocks.getDiscount.mockResolvedValue(disc({ id: 'lejano', name: 'Lejano', validUntil }))
    render(<Harness initial={{ mode: 'CATALOG', discountId: 'lejano' }} />)
    expect(await screen.findByText(/discount\.expiresSoon/)).toBeInTheDocument()
    expect(mocks.getDiscount).toHaveBeenCalledWith('venue-a', 'lejano')
  })

  it('20 % con tope de $100 sobre $1,000 da $900.00', async () => {
    mocks.getDiscounts.mockResolvedValue({ data: [disc({ value: 20, maxDiscountAmount: 100 })] })
    render(<Harness initial={{ mode: 'CATALOG', discountId: 'd1' }} />)
    expect(await screen.findByText(/\$900\.00/)).toBeInTheDocument()
  })

  it('con compra mínima mayor a la base no da total y lo explica', async () => {
    mocks.getDiscounts.mockResolvedValue({ data: [disc({ minPurchaseAmount: 2000 })] })
    render(<Harness initial={{ mode: 'CATALOG', discountId: 'd1' }} />)
    expect(await screen.findByText(/discount\.minPurchase/)).toBeInTheDocument()
    expect(screen.queryByText(/\$900/)).toBeNull()
  })

  it('discountError bloquea catálogo sin elegir y manual vacío o en 0', () => {
    expect(discountError({ mode: 'CATALOG', discountId: '' })).toBe('errorPick')
    expect(discountError({ mode: 'MANUAL', type: 'PERCENTAGE', value: '', name: '' })).toBe('errorValue')
    expect(discountError({ mode: 'MANUAL', type: 'PERCENTAGE', value: '0', name: '' })).toBe('errorValue')
    expect(discountError({ mode: 'MANUAL', type: 'PERCENTAGE', value: '5', name: '' })).toBeNull()
    expect(discountError({ mode: 'NONE' })).toBeNull()
  })
})

describe('discountFromLink / discountPayload', () => {
  it('precarga el descuento escrito y el del catálogo', () => {
    expect(discountFromLink({ name: 'Amigos', type: 'FIXED_AMOUNT', value: 50, origen: 'MANUAL' })).toEqual({
      mode: 'MANUAL',
      type: 'FIXED_AMOUNT',
      value: '50',
      name: 'Amigos',
    })
    expect(discountFromLink({ name: 'Mayo', type: 'PERCENTAGE', value: 10, origen: 'CATALOGO', discountId: 'd1' })).toEqual({
      mode: 'CATALOG',
      discountId: 'd1',
    })
    expect(discountFromLink(null)).toEqual({ mode: 'NONE' })
  })

  it('sin tocar no manda la llave; quitar manda null; escribir manda el cuerpo', () => {
    const manual: DiscountFormValue = { mode: 'MANUAL', type: 'PERCENTAGE', value: '15', name: ' ' }
    expect(discountPayload(manual, false)).toEqual({})
    expect(discountPayload({ mode: 'NONE' }, true)).toEqual({ discount: null })
    expect(discountPayload(manual, true)).toEqual({ discount: { mode: 'MANUAL', type: 'PERCENTAGE', value: 15 } })
    expect(discountPayload({ mode: 'MANUAL', type: 'FIXED_AMOUNT', value: '50', name: 'Amigos' }, true)).toEqual({
      discount: { mode: 'MANUAL', type: 'FIXED_AMOUNT', value: 50, name: 'Amigos' },
    })
    expect(discountPayload({ mode: 'CATALOG', discountId: 'd1' }, true)).toEqual({ discount: { mode: 'CATALOG', discountId: 'd1' } })
  })
})

describe('editar una liga con descuento', () => {
  const open = async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CreatePaymentLinkDialog open onClose={vi.fn()} editingLinkId="l1" />
      </QueryClientProvider>,
    )
    await screen.findByDisplayValue('15')
  }

  it('lo precarga y, si no se toca, no reenvía la llave discount', async () => {
    mocks.update.mockResolvedValue({ success: true, data: {} })
    await open()
    expect(screen.getByLabelText('discount.manual')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('discount')
  })

  it('«Quitar» manda discount: null', async () => {
    mocks.update.mockResolvedValue({ success: true, data: {} })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'discount.remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.update.mock.calls[0][2]).toHaveProperty('discount', null)
  })
})
