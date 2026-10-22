import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreatePaymentLinkDialog from './CreatePaymentLinkDialog'
import { SharePaymentLinkDialog } from './SharePaymentLinkDialog'
import paymentLinkService from '@/services/paymentLink.service'
import customerService from '@/services/customer.service'
import type { PaymentLink } from '@/services/paymentLink.service'

const state = vi.hoisted(() => ({ venueId: 'venue-a', actor: 'staff-a', read: true, create: true }))
const mocks = vi.hoisted(() => ({ create: vi.fn(), share: vi.fn(), customers: vi.fn(), customerCreate: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: state.venueId, venue: { name: 'Shop' }, fullBasePath: '/venues/shop' }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: state.actor } }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => (p === 'customers:read' ? state.read : state.create) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/services/paymentLink.service', () => ({
  default: {
    createPaymentLink: mocks.create,
    shareViaWhatsapp: mocks.share,
    getSettings: async () => ({}),
    getPaymentLink: async () => ({ data: { ...link, customer: alice } }),
    updatePaymentLink: vi.fn(),
  },
}))
vi.mock('@/services/customer.service', () => ({ default: { getCustomers: mocks.customers, createCustomer: mocks.customerCreate } }))
vi.mock('@/services/team.service', () => ({ default: { getTeamMembers: async () => ({ data: [] }) } }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [] } }))
vi.mock('./components/PaymentLinkPreview', () => ({ PaymentLinkPreview: () => null }))
vi.mock('./components/DonationPreview', () => ({ DonationPreview: () => null }))
vi.mock('./components/ItemPreview', () => ({ ItemPreview: () => null }))
vi.mock('./components/ItemFormSection', () => ({ ItemFormSection: () => null }))
vi.mock('./components/ShareActions', () => ({ ShareActions: () => null }))

const alice = {
  id: 'customer-a',
  firstName: 'Alice',
  lastName: 'Shopper',
  email: 'alice@example.test',
  phone: '+525512345678',
  active: true,
}
const link = {
  id: 'link-a',
  shortCode: 'ABC',
  title: 'Service',
  amountType: 'FIXED',
  amount: 100,
  purpose: 'PAYMENT',
  isReusable: false,
} as PaymentLink
const page = (data = [alice], total = data.length, currentPage = 1) => ({
  data,
  meta: {
    totalCount: total,
    currentPage,
    pageSize: 20,
    totalPages: Math.ceil(total / 20),
    hasNextPage: currentPage * 20 < total,
    hasPrevPage: currentPage > 1,
  },
})
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
const wrap = (node: React.ReactNode) => (
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>
  </MemoryRouter>
)
async function details() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
  fireEvent.click(screen.getByText('wizard.paymentTitle'))
  fireEvent.click(screen.getByText('wizard.continue'))
  fireEvent.change(screen.getByLabelText('form.titleField'), { target: { value: 'Service' } })
  fireEvent.change(screen.getByLabelText('form.amountField'), { target: { value: '100' } })
  await screen.findByRole('button', { name: /Alice/ })
}
beforeEach(() => {
  Object.assign(state, { venueId: 'venue-a', actor: 'staff-a', read: true, create: true })
  mocks.customers.mockResolvedValue(page())
  mocks.create.mockResolvedValue({ success: true, data: link })
  mocks.share.mockResolvedValue({ success: true, data: { sent: true } })
  mocks.customerCreate.mockResolvedValue({ message: 'Created', customer: alice })
})
afterEach(cleanup)

