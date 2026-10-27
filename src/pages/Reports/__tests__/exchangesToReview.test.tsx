import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import reports from '@/locales/es/reports.json'
import payment from '@/locales/es/payment.json'
import { ExchangesToReviewSection } from '../components/ExchangesToReviewSection'
import Refunds from '../Refunds'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), refunds: vi.fn(), toast: vi.fn(), permissions: [] as string[], venueId: 'v1' }))
vi.mock('@/api', () => ({ default: { get: (...args: unknown[]) => m.get(...args), post: (...args: unknown[]) => m.post(...args) } }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permissions.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: m.venueId, fullBasePath: '/venues/iq' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { timezone: 'America/Mexico_City' } }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (v: string) => v }),
  getLast7Days: () => ({ from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-08T00:00:00Z') }),
}))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('@/services/reports/refunds.service', () => ({
  fetchRefunds: (...args: unknown[]) => m.refunds(...args),
  refundsKeys: { report: (f: unknown) => ['refunds-report', f] },
}))
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const raw = key.split('.').reduce<any>((obj, part) => obj?.[part], ns === 'payment' ? payment : reports)
      return typeof raw === 'string' ? raw.replace(/\{\{(\w+)\}\}/g, (_, p) => String(opts?.[p] ?? '')) : key
    },
    i18n: { language: 'es' },
  }),
}))

function row(id = 'x1') {
  return {
    id,
    createdAt: '2026-10-26T18:00:00Z',
    status: 'NEEDS_REVIEW',
    originalOrderId: 'o1',
    newOrderId: 'o2',
    originalPaymentId: 'p1',
    chargePaymentId: 'p2',
    originalOrderNumber: 'ORD-001',
    newOrderNumber: `ORD-${id}`,
    differenceCents: 5050,
    reviewReason: 'CHARGE_AMOUNT_MISMATCH',
    staffName: 'Ana López',
    reviewedAt: null,
  }
}
const response = (items = [row()], total = items.length, nextCursor: string | null = null) => ({
  data: { success: true, data: { items, total, nextCursor, hayMas: !!nextCursor, siguienteOffset: 25 } },
})
const refundData = { totals: { totalRefunded: 10, totalTips: 0, count: 1 }, byReason: [], refunds: [] }
function mount(ui = <ExchangesToReviewSection />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
  return { ...view, client, invalidate }
}
async function openReview() {
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar revisado' }))
  return screen.getByRole('alertdialog')
}
beforeEach(() => {
  m.venueId = 'v1'
  m.permissions = ['payments:read', 'payments:refund']
  m.get.mockResolvedValue(response())
  m.post.mockResolvedValue({ data: { success: true, data: { ...row(), reviewedAt: '2026-10-26' } } })
  m.refunds.mockResolvedValue(refundData)
  m.toast.mockImplementation(() => {})
})

