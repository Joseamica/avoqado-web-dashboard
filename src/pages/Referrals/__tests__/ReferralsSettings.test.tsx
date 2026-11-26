import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import ReferralsSettings from '../ReferralsSettings'
import type { ReferralProgramConfig } from '@/types/referrals'

// D28 (hz:be99f328:D28): en pausa la página caía al formulario de primera activación con los números de fábrica y, al
// reactivar, mandaba un cupón de % por nivel que reemplazaba los premios guardados (un producto gratis se volvía cupón).

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts
        ? `${key}(${Object.entries(opts)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')})`
        : key,
    i18n: { language: 'es' },
  }),
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1' }) }))
const canMock = vi.fn()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: canMock, canAny: () => true, canAll: () => true }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: any) => <h1>{title}</h1> }))
vi.mock('../components/HallOfFame', () => ({ default: () => <div data-testid="hall-of-fame" /> }))
vi.mock('../components/RecentReferralsTable', () => ({ default: () => <div data-testid="recent-referrals" /> }))
// El resumen de cada nivel es el REAL (Codex r1 #4: un doble que imprimía el tipo pasaba aunque la página no lo enseñara).
const mockGetProduct = vi.fn()
vi.mock('@/services/menu.service', () => ({ getProduct: (...a: unknown[]) => mockGetProduct(...a) }))
vi.mock('../components/TierRewardEditor', () => ({ default: () => <div data-testid="tier-editor" /> }))