describe('customer payment links', () => {
  it('selects a client, retains it after search/page changes, and normal create never sends', async () => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    const search = screen.getByLabelText('customer.search')
    search.focus()
    mocks.customers.mockResolvedValue(page([], 0))
    fireEvent.change(search, { target: { value: 'nobody' } })
    await waitFor(() =>
      expect(customerService.getCustomers).toHaveBeenLastCalledWith('venue-a', { page: 1, pageSize: 20, search: 'nobody' }),
    )
    expect(search).toHaveFocus()
    expect(await screen.findByText('customer.noResults')).toBeVisible()
    expect(screen.getByTestId('selected-customer')).toHaveTextContent('Alice')
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() =>
      expect(paymentLinkService.createPaymentLink).toHaveBeenCalledWith(
        'venue-a',
        expect.objectContaining({ customerId: alice.id }),
        expect.any(String),
      ),
    )
    expect(mocks.share).not.toHaveBeenCalled()
  })

  it('creates once, retains the created link after send failure, and retries only sending', async () => {
    mocks.share.mockRejectedValueOnce(new Error('Network'))
    const close = vi.fn()
    render(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    fireEvent.click(screen.getByText('customer.createAndSend'))
    await screen.findByText('customer.sendFailedCreated')
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('customer.retrySend'))
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.share).toHaveBeenCalledTimes(2)
    expect(mocks.share).toHaveBeenLastCalledWith('venue-a', 'link-a', alice.phone)
  })

  it('preserves idempotency key on manual retry but replaces it for changed body', async () => {
    mocks.create.mockRejectedValue(new Error('Lost response'))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(screen.getByText('form.save')).toBeEnabled())
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
    expect(mocks.create.mock.calls[0][2]).toBeTruthy()
    expect(mocks.create.mock.calls[1][2]).toBe(mocks.create.mock.calls[0][2])
    await waitFor(() => expect(screen.getByText('form.save')).toBeEnabled())
    fireEvent.change(screen.getByLabelText('form.titleField'), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3))
    expect(mocks.create.mock.calls[2][2]).not.toBe(mocks.create.mock.calls[0][2])
  })

  it('preserves the logical attempt after a lost response and a whitespace-only title edit', async () => {
    mocks.create.mockRejectedValue(new Error('Lost response'))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(screen.getByText('form.save')).toBeEnabled())
    fireEvent.change(screen.getByLabelText('form.titleField'), { target: { value: 'Service ' } })
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
    expect(mocks.create.mock.calls[1][1]).toEqual(mocks.create.mock.calls[0][1])
    expect(mocks.create.mock.calls[1][2]).toBe(mocks.create.mock.calls[0][2])
  })

  it.each(['close', 'escape'] as const)('cancels the complete form during customer creation using %s', async action => {
    const pending = deferred<{ message: string; customer: typeof alice }>()
    mocks.customerCreate.mockReturnValue(pending.promise)
    const close = vi.fn()
    const view = render(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.email'), { target: { value: alice.email } })
    fireEvent.click(screen.getByText('customer.save'))
    if (action === 'close') fireEvent.click(document.querySelector('[data-tour="bundle-editor-close"]')!)
    else fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
    view.rerender(wrap(<CreatePaymentLinkDialog open={false} onClose={close} />))
    view.rerender(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await act(async () => pending.resolve({ message: 'Created', customer: alice }))
    await details()
    expect(screen.queryByTestId('selected-customer')).not.toBeInTheDocument()
    expect(screen.getByText('form.save')).toBeEnabled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('ignores obsolete create callbacks after closing and never sends the old destination', async () => {
    const pending = deferred<{ success: boolean; data: PaymentLink }>()
    mocks.create.mockReturnValue(pending.promise)
    const close = vi.fn()
    const view = render(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    fireEvent.click(screen.getByText('customer.createAndSend'))
    fireEvent.click(screen.getByText('customer.createAndSend'))
    view.rerender(wrap(<CreatePaymentLinkDialog open={false} onClose={close} />))
    view.rerender(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await act(async () => pending.resolve({ success: true, data: link }))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.share).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })

  it('does not query or create clients without permission; anonymous create stays available', async () => {
    state.read = false
    state.create = false
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    fireEvent.click(screen.getByText('wizard.paymentTitle'))
    fireEvent.click(screen.getByText('wizard.continue'))
    expect(screen.getByText('customer.noReadPermission')).toBeVisible()
    expect(screen.queryByText('customer.new')).not.toBeInTheDocument()
    expect(mocks.customers).not.toHaveBeenCalled()
    expect(mocks.customerCreate).not.toHaveBeenCalled()
  })

  it('uses the real customer envelope for email-only quick creation without marketing consent', async () => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.email'), { target: { value: 'alice@example.test' } })
    fireEvent.click(screen.getByText('customer.save'))
    await waitFor(() => expect(screen.getByTestId('selected-customer')).toHaveTextContent('Alice'))
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { email: 'alice@example.test' })
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith('venue-a', expect.objectContaining({ customerId: alice.id }), expect.any(String)),
    )
  })

  it.each([
    '+0445512345678',
    '+0455512345678',
    '+0525512345678',
    '+05215512345678',
    '+0005512345678',
    '+09995512345678',
    '+999123456789',
    'phone 5512345678',
    '+52abc5512345678',
    '991234567890',
    '+52999123456789',
    '1234567',
  ])('does not create a customer with an ambiguous or altered phone: %s', async raw => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.phone'), { target: { value: raw } })
    fireEvent.click(screen.getByText('customer.save'))
    expect(await screen.findByText('customer.invalidContact')).toBeVisible()
    expect(mocks.customerCreate).not.toHaveBeenCalled()
    expect(screen.queryByText('customer.createAndSend')).not.toBeInTheDocument()
  })

  it.each([
    ['+525512345678', '+525512345678'],
    ['525512345678', '+525512345678'],
    ['+5215512345678', '+525512345678'],
    ['5215512345678', '+525512345678'],
    ['0445512345678', '+525512345678'],
    ['0455512345678', '+525512345678'],
    ['+14155552671', '+14155552671'],
    ['+442079460018', '+442079460018'],
    ['+4512345678', '+4512345678'],
    ['+50622223333', '+50622223333'],
    ['55 1234 5678', '+525512345678'],
  ])('creates a customer with the reviewed phone %s as %s', async (raw, expected) => {
    mocks.customerCreate.mockResolvedValue({ message: 'Created', customer: { ...alice, phone: expected } })
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.phone'), { target: { value: raw } })
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByTestId('selected-customer')
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { phone: expected })
    fireEvent.click(screen.getByText('customer.createAndSend'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', expected))
  })

  it('requires an explicit country change for a local international customer phone', async () => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.click(screen.getByRole('combobox', { name: 'customer.country' }))
    fireEvent.click(await screen.findByText('Estados Unidos'))
    fireEvent.change(screen.getByLabelText('customer.phone'), { target: { value: '4155552671' } })
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByTestId('selected-customer')
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { phone: '+14155552671' })
  })

  it.each(['+5215512345678', '5215512345678'])('does not discard a legacy MX prefix while typing %s', async raw => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    const phone = screen.getByLabelText('customer.phone') as HTMLInputElement
    for (const character of raw) fireEvent.change(phone, { target: { value: phone.value + character } })
    expect(phone).toHaveValue(raw)
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByTestId('selected-customer')
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { phone: '+525512345678' })
  })

  it.each(['+52525512345678', '52525512345678', '+0445512345678', '+0455512345678'])(
    'does not create or send a different destination while typing a rejected number %s',
    async raw => {
      render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
      await details()
      fireEvent.click(screen.getByText('customer.new'))
      const phone = screen.getByLabelText('customer.phone') as HTMLInputElement
      for (const character of raw) fireEvent.change(phone, { target: { value: phone.value + character } })
      fireEvent.click(screen.getByText('customer.save'))
      expect(mocks.customerCreate).not.toHaveBeenCalled()
      expect(phone).toHaveValue(raw)
      expect(await screen.findByText('customer.invalidContact')).toBeVisible()
      expect(mocks.share).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['+525512345678', '+525512345678'],
    ['525512345678', '+525512345678'],
    ['+5215512345678', '+525512345678'],
    ['5215512345678', '+525512345678'],
    ['+14155552671', '+14155552671'],
    ['+442079460018', '+442079460018'],
    ['+4512345678', '+4512345678'],
    ['+50622223333', '+50622223333'],
    ['0445512345678', '+525512345678'],
    ['0455512345678', '+525512345678'],
    ['5512345678', '+525512345678'],
    ['5255123456', '+525255123456'],
  ])('keeps every character of quick-create input %s until saving it as %s', async (raw, expected) => {
    mocks.customerCreate.mockResolvedValue({ message: 'Created', customer: { ...alice, phone: expected } })
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    const phone = screen.getByLabelText('customer.phone') as HTMLInputElement
    let typed = ''
    for (const character of raw) {
      typed += character
      fireEvent.change(phone, { target: { value: typed } })
      expect(phone).toHaveValue(typed)
    }
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByTestId('selected-customer')
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { phone: expected })
    fireEvent.click(screen.getByText('customer.createAndSend'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', expected))
  })

  it('preserves backspace and re-editing an explicit prefix before quick creation', async () => {
    const expected = '+525255123456'
    mocks.customerCreate.mockResolvedValue({ message: 'Created', customer: { ...alice, phone: expected } })
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    const phone = screen.getByLabelText('customer.phone') as HTMLInputElement
    for (const raw of ['+52525512345678', '+5252551234567', '+525255123456', '5255123456']) {
      fireEvent.change(phone, { target: { value: raw } })
      expect(phone).toHaveValue(raw)
    }
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByTestId('selected-customer')
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { phone: expected })
  })

  it('recovers a lost customer response only if every contact matches an active unique customer', async () => {
    mocks.customerCreate.mockRejectedValue(new Error('Lost response'))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.email'), { target: { value: 'alice@example.test' } })
    fireEvent.change(screen.getByLabelText('customer.phone'), { target: { value: '5512345678' } })
    fireEvent.click(screen.getByText('customer.save'))
    await waitFor(() => expect(screen.getByTestId('selected-customer')).toHaveTextContent('Alice'))
    expect(mocks.customerCreate).toHaveBeenCalledTimes(1)
  })

  it('does not recover another identity that matches only one contact', async () => {
    mocks.customerCreate.mockRejectedValue({ response: { status: 400 } })
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.email'), { target: { value: 'alice@example.test' } })
    fireEvent.change(screen.getByLabelText('customer.phone'), { target: { value: '5599999999' } })
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByText('customer.chooseExisting')
    expect(screen.queryByTestId('selected-customer')).not.toBeInTheDocument()
  })

  it('prefills international customer phone in sharing, and editing it changes only the send', async () => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: { ...alice, phone: '+14155552671' } }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    const phone = screen.getByRole('textbox')
    await waitFor(() => expect(phone).toHaveValue('4155552671'))
    expect(screen.getByRole('combobox')).toHaveTextContent('+1')
    fireEvent.change(phone, { target: { value: '4155552672' } })
    fireEvent.click(screen.getByText('share.sendButton'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', '+14155552672'))
    expect(alice.phone).toBe('+525512345678')
  })

  it.each([
    ['525512345678', '5512345678', '+52'],
    ['5215512345678', '5512345678', '+52'],
    ['0445512345678', '5512345678', '+52'],
    ['0455512345678', '5512345678', '+52'],
    ['+5215512345678', '5512345678', '+52'],
    ['+525512345678', '5512345678', '+52'],
    ['+14155552671', '4155552671', '+1'],
    ['+442079460018', '2079460018', '+44'],
    ['+4512345678', '12345678', '+45'],
    ['+50622223333', '22223333', '+506'],
    ['+0445512345678', '', '+52'],
    ['+0455512345678', '', '+52'],
    ['+0525512345678', '', '+52'],
    ['+05215512345678', '', '+52'],
    ['+0005512345678', '', '+52'],
    ['+09995512345678', '', '+52'],
    ['+999123456789', '', '+52'],
    ['5512345678', '5512345678', '+52'],
    ['991234567890', '', '+52'],
    ['phone 5512345678', '', '+52'],
    ['+52999123456789', '', '+52'],
  ])('interprets saved phone %s without inventing a calling code', (stored, local, dial) => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: { ...alice, phone: stored } }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    expect(screen.getByRole('textbox')).toHaveValue(local)
    expect(screen.getByRole('combobox')).toHaveTextContent(dial)
    if (!local) {
      expect(screen.getByText('customer.reviewPhone')).toBeVisible()
      expect(screen.getByText('share.sendButton')).toBeDisabled()
    }
  })

  it.each([
    '+0445512345678',
    '+0455512345678',
    '+0525512345678',
    '+05215512345678',
    '+0005512345678',
    '+09995512345678',
    '+999123456789',
    'phone 5512345678',
    '+52abc5512345678',
    '991234567890',
    '+52999123456789',
    '1234567',
  ])('never sends a share message after an ambiguous or altered phone input: %s', raw => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: alice }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: raw } })
    expect(screen.getByText('share.sendButton')).toBeDisabled()
    fireEvent.click(screen.getByText('share.sendButton'))
    expect(mocks.share).not.toHaveBeenCalled()
  })

  it.each([
    ['+525512345678', '+525512345678'],
    ['525512345678', '+525512345678'],
    ['+5215512345678', '+525512345678'],
    ['5215512345678', '+525512345678'],
    ['0445512345678', '+525512345678'],
    ['0455512345678', '+525512345678'],
    ['+14155552671', '+14155552671'],
    ['+442079460018', '+442079460018'],
    ['+4512345678', '+4512345678'],
    ['+50622223333', '+50622223333'],
    ['55 1234 5678', '+525512345678'],
  ])('shares only to the reviewed phone %s as %s', async (raw, expected) => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: alice }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: raw } })
    fireEvent.click(screen.getByText('share.sendButton'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', expected))
    expect(alice.phone).toBe('+525512345678')
  })

  it('shares with a changed country only after that explicit choice', async () => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: alice }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    fireEvent.click(screen.getByRole('combobox', { name: 'customer.country' }))
    fireEvent.click(await screen.findByText('Estados Unidos'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '4155552671' } })
    fireEvent.click(screen.getByText('share.sendButton'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', '+14155552671'))
  })

  it.each(['+52525512345678', '52525512345678', '+0445512345678', '+0455512345678'])(
    'does not send a transformed destination while typing a rejected share input %s',
    raw => {
      render(
        wrap(
          <SharePaymentLinkDialog
            open
            onOpenChange={vi.fn()}
            link={{ ...link, customer: alice }}
            venueId="venue-a"
            checkoutBaseUrl="https://checkout.example.test"
          />,
        ),
      )
      const phone = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(phone, { target: { value: '' } })
      for (const character of raw) fireEvent.change(phone, { target: { value: phone.value + character } })
      fireEvent.click(screen.getByText('share.sendButton'))
      expect(mocks.share).not.toHaveBeenCalled()
      expect(phone).toHaveValue(raw)
      expect(screen.getByText('share.sendButton')).toBeDisabled()
    },
  )

  it.each([
    ['+525512345678', '+525512345678'],
    ['525512345678', '+525512345678'],
    ['+5215512345678', '+525512345678'],
    ['5215512345678', '+525512345678'],
    ['+14155552671', '+14155552671'],
    ['+442079460018', '+442079460018'],
    ['+4512345678', '+4512345678'],
    ['+50622223333', '+50622223333'],
    ['0445512345678', '+525512345678'],
    ['0455512345678', '+525512345678'],
    ['5512345678', '+525512345678'],
    ['5255123456', '+525255123456'],
  ])('keeps every character of share input %s until sending it as %s', async (raw, expected) => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: alice }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    const phone = screen.getByRole('textbox') as HTMLInputElement
    let typed = ''
    fireEvent.change(phone, { target: { value: typed } })
    for (const character of raw) {
      typed += character
      fireEvent.change(phone, { target: { value: typed } })
      expect(phone).toHaveValue(typed)
    }
    fireEvent.click(screen.getByText('share.sendButton'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', expected))
  })

  it('preserves backspace and re-editing after a saved phone was prefilled', async () => {
    render(
      wrap(
        <SharePaymentLinkDialog
          open
          onOpenChange={vi.fn()}
          link={{ ...link, customer: alice }}
          venueId="venue-a"
          checkoutBaseUrl="https://checkout.example.test"
        />,
      ),
    )
    const phone = screen.getByRole('textbox')
    expect(phone).toHaveValue('5512345678')
    for (const raw of ['+52525512345678', '+5252551234567', '+525255123456', '5255123456']) {
      fireEvent.change(phone, { target: { value: raw } })
      expect(phone).toHaveValue(raw)
    }
    fireEvent.click(screen.getByText('share.sendButton'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', '+525255123456'))
  })

  it.each([
    '+0445512345678',
    '+0455512345678',
    '+0525512345678',
    '+05215512345678',
    '+0005512345678',
    '+09995512345678',
    '+999123456789',
    'phone 5512345678',
    '991234567890',
    '+52999123456789',
  ])('does not offer create-and-send for ambiguous stored phone %s', async raw => {
    mocks.customers.mockResolvedValue(page([{ ...alice, phone: raw }]))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    expect(screen.queryByText('customer.createAndSend')).not.toBeInTheDocument()
  })

  it('uses the same saved-phone interpretation in create-and-send', async () => {
    mocks.customers.mockResolvedValue(page([{ ...alice, phone: '525512345678' }]))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    fireEvent.click(screen.getByText('customer.createAndSend'))
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith('venue-a', 'link-a', '+525512345678'))
  })

  it('paginates twenty at a time and retains selection when it is not on the current page', async () => {
    mocks.customers.mockImplementation(async (_venue, params) =>
      params.page === 2 ? page([{ ...alice, id: 'customer-b', firstName: 'Bob' }], 21, 2) : page([alice], 21),
    )
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    fireEvent.click(screen.getByText('customer.next'))
    await screen.findByRole('button', { name: /Bob/ })
    expect(mocks.customers).toHaveBeenLastCalledWith('venue-a', { page: 2, pageSize: 20, search: '' })
    expect(screen.getByTestId('selected-customer')).toHaveTextContent('Alice')
    fireEvent.change(screen.getByLabelText('customer.search'), { target: { value: 'bob' } })
    await waitFor(() => expect(mocks.customers).toHaveBeenLastCalledWith('venue-a', { page: 1, pageSize: 20, search: 'bob' }))
  })

  it('distinguishes an empty directory from a failed lookup and leaves search mounted', async () => {
    mocks.customers.mockResolvedValue(page([], 0))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    fireEvent.click(screen.getByText('wizard.paymentTitle'))
    fireEvent.click(screen.getByText('wizard.continue'))
    await screen.findByText('customer.empty')
    mocks.customers.mockRejectedValue(new Error('Network'))
    const search = screen.getByLabelText('customer.search')
    search.focus()
    fireEvent.change(search, { target: { value: 'error' } })
    await screen.findByText('customer.loadFailed', {}, { timeout: 4000 })
    expect(search).toHaveFocus()
    expect(screen.queryByText('customer.empty')).not.toBeInTheDocument()
  })

  it('creates a phone-only client and preserves it when saving the link fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Network'))
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.phone'), { target: { value: '5512345678' } })
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByTestId('selected-customer')
    expect(mocks.customerCreate).toHaveBeenCalledWith('venue-a', { phone: '+525512345678' })
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(screen.getByText('form.save')).toBeEnabled())
    expect(screen.getByTestId('selected-customer')).toHaveTextContent('Alice')
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2))
    expect(mocks.customerCreate).toHaveBeenCalledTimes(1)
  })

  it.each(['inactive', 'ambiguous', 'truncated'] as const)('never auto-selects a recovered %s customer', async kind => {
    mocks.customerCreate.mockRejectedValue({ response: { status: 400 } })
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    mocks.customers.mockResolvedValue(
      kind === 'inactive'
        ? page([{ ...alice, active: false }])
        : kind === 'ambiguous'
          ? page([alice, { ...alice, id: 'customer-b' }])
          : page([alice], 21),
    )
    fireEvent.click(screen.getByText('customer.new'))
    fireEvent.change(screen.getByLabelText('customer.email'), { target: { value: alice.email } })
    fireEvent.click(screen.getByText('customer.save'))
    await screen.findByText('customer.chooseExisting')
    expect(screen.queryByTestId('selected-customer')).not.toBeInTheDocument()
  })

  it('offers existing customers but explains the missing create permission', async () => {
    state.create = false
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await details()
    expect(screen.getByText('customer.noCreatePermission')).toBeVisible()
    expect(screen.queryByText('customer.new')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    expect(screen.getByTestId('selected-customer')).toHaveTextContent('Alice')
  })

  it('shows the immutable customer when editing and does not query the customer directory', async () => {
    render(wrap(<CreatePaymentLinkDialog open editingLinkId="link-a" onClose={vi.fn()} />))
    expect(await screen.findByTestId('selected-customer')).toHaveTextContent('Alice')
    expect(screen.getByText('customer.readOnly')).toBeVisible()
    expect(screen.queryByLabelText('customer.search')).not.toBeInTheDocument()
    expect(screen.queryByText('customer.remove')).not.toBeInTheDocument()
    expect(mocks.customers).not.toHaveBeenCalled()
  })

  it('keeps reusable donation links and explains attribution for every payment', async () => {
    render(wrap(<CreatePaymentLinkDialog open onClose={vi.fn()} />))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    fireEvent.click(screen.getByText('wizard.donationTitle'))
    fireEvent.click(screen.getByText('wizard.continue'))
    fireEvent.change(screen.getByLabelText('form.titleField'), { target: { value: 'Community fund' } })
    fireEvent.click(await screen.findByRole('button', { name: /Alice/ }))
    expect(screen.getByText('customer.reusableWarning')).toBeVisible()
    fireEvent.click(screen.getByText('form.save'))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'venue-a',
        expect.objectContaining({ isReusable: true, customerId: alice.id, purpose: 'DONATION' }),
        expect.any(String),
      ),
    )
  })

  it.each(['venue', 'actor'] as const)('never sends from an obsolete %s context', async scope => {
    const pending = deferred<{ success: boolean; data: PaymentLink }>()
    mocks.create.mockReturnValue(pending.promise)
    const close = vi.fn()
    const view = render(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await details()
    fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
    fireEvent.click(screen.getByText('customer.createAndSend'))
    if (scope === 'venue') state.venueId = 'venue-b'
    else state.actor = 'staff-b'
    view.rerender(wrap(<CreatePaymentLinkDialog open onClose={close} />))
    await act(async () => pending.resolve({ success: true, data: link }))
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.share).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })

  it('ignores a send response after the share dialog closes and reopens', async () => {
    const pending = deferred<{ success: boolean; data: { sent: boolean } }>()
    mocks.share.mockReturnValue(pending.promise)
    const changeOpen = vi.fn()
    const props = {
      onOpenChange: changeOpen,
      link: { ...link, customer: alice },
      venueId: 'venue-a',
      checkoutBaseUrl: 'https://checkout.example.test',
    }
    const view = render(wrap(<SharePaymentLinkDialog open {...props} />))
    const sendButton = screen.getByText('share.sendButton')
    fireEvent.click(sendButton)
    fireEvent.click(sendButton)
    view.rerender(wrap(<SharePaymentLinkDialog open={false} {...props} />))
    view.rerender(wrap(<SharePaymentLinkDialog open {...props} />))
    await act(async () => pending.resolve({ success: true, data: { sent: true } }))
    expect(changeOpen).not.toHaveBeenCalled()
    expect(mocks.share).toHaveBeenCalledTimes(1)
  })
})