describe('ExchangesToReviewSection', () => {
  it('lists pending reviews with order numbers, difference, reason in plain words and who made it', async () => {
    mount()
    expect(await screen.findByText('ORD-001 → ORD-x1')).toBeVisible()
    expect(screen.getByText('$50.50')).toBeVisible()
    expect(screen.getByText('La terminal cobró otro importe')).toBeVisible()
    expect(screen.getByText('Ana López')).toBeVisible()
    expect(screen.getByText('2026-10-26T18:00:00Z')).toBeVisible()
    expect(m.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/exchanges', { params: { pendingReview: true, limit: 25 } })
  })
  it('shows totals and loads the 26th row by cursor after another manager removes a previous row', async () => {
    m.get
      .mockResolvedValueOnce(
        response(
          Array.from({ length: 25 }, (_, i) => row(`x${i}`)),
          26,
          'opaque+/==',
        ),
      )
      .mockResolvedValueOnce(response([row('last')], 25))
    mount()
    expect(await screen.findByText('Mostrando 25 de 26')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('ORD-001 → ORD-last')).toBeVisible()
    expect(m.get.mock.calls[1][1].params).toEqual({ pendingReview: true, limit: 25, cursor: 'opaque+/==' })
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
  })
  it('deduplicates repeated ids across pages', async () => {
    m.get.mockResolvedValueOnce(response([row()], 2, 'next')).mockResolvedValueOnce(response([row(), row('last')], 2))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('Mostrando 2 de 2')).toBeVisible()
    expect(screen.getAllByText('ORD-001 → ORD-x1')).toHaveLength(1)
  })
  it('does not carry rows or a review note into another venue', async () => {
    const { rerender, client } = mount()
    const dialog = await openReview()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Old venue note' } })
    m.venueId = 'v2'
    m.get.mockImplementation(() => new Promise(() => {}))
    rerender(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ExchangesToReviewSection />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByText('ORD-001 → ORD-x1')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
  it('keeps the review note when the refunds report finishes loading', async () => {
    let finish!: (value: unknown) => void
    m.refunds.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        }),
    )
    mount(<Refunds />)
    const dialog = await openReview()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Keep this note' } })
    await act(async () => {
      finish(refundData)
    })
    await screen.findByText('Sin reembolsos para este período')
    expect(screen.getByRole('textbox')).toHaveValue('Keep this note')
  })
  it('hides the section and does not fetch without payments:read', () => {
    m.permissions = ['payments:refund']
    const { container } = mount()
    expect(container).toBeEmptyDOMElement()
    expect(m.get).not.toHaveBeenCalled()
  })
  it('hides the button without payments:refund and handles missing staff and unknown reasons', async () => {
    m.permissions = ['payments:read']
    m.get.mockResolvedValue(response([{ ...row(), staffName: null, reviewReason: 'FUTURE_REASON' }]))
    mount()
    expect(await screen.findByText('FUTURE_REASON')).toBeVisible()
    expect(screen.getByText('—')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Marcar revisado' })).not.toBeInTheDocument()
  })
  it('shows an empty state distinct from a retryable failure', async () => {
    m.get.mockRejectedValue(new Error('Network'))
    mount()
    expect(await screen.findByText('No se pudieron cargar los cambios.')).toBeVisible()
    expect(screen.queryByText('No hay cambios por revisar')).not.toBeInTheDocument()
    m.get.mockResolvedValue(response([]))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay cambios por revisar')).toBeVisible()
  })
  it.each(['loading', 'failed'])('stays visible when the refunds report is %s', async state => {
    if (state === 'loading') m.refunds.mockImplementation(() => new Promise(() => {}))
    else m.refunds.mockRejectedValue(new Error('Refund report failed'))
    mount(<Refunds />)
    expect(await screen.findByText('ORD-001 → ORD-x1')).toBeVisible()
    if (state === 'failed') expect(await screen.findByText('Refund report failed')).toBeVisible()
  })
  it.each(['loading', 'failed'])('keeps the refund report visible when exchanges are %s', async state => {
    if (state === 'loading') m.get.mockImplementation(() => new Promise(() => {}))
    else m.get.mockRejectedValue(new Error('Network'))
    mount(<Refunds />)
    expect(await screen.findByText('Sin reembolsos para este período')).toBeVisible()
    if (state === 'failed') expect(await screen.findByText('No se pudieron cargar los cambios.')).toBeVisible()
  })
})

describe('ReviewExchangeDialog', () => {
  it('requires 3–500 trimmed characters, shows a counter, posts the note and refreshes list and drawers', async () => {
    const { invalidate } = mount()
    const dialog = await openReview()
    const note = within(dialog).getByRole('textbox', { name: 'Nota de revisión' })
    const submit = within(dialog).getByRole('button', { name: 'Marcar revisado' })
    expect(submit).toBeDisabled()
    for (const invalid of ['  a  ', 'a'.repeat(501)]) {
      fireEvent.change(note, { target: { value: invalid } })
      expect(submit).toBeDisabled()
    }
    fireEvent.change(note, { target: { value: 'a'.repeat(500) } })
    await waitFor(() => expect(submit).toBeEnabled())
    expect(within(dialog).getByText('500 / 500')).toBeVisible()
    fireEvent.change(note, { target: { value: '  Revisado con Ana  ' } })
    m.get.mockResolvedValue(response([]))
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(m.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/exchanges/x1/review', { note: 'Revisado con Ana' })
    expect(await screen.findByText('No hay cambios por revisar')).toBeVisible()
    for (const queryKey of [
      ['exchanges', 'v1'],
      ['exchange', 'v1', 'x1'],
      ['payment', 'p1'],
      ['payment', 'p2'],
      ['order', 'v1', 'o1'],
      ['order', 'v1', 'o2'],
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey })
    }
  })
  it('cannot close or submit twice while sending', async () => {
    let finish!: (value: unknown) => void
    m.post.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        }),
    )
    mount()
    const dialog = await openReview()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Visto' } })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Marcar revisado' })).toBeEnabled())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marcar revisado' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marcar revisado' }))
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('alertdialog')).toBeVisible()
    expect(within(dialog).getByRole('textbox')).toBeDisabled()
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1))
    await act(async () => {
      finish({ data: {} })
    })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
  it.each([
    ['EXCHANGE_ALREADY_REVIEWED', 'Alguien ya lo revisó'],
    ['EXCHANGE_NOT_IN_REVIEW', 'Ya no está por revisar'],
  ])('handles 409 %s at response.data.code, closes and refreshes', async (code, title) => {
    m.post.mockRejectedValue({ response: { status: 409, data: { code, message: 'Server message' } } })
    mount()
    const dialog = await openReview()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Visto' } })
    m.get.mockResolvedValue(response([]))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Marcar revisado' })).toBeEnabled())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marcar revisado' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title })))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByText('No hay cambios por revisar')).toBeVisible()
  })
  it('preserves the note on other failures for retry', async () => {
    m.post.mockRejectedValue({ response: { status: 500, data: {} } })
    mount()
    const dialog = await openReview()
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Visto' } })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Marcar revisado' })).toBeEnabled())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marcar revisado' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo guardar la revisión.')
    expect(within(dialog).getByRole('textbox')).toHaveValue('Visto')
  })
})