const mockGetConfig = vi.fn()
const mockGetSummary = vi.fn()
const mockActivate = vi.fn()
const mockReactivate = vi.fn()
const mockUpdateConfig = vi.fn()
const mockDeactivate = vi.fn()
vi.mock('@/services/referrals.service', () => ({
  default: {
    getConfig: (...a: unknown[]) => mockGetConfig(...a),
    getSummary: (...a: unknown[]) => mockGetSummary(...a),
    activate: (...a: unknown[]) => mockActivate(...a),
    reactivate: (...a: unknown[]) => mockReactivate(...a),
    updateConfig: (...a: unknown[]) => mockUpdateConfig(...a),
    deactivate: (...a: unknown[]) => mockDeactivate(...a),
  },
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <ReferralsSettings />
    </QueryClientProvider>,
  )
  return { ...view, client }
}

// Prisma `Decimal` viaja como texto en el JSON: el servidor responde «"12"», no 12.
const pausedConfig = {
  id: 'cfg-1',
  venueId: 'venue-1',
  active: false,
  activatedAt: '2026-11-01T12:00:00.000Z',
  newCustomerDiscountPercent: '12' as unknown as number,
  tier1ReferralsRequired: 5,
  tier2ReferralsRequired: 9,
  tier3ReferralsRequired: 15,
  rewardCouponExpiryDays: 30,
  tierRewards: [
    {
      id: 'tr-1',
      tierLevel: 1,
      rewardType: 'PERCENT_COUPON',
      recurrence: 'ONE_TIME',
      rewardPercent: '15',
      rewardProductId: null,
      rewardQuantity: 1,
      active: true,
      createdAt: '2026-11-01T12:00:00.000Z',
    },
    {
      id: 'tr-2',
      tierLevel: 2,
      rewardType: 'FREE_PRODUCT',
      recurrence: 'ONE_TIME',
      rewardPercent: null,
      rewardProductId: 'prod-1',
      rewardQuantity: 1,
      active: true,
      createdAt: '2026-11-01T12:00:00.000Z',
    },
    {
      id: 'tr-3',
      tierLevel: 3,
      rewardType: 'PERCENT_COUPON',
      recurrence: 'ONE_TIME',
      rewardPercent: '25',
      rewardProductId: null,
      rewardQuantity: 1,
      active: true,
      createdAt: '2026-11-01T12:00:00.000Z',
    },
  ],
} as unknown as ReferralProgramConfig

describe('ReferralsSettings', () => {
  beforeEach(() => {
    canMock.mockReturnValue(true)
    mockGetSummary.mockResolvedValue({
      referralsThisMonth: 0,
      conversionRate: 0,
      couponsEmittedThisMonth: 0,
      topReferrer: null,
    })
    mockActivate.mockResolvedValue({ ok: true })
    mockReactivate.mockResolvedValue({ ok: true, reactivated: true })
    mockUpdateConfig.mockResolvedValue({ ok: true })
    mockGetProduct.mockResolvedValue({ id: 'prod-1', name: 'Smoothie verde' })
  })

  it('en pausa enseña lo guardado (también el producto gratis) y no el formulario de fábrica', async () => {
    mockGetConfig.mockResolvedValue(pausedConfig)
    renderPage()

    expect(await screen.findByText('paused.banner')).toBeInTheDocument()
    expect(
      await screen.findByText(
        'activate.tierSummaryLine(level=2,referralsCount=9,rewards=activate.rewardFreeProduct(quantity=1,product=Smoothie verde))',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.queryByText('activate.submit')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('10')).not.toBeInTheDocument()
  })

  it('«Reactivar» prende lo guardado por /reactivate y nunca por /activate (que reescribe premio, niveles y premios)', async () => {
    mockGetConfig.mockResolvedValueOnce(pausedConfig).mockResolvedValue({ ...pausedConfig, active: true })
    renderPage()

    fireEvent.click(await screen.findByText('paused.reactivate'))

    await waitFor(() => expect(mockReactivate).toHaveBeenCalledTimes(1))
    expect(mockReactivate).toHaveBeenCalledWith('venue-1')
    expect(mockActivate).not.toHaveBeenCalled()
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'paused.reactivated' }))
    // La página vuelve a leer y enseña el programa activo (no se queda en «en pausa»).
    expect(await screen.findByText('active.pauseButton')).toBeInTheDocument()
    expect(screen.queryByText('paused.banner')).not.toBeInTheDocument()
  })

  it('un nivel sin premios dice «sin premio», no un % que nadie entrega', async () => {
    mockGetConfig.mockResolvedValue({
      ...pausedConfig,
      active: true,
      tierRewards: pausedConfig.tierRewards!.filter(r => r.tierLevel !== 3),
    })
    renderPage()

    expect(await screen.findByText('activate.tierSummaryLine(level=3,referralsCount=15,rewards=activate.rewardNone)')).toBeInTheDocument()
  })

  it('una configuración sin ninguna fila de premios tampoco cae en la tabla de % de fábrica', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true, tierRewards: [] })
    renderPage()

    expect(await screen.findByText('activate.tierSummaryLine(level=1,referralsCount=5,rewards=activate.rewardNone)')).toBeInTheDocument()
  })

  it('activo: «Editar» del premio al referido y de la vigencia guarda sólo lo que cambió', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true })
    renderPage()

    fireEvent.click(await screen.findByTestId('referrals-new-customer-discount-edit-btn'))
    const discount = await screen.findByLabelText('activate.newCustomerDiscount')
    expect(discount).toHaveValue(12)
    expect(screen.getByLabelText('activate.tierExpiry')).toHaveValue(30)

    fireEvent.change(discount, { target: { value: '18' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
    expect(mockUpdateConfig).toHaveBeenCalledWith('venue-1', { newCustomerDiscountPercent: 18 })
  })

  // Codex r2 #3: otra persona guarda 20 % con el editor abierto; quien cambia sólo la vigencia no debe regresar el 12 %.
  it('el editor manda sólo lo que la persona tocó, aunque la configuración cambie con la ventana abierta', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true })
    const { client } = renderPage()

    fireEvent.click(await screen.findByTestId('referrals-new-customer-discount-edit-btn'))
    const expiry = await screen.findByLabelText('activate.tierExpiry')

    // Llega la versión de otra persona (20 %) mientras la ventana sigue abierta.
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true, newCustomerDiscountPercent: '20' as unknown as number })
    await client.invalidateQueries({ queryKey: ['referrals-config', 'venue-1'] })
    expect(await screen.findByText('20%')).toBeInTheDocument()

    fireEvent.change(expiry, { target: { value: '45' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
    expect(mockUpdateConfig).toHaveBeenCalledWith('venue-1', { rewardCouponExpiryDays: 45 })
  })

  // Codex r4 #3: cerrar la ventana mientras guarda y volver a abrirla dejaba que el guardado viejo cerrara la nueva.
  it('mientras guarda, la ventana no se cierra (ni con Esc)', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true })
    let terminar: (v: unknown) => void = () => {}
    mockUpdateConfig.mockReturnValue(new Promise(resolve => (terminar = resolve)))
    renderPage()

    fireEvent.click(await screen.findByTestId('referrals-expiry-edit-btn'))
    const expiry = await screen.findByLabelText('activate.tierExpiry')
    fireEvent.change(expiry, { target: { value: '45' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))

    fireEvent.keyDown(expiry, { key: 'Escape', code: 'Escape' })
    expect(screen.getByLabelText('activate.tierExpiry')).toBeInTheDocument()
    // Codex r5 #4: lo que se escribiera ahora se perdería al cerrar: los campos van apagados mientras guarda.
    expect(screen.getByLabelText('activate.tierExpiry')).toBeDisabled()
    expect(screen.getByLabelText('activate.newCustomerDiscount')).toBeDisabled()

    terminar({ ok: true })
    await waitFor(() => expect(screen.queryByLabelText('activate.tierExpiry')).not.toBeInTheDocument())
  })

  // Codex r5 #5: sin red, el guardado no se queda «en espera» con la ventana atrapada: se intenta, falla y se puede cerrar.
  it('sin red, «Guardar» se intenta (no espera a que vuelva la red) y la ventana se puede cerrar', async () => {
    const { onlineManager } = await import('@tanstack/react-query')
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true })
    mockUpdateConfig.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
    renderPage()

    fireEvent.click(await screen.findByTestId('referrals-expiry-edit-btn'))
    const expiry = await screen.findByLabelText('activate.tierExpiry')
    onlineManager.setOnline(false)
    try {
      fireEvent.change(expiry, { target: { value: '45' } })
      fireEvent.click(screen.getByText('basicsEditor.save'))

      await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
      expect(await screen.findByText('basicsEditor.error')).toBeInTheDocument()
      fireEvent.keyDown(screen.getByLabelText('activate.tierExpiry'), { key: 'Escape', code: 'Escape' })
      await waitFor(() => expect(screen.queryByLabelText('activate.tierExpiry')).not.toBeInTheDocument())
    } finally {
      onlineManager.setOnline(true)
    }
  })

  // Codex r3 #7: volver a escribir el mismo número de otra forma («12.0») no cuenta como cambio.
  it('el mismo número escrito distinto no se manda', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true })
    renderPage()

    fireEvent.click(await screen.findByTestId('referrals-new-customer-discount-edit-btn'))
    fireEvent.change(await screen.findByLabelText('activate.newCustomerDiscount'), { target: { value: '12.0' } })
    fireEvent.change(screen.getByLabelText('activate.tierExpiry'), { target: { value: '45' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
    expect(mockUpdateConfig).toHaveBeenCalledWith('venue-1', { rewardCouponExpiryDays: 45 })
  })

  // Codex r2 #4: un valor viejo fuera de rango (12.5 % puesto por el MCP) no impide cambiar sólo la vigencia.
  it('un valor guardado que el editor no aceptaría no bloquea cambiar el otro campo', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true, newCustomerDiscountPercent: '12.5' as unknown as number })
    renderPage()

    fireEvent.click(await screen.findByTestId('referrals-expiry-edit-btn'))
    fireEvent.change(await screen.findByLabelText('activate.tierExpiry'), { target: { value: '45' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))

    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledTimes(1))
    expect(mockUpdateConfig).toHaveBeenCalledWith('venue-1', { rewardCouponExpiryDays: 45 })
  })

  it('el editor rechaza lo que el servidor rechaza (más de 100 %, vigencia sin días o con decimales)', async () => {
    mockGetConfig.mockResolvedValue({ ...pausedConfig, active: true })
    renderPage()

    fireEvent.click(await screen.findByTestId('referrals-new-customer-discount-edit-btn'))
    const discount = await screen.findByLabelText('activate.newCustomerDiscount')
    const expiry = screen.getByLabelText('activate.tierExpiry')

    fireEvent.change(discount, { target: { value: '101' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))
    expect(await screen.findByText('basicsEditor.errors.discount')).toBeInTheDocument()

    fireEvent.change(discount, { target: { value: '12' } })
    fireEvent.change(expiry, { target: { value: '0' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))
    expect(await screen.findByText('basicsEditor.errors.expiry')).toBeInTheDocument()

    fireEvent.change(expiry, { target: { value: '1.5' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))
    expect(await screen.findByText('basicsEditor.errors.expiry')).toBeInTheDocument()

    // Más estrecho que el SERVIDOR donde la caja no aguanta: % con decimales (ANDROID y TPV lo leen entero) y vigencias
    // que dan una fecha inválida al emitir el cupón (Codex r1 #5 y #6).
    fireEvent.change(expiry, { target: { value: '100000000' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))
    expect(await screen.findByText('basicsEditor.errors.expiry')).toBeInTheDocument()

    fireEvent.change(expiry, { target: { value: '30' } })
    fireEvent.change(discount, { target: { value: '12.5' } })
    fireEvent.click(screen.getByText('basicsEditor.save'))
    expect(await screen.findByText('basicsEditor.errors.discount')).toBeInTheDocument()

    expect(mockUpdateConfig).not.toHaveBeenCalled()
  })

  it('sin configuración previa sigue el formulario de primera activación', async () => {
    mockGetConfig.mockResolvedValue({ active: false })
    renderPage()

    expect(await screen.findByText('activate.submit')).toBeInTheDocument()
    expect(screen.queryByText('paused.reactivate')).not.toBeInTheDocument()
  })
})
