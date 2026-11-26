import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import ReferralCard from '../ReferralCard'
import type { ReferralRecord } from '@/types/referrals'

// ─── i18n: echo key (+ interpolated values) — repo convention (see
// TierRewardSummary.test.tsx / TierRewardEditor.test.tsx) ───────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
    i18n: { language: 'es' },
  }),
}))

// ─── toast ───────────────────────────────────────────────────────────────
const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

// ─── venue-local date formatting ───────────────────────────────────────────
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (d: string) => (d ? d.split('T')[0] : d),
  }),
}))

// ─── permissions ────────────────────────────────────────────────────────────
const canMock = vi.fn((_perm?: string) => true)
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: canMock, canAny: () => true, canAll: () => true }),
}))

// ─── product catalog ────────────────────────────────────────────────────────
const mockGetProduct = vi.fn()
vi.mock('@/services/menu.service', () => ({
  getProduct: (...args: unknown[]) => mockGetProduct(...args),
}))

// ─── referrals service ──────────────────────────────────────────────────────
const mockGetCustomerReferrals = vi.fn()
const mockFulfillGrant = vi.fn()
const mockGenerateCustomerCode = vi.fn()
const mockGetShareLink = vi.fn()
vi.mock('@/services/referrals.service', () => ({
  default: {
    getCustomerReferrals: (...args: unknown[]) => mockGetCustomerReferrals(...args),
    getShareLink: (...args: unknown[]) => mockGetShareLink(...args),
    fulfillGrant: (...args: unknown[]) => mockFulfillGrant(...args),
    generateCustomerCode: (...args: unknown[]) => mockGenerateCustomerCode(...args),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const baseCustomer = {
  id: 'cust-1',
  firstName: 'Ana',
  lastName: 'Referidora',
  referralCode: 'ANA123',
  referralCount: 2,
  referralTier: null,
  tierUnlockedAt: null,
  referredByCustomer: null,
}

function makeReferral(overrides: Partial<ReferralRecord> = {}): ReferralRecord {
  return {
    id: 'ref-1',
    status: 'QUALIFIED',
    createdAt: '2026-06-01T00:00:00.000Z',
    qualifiedAt: '2026-06-02T00:00:00.000Z',
    voidedAt: null,
    forcedOverride: false,
    referrerCustomer: { id: 'cust-1', firstName: 'Ana', lastName: 'Referidora', referralTier: null },
    referredCustomer: { id: 'ref-cust-1', firstName: 'Beto', lastName: 'Referido' },
    rewardDiscount: null,
    ...overrides,
  }
}

describe('ReferralCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canMock.mockReturnValue(true)
    mockGetCustomerReferrals.mockResolvedValue([])
    mockGetShareLink.mockResolvedValue({ whatsappShareUrl: 'https://wa.me/?text=x', message: 'x', code: 'ANA123', venueName: 'Mi Negocio' })
  })

  // D30 (hz:be99f328:D30): el mensaje decía «10%» fijo. Lo arma el SERVIDOR con el premio al referido guardado, y se lee
  // al tocar el botón (nunca de una lectura guardada: Codex r1 #7, r2 #2 y r3 #6 encontraron ligas viejas tras pausar o
  // cambiar el %). La ventana se abre en el mismo toque, para que el navegador no la bloquee, y luego se llena o se cierra.
  function fakeWindow() {
    return { location: { href: '' }, close: vi.fn(), opener: {} as unknown }
  }

  it('WhatsApp abre el mensaje que arma el servidor con el premio real', async () => {
    const url = 'https://wa.me/?text=%C2%A1Te%20recomiendo%20Mi%20Negocio!%20Usa%20mi%20c%C3%B3digo%20*ANA123*%20y%20te%20dan%2015%25'
    mockGetShareLink.mockResolvedValue({ whatsappShareUrl: url, message: '…15%…', code: 'ANA123', venueName: 'Mi Negocio', programActive: true })
    const win = fakeWindow()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)
    fireEvent.click(screen.getByTestId('referral-card-whatsapp-btn'))

    expect(openSpy).toHaveBeenCalledWith('', '_blank')
    expect(win.opener).toBeNull()
    await waitFor(() => expect(win.location.href).toBe(url))
    expect(mockGetShareLink).toHaveBeenCalledWith('venue-1', 'cust-1')
    expect(win.close).not.toHaveBeenCalled()
  })

  it('cada toque vuelve a preguntar al servidor (nada de ligas guardadas)', async () => {
    const ventanas = [fakeWindow(), fakeWindow()]
    vi.spyOn(window, 'open')
      .mockReturnValueOnce(ventanas[0] as unknown as Window)
      .mockReturnValueOnce(ventanas[1] as unknown as Window)
    mockGetShareLink
      .mockResolvedValueOnce({ whatsappShareUrl: 'https://wa.me/?text=15', message: 'x', code: 'ANA123', venueName: 'Mi Negocio', programActive: true })
      .mockResolvedValueOnce({ whatsappShareUrl: 'https://wa.me/?text=20', message: 'x', code: 'ANA123', venueName: 'Mi Negocio', programActive: true })

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)
    fireEvent.click(screen.getByTestId('referral-card-whatsapp-btn'))
    await waitFor(() => expect(ventanas[0].location.href).toBe('https://wa.me/?text=15'))
    await waitFor(() => expect(screen.getByTestId('referral-card-whatsapp-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('referral-card-whatsapp-btn'))

    // El segundo toque abre lo que el servidor dice AHORA (el % cambió a 20), no la liga del primero.
    await waitFor(() => expect(ventanas[1].location.href).toBe('https://wa.me/?text=20'))
    expect(mockGetShareLink).toHaveBeenCalledTimes(2)
  })

  // Codex r4 #1: con las ventanas emergentes bloqueadas no puede fallar en silencio.
  it('si el navegador bloquea la ventana, lo dice', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    mockGetShareLink.mockResolvedValue({ whatsappShareUrl: 'https://wa.me/?text=x', message: 'x', code: 'ANA123', venueName: 'Mi Negocio', programActive: true })

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)
    fireEvent.click(screen.getByTestId('referral-card-whatsapp-btn'))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'card.whatsappBlocked', variant: 'destructive' })),
    )
  })

  it('con el programa en pausa no comparte el código (la caja lo rechazaría) y lo dice', async () => {
    mockGetShareLink.mockResolvedValue({ whatsappShareUrl: 'https://wa.me/?text=x', message: 'x', code: 'ANA123', venueName: 'Mi Negocio', programActive: false })
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)
    fireEvent.click(screen.getByTestId('referral-card-whatsapp-btn'))

    await waitFor(() => expect(win.close).toHaveBeenCalled())
    expect(win.location.href).toBe('')
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'card.whatsappPaused' }))
  })

  it('si el servidor no da la liga (sin plan, sin red), cierra la ventana y avisa', async () => {
    mockGetShareLink.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403 } }))
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)
    fireEvent.click(screen.getByTestId('referral-card-whatsapp-btn'))

    await waitFor(() => expect(win.close).toHaveBeenCalled())
    expect(win.location.href).toBe('')
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'card.whatsappError', variant: 'destructive' }))
  })

  it('renders reward badges per referral with status-based styling', async () => {
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({
        rewards: [
          { id: 'grant-1', rewardType: 'PERCENT_COUPON', rewardPercent: '15', rewardProductId: null, rewardQuantity: 1, status: 'ISSUED', couponCode: 'ABC123' },
        ],
      }),
    ])

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)

    fireEvent.click(screen.getByTestId('referral-card-toggle-list'))

    await waitFor(() =>
      expect(screen.getByTestId('referral-card-reward-badge-grant-1')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('referral-card-reward-badge-grant-1')).toHaveTextContent(
      'card.rewardBadgeCouponWithCode(percent=15,code=ABC123)',
    )
  })

  it('shows a check icon for REDEEMED and MANUAL_FULFILLED grants, strikethrough styling for REVOKED', async () => {
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({
        id: 'ref-a',
        rewards: [
          { id: 'g-redeemed', rewardType: 'PERCENT_COUPON', rewardPercent: '10', rewardProductId: null, rewardQuantity: 1, status: 'REDEEMED', couponCode: null },
        ],
      }),
      makeReferral({
        id: 'ref-b',
        referredCustomer: { id: 'ref-cust-2', firstName: 'Carla', lastName: null },
        rewards: [
          { id: 'g-revoked', rewardType: 'PERMANENT_DISCOUNT', rewardPercent: '5', rewardProductId: null, rewardQuantity: 1, status: 'REVOKED', couponCode: null },
        ],
      }),
    ])

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)
    fireEvent.click(screen.getByTestId('referral-card-toggle-list'))

    await waitFor(() => expect(screen.getByTestId('referral-card-reward-badge-g-redeemed')).toBeInTheDocument())
    expect(screen.getByTestId('referral-card-reward-badge-g-redeemed').querySelector('svg')).toBeTruthy()

    const revokedBadge = screen.getByTestId('referral-card-reward-badge-g-revoked')
    expect(revokedBadge.className).toContain('line-through')
    expect(revokedBadge.querySelector('svg')).toBeFalsy()
  })

  it('shows the "Cortesía pendiente" block with a fulfill button for MANUAL_PENDING FREE_PRODUCT grants, gated by referral:fulfill-courtesy', async () => {
    mockGetProduct.mockResolvedValue({ id: 'prod-1', name: 'Sesión Iyashi' })
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({
        rewards: [
          { id: 'grant-pending', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: 'prod-1', rewardQuantity: 2, status: 'MANUAL_PENDING', couponCode: null },
        ],
      }),
    ])

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('referral-card-pending-courtesies')).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByTestId('referral-card-pending-item-grant-pending')).toHaveTextContent(
        'card.pendingCourtesyItem(quantity=2,product=Sesión Iyashi,name=Beto Referido)',
      ),
    )
    expect(screen.getByTestId('referral-card-fulfill-btn-grant-pending')).toBeInTheDocument()
  })

  it('hides the fulfill button when the user lacks referral:fulfill-courtesy', async () => {
    canMock.mockImplementation((perm: string) => perm !== 'referral:fulfill-courtesy')
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({
        rewards: [
          { id: 'grant-pending', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: null, rewardQuantity: 1, status: 'MANUAL_PENDING', couponCode: null },
        ],
      }),
    ])

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('referral-card-pending-courtesies')).toBeInTheDocument())
    expect(screen.queryByTestId('referral-card-fulfill-btn-grant-pending')).not.toBeInTheDocument()
  })

  it('fulfills a pending courtesy: confirm dialog -> calls fulfillGrant with the right args -> invalidates + toasts success', async () => {
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({
        rewards: [
          { id: 'grant-pending', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: null, rewardQuantity: 1, status: 'MANUAL_PENDING', couponCode: null },
        ],
      }),
    ])
    mockFulfillGrant.mockResolvedValue({
      id: 'grant-pending',
      venueId: 'venue-1',
      status: 'MANUAL_FULFILLED',
      fulfilledAt: '2026-07-02T10:00:00.000Z',
    })

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('referral-card-fulfill-btn-grant-pending')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('referral-card-fulfill-btn-grant-pending'))

    // Confirm dialog appears (Radix AlertDialog renders role="alertdialog") — click its
    // confirm action, scoped to the dialog to avoid matching the row's own trigger button
    // (both use the same translated "card.fulfillButton" label).
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('card.fulfillButton'))

    await waitFor(() => expect(mockFulfillGrant).toHaveBeenCalledWith('venue-1', 'grant-pending'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'card.fulfillSuccess' }))
    // Query invalidation causes a refetch of the same query — called at least twice
    // (initial mount + after invalidate).
    await waitFor(() => expect(mockGetCustomerReferrals).toHaveBeenCalledTimes(2))
  })

  it('shows a friendly message on 409 GRANT_NO_PENDIENTE', async () => {
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({
        rewards: [
          { id: 'grant-pending', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: null, rewardQuantity: 1, status: 'MANUAL_PENDING', couponCode: null },
        ],
      }),
    ])
    mockFulfillGrant.mockRejectedValue({ response: { status: 409, data: { error: 'GRANT_NO_PENDIENTE' } } })

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('referral-card-fulfill-btn-grant-pending')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('referral-card-fulfill-btn-grant-pending'))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByText('card.fulfillButton'))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: 'card.fulfillError',
        description: 'card.fulfillErrorAlreadyHandled',
        variant: 'destructive',
      }),
    )
  })

  it('renders exactly as before (no pending block, no badges) when referrals have no rewards[] (legacy/backward compat)', async () => {
    mockGetCustomerReferrals.mockResolvedValue([
      makeReferral({ rewardDiscount: { id: 'd1', value: 10, active: true } }),
    ])

    renderWithClient(<ReferralCard customer={baseCustomer} venueId="venue-1" />)

    fireEvent.click(screen.getByTestId('referral-card-toggle-list'))

    await waitFor(() => expect(screen.getByTestId('referral-card-referrals-list')).toBeInTheDocument())
    expect(screen.queryByTestId('referral-card-pending-courtesies')).not.toBeInTheDocument()
    expect(screen.queryByTestId(/referral-card-reward-badge-/)).not.toBeInTheDocument()
  })

  it('State C (no code): activate button still works and no pending-courtesy fetch happens', () => {
    const customerNoCode = { ...baseCustomer, referralCode: null, referralCount: 0 }
    renderWithClient(<ReferralCard customer={customerNoCode} venueId="venue-1" />)

    expect(screen.getByTestId('referral-card-activate-btn')).toBeInTheDocument()
    expect(mockGetCustomerReferrals).not.toHaveBeenCalled()
  })
})
