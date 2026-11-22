import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CouponForm from '../CouponForm'
import DiscountForm from '../DiscountForm'
import BulkGenerateDialog from '../components/BulkGenerateDialog'
import { CreateDiscountDialog } from '../components/CreateDiscountDialog'
import { DiscountWizard } from '../components/DiscountWizard'

// D38 (21-nov): dos clics seguidos en «Guardar Cambios» de un cupón nuevo mandaban dos POST; el segundo chocaba con el código
// único y la persona veía un error aunque su cupón sí se creó. El botón se apagaba con `isPending`, que llega un render tarde.
// Dos `.click()` en el MISMO act es el doble clic de verdad. Lo mismo en los formularios hermanos de Promociones.

const svc = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  toast: vi.fn(),
  getCoupon: vi.fn(),
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  bulkGenerate: vi.fn(),
  getDiscounts: vi.fn(),
  getDiscount: vi.fn(),
  createDiscount: vi.fn(),
  updateDiscount: vi.fn(),
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => svc.params }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: svc.toast }) }))
vi.mock('@/utils/datetime', async orig => ({
  ...(await orig<typeof import('@/utils/datetime')>()),
  useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }),
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('../components/DiscountFormFields', () => ({ DiscountFormFields: () => null }))
vi.mock('../hooks/useDiscountFormData', () => ({
  useDiscountFormData: () => ({ products: [], categoryOptions: [], customerGroupOptions: [], dayOptions: [], isLoading: false }),
}))
vi.mock('../components/wizard-steps/WizardStep1BasicInfo', () => ({ WizardStep1BasicInfo: () => null }))
vi.mock('../components/wizard-steps/WizardStep2Scope', () => ({ WizardStep2Scope: () => null }))
vi.mock('../components/wizard-steps/WizardStep3Rules', () => ({ WizardStep3Rules: () => null }))
vi.mock('../components/wizard-steps/WizardStep4Advanced', () => ({ WizardStep4Advanced: () => null }))
vi.mock('@/services/coupon.service', () => ({ default: svc }))
vi.mock('@/services/discount.service', () => ({ default: svc }))

const DESCUENTO = { id: 'd1', venueId: 'v1', name: 'Mayo', type: 'PERCENTAGE', value: 10, scope: 'ORDER', active: true }
const CUPON = {
  id: 'c1',
  discountId: 'd1',
  code: 'MAYO10',
  active: true,
  maxUses: null,
  maxUsesPerCustomer: null,
  validFrom: null,
  validUntil: null,
}

/** Una petición que no contesta: el primer envío sigue en vuelo cuando llega el segundo clic. */
const enVuelo = () => new Promise<never>(() => {})

const pintar = (ui: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const dobleClic = async (boton: HTMLElement) => {
  await act(async () => {
    boton.click()
    boton.click()
  })
}

/** Espera la primera llamada y da tiempo a que una segunda (la que no debe salir) también llegue. */
const unaSolaVez = async (fn: ReturnType<typeof vi.fn>) => {
  await waitFor(() => expect(fn).toHaveBeenCalled())
  await act(() => new Promise(r => setTimeout(r, 30)))
  expect(fn).toHaveBeenCalledTimes(1)
}

beforeEach(() => {
  vi.clearAllMocks()
  svc.params = {}
  svc.getDiscounts.mockResolvedValue({ data: [DESCUENTO] })
  svc.getDiscount.mockResolvedValue(DESCUENTO)
  svc.getCoupon.mockResolvedValue(CUPON)
})
afterEach(cleanup)

describe('D38 · un doble clic en guardar manda UNA petición', () => {
  it('Crear cupón: dos clics en «Guardar» ⇒ un solo POST', async () => {
    svc.createCoupon.mockImplementation(enVuelo)
    pintar(<CouponForm />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'select' }), { target: { value: 'd1' } })
    await dobleClic(screen.getByRole('button', { name: 'coupons.actions.save' }))
    await unaSolaVez(svc.createCoupon)
  })

  it('Crear cupón: si la petición falla, el candado se suelta y el siguiente clic sí manda', async () => {
    svc.createCoupon.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Ya existe' } } }).mockImplementation(enVuelo)
    pintar(<CouponForm />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'select' }), { target: { value: 'd1' } })
    const guardar = screen.getByRole('button', { name: 'coupons.actions.save' })
    await dobleClic(guardar)
    await waitFor(() =>
      expect(svc.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Ya existe', variant: 'destructive' })),
    )
    await dobleClic(screen.getByRole('button', { name: 'coupons.actions.save' }))
    await waitFor(() => expect(svc.createCoupon).toHaveBeenCalledTimes(2))
    await act(() => new Promise(r => setTimeout(r, 30)))
    expect(svc.createCoupon).toHaveBeenCalledTimes(2)
  })

  it('Editar cupón: dos clics en «Guardar» ⇒ un solo PUT', async () => {
    svc.params = { couponId: 'c1' }
    svc.updateCoupon.mockImplementation(enVuelo)
    pintar(<CouponForm />)
    await dobleClic(await screen.findByRole('button', { name: 'coupons.actions.save' }))
    await unaSolaVez(svc.updateCoupon)
  })

  it('Generar cupones en lote: dos clics en «Generar» ⇒ un solo POST', async () => {
    svc.bulkGenerate.mockImplementation(enVuelo)
    pintar(<BulkGenerateDialog venueId="v1" discounts={[DESCUENTO as never]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'select' }), { target: { value: 'd1' } })
    await dobleClic(screen.getByRole('button', { name: 'coupons.bulkGenerate.generate' }))
    await unaSolaVez(svc.bulkGenerate)
  })

  it('Crear descuento (página): dos clics en «Guardar» ⇒ un solo POST', async () => {
    svc.createDiscount.mockImplementation(enVuelo)
    pintar(<DiscountForm />)
    await dobleClic(await screen.findByRole('button', { name: 'discounts.actions.save' }))
    await unaSolaVez(svc.createDiscount)
  })

  it('Editar descuento (página): dos clics en «Guardar» ⇒ un solo PUT', async () => {
    svc.params = { discountId: 'd1' }
    svc.updateDiscount.mockImplementation(enVuelo)
    pintar(<DiscountForm />)
    await dobleClic(await screen.findByRole('button', { name: 'discounts.actions.save' }))
    await unaSolaVez(svc.updateDiscount)
  })

  it('Crear descuento desde el cupón (ventana): dos clics en «Crear» ⇒ un solo POST', async () => {
    svc.createDiscount.mockImplementation(enVuelo)
    pintar(<CreateDiscountDialog venueId="v1" onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'discounts.create.title' }))
    await dobleClic(await screen.findByRole('button', { name: 'discounts.actions.create' }))
    await unaSolaVez(svc.createDiscount)
  })

  it.each([
    ['crear', undefined, 'discounts.wizard.create', 'createDiscount'],
    ['editar', DESCUENTO, 'save', 'updateDiscount'],
  ] as const)('Asistente de descuento (%s): dos clics en el último paso ⇒ una sola petición', async (_modo, editar, boton, metodo) => {
    svc[metodo].mockImplementation(enVuelo)
    pintar(<DiscountWizard open onOpenChange={vi.fn()} venueId="v1" editDiscount={editar as never} />)
    for (let paso = 1; paso < 4; paso++) {
      fireEvent.click(screen.getByRole('button', { name: 'next' }))
      if (paso < 3) await waitFor(() => expect(screen.getByText(`discounts.wizard.step${paso + 1}.title`)).toBeTruthy())
    }
    await dobleClic(await screen.findByRole('button', { name: boton }))
    await unaSolaVez(svc[metodo])
  })
})
