import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Devuelve la llave (+ valores interpolados): la convención del repo.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
    i18n: { language: 'es' },
  }),
}))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
const access = vi.hoisted(() => ({ allowed: ['giftCards:manage'] as string[] }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => access.allowed.includes(p), canAny: () => true, canAll: () => true, access: { userId: 'u1' } }),
}))
const change = vi.hoisted(() => vi.fn())
vi.mock('@/services/giftCard.service', () => ({ changeStoreCreditPhone: change }))

import { StoreCreditSection } from '../StoreCreditSection'

const CON_SALDO = { balanceCents: 15050, phoneLast4: '5678', giftCardId: 'g1' }
const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>)

describe('StoreCreditSection (ficha del cliente)', () => {
  beforeEach(() => {
    change.mockReset()
    toast.mockReset()
    access.allowed = ['giftCards:manage']
  })

  it('un server viejo (sin storeCredit) o un cliente sin sobre: no pinta nada', () => {
    const a = wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={undefined} />)
    expect(a.container).toBeEmptyDOMElement()
    a.unmount()
    const b = wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={null} />)
    expect(b.container).toBeEmptyDOMElement()
  })

  it('dice «Saldo a favor: $X» con los centavos del server en pesos', () => {
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={CON_SALDO} />)
    expect(screen.getByText(/storeCredit\.balance\(amount=\$150\.50\)/)).toBeInTheDocument()
    expect(screen.getByText(/storeCredit\.phone\(last4=5678\)/)).toBeInTheDocument()
  })

  it('«Cambiar» sólo con giftCards:manage', () => {
    access.allowed = []
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={CON_SALDO} />)
    expect(screen.getByText(/storeCredit\.phone/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'storeCredit.change' })).toBeNull()
  })

  it('cambiar el teléfono manda el que se mostró (expectedPhoneLast4) y avisa', async () => {
    change.mockResolvedValue({ giftCardId: 'g1', phoneLast4: '4321' })
    const user = userEvent.setup()
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={CON_SALDO} />)
    await user.click(screen.getByRole('button', { name: 'storeCredit.change' }))
    await user.type(screen.getByLabelText('storeCredit.newPhone'), '55 1234 4321')
    await user.click(screen.getByRole('button', { name: 'storeCredit.save' }))
    await waitFor(() => expect(change).toHaveBeenCalledWith('v1', 'g1', { phone: '5512344321', expectedPhoneLast4: '5678' }))
    await waitFor(() => expect(toast).toHaveBeenCalled())
  })

  it('un teléfono inválido no sale', async () => {
    const user = userEvent.setup()
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={CON_SALDO} />)
    await user.click(screen.getByRole('button', { name: 'storeCredit.change' }))
    await user.type(screen.getByLabelText('storeCredit.newPhone'), '123')
    await user.click(screen.getByRole('button', { name: 'storeCredit.save' }))
    expect(change).not.toHaveBeenCalled()
    expect(screen.getByText('storeCredit.invalidPhone')).toBeInTheDocument()
  })

  it('STORE_CREDIT_PHONE_OUTDATED: «el teléfono cambió, recarga»', async () => {
    change.mockRejectedValue({ response: { status: 409, data: { code: 'STORE_CREDIT_PHONE_OUTDATED' } } })
    const user = userEvent.setup()
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={CON_SALDO} />)
    await user.click(screen.getByRole('button', { name: 'storeCredit.change' }))
    await user.type(screen.getByLabelText('storeCredit.newPhone'), '5512344321')
    await user.click(screen.getByRole('button', { name: 'storeCredit.save' }))
    expect(await screen.findByText('storeCredit.outdated')).toBeInTheDocument()
  })

  it('STORE_CREDIT_PHONE_NOT_ALLOWED tiene su aviso', async () => {
    change.mockRejectedValue({ response: { status: 409, data: { code: 'STORE_CREDIT_PHONE_NOT_ALLOWED' } } })
    const user = userEvent.setup()
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={CON_SALDO} />)
    await user.click(screen.getByRole('button', { name: 'storeCredit.change' }))
    await user.type(screen.getByLabelText('storeCredit.newPhone'), '5512344321')
    await user.click(screen.getByRole('button', { name: 'storeCredit.save' }))
    expect(await screen.findByText('storeCredit.notAllowed')).toBeInTheDocument()
  })

  it('congelado: «Saldo a favor congelado» con la razón, no «$0»', () => {
    wrap(<StoreCreditSection venueId="v1" customerId="c1" storeCredit={{ ...CON_SALDO, balanceCents: 0, blocked: true }} />)
    expect(screen.getByText('storeCredit.blocked')).toBeInTheDocument()
    expect(screen.getByText('storeCredit.blockedWhy')).toBeInTheDocument()
    expect(screen.queryByText(/storeCredit\.balance/)).toBeNull()
  })
})
