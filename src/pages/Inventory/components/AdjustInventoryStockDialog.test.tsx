import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import esCommon from '@/locales/es/common.json'
import type { Product } from '@/types'
import { AdjustInventoryStockDialog } from './AdjustInventoryStockDialog'

/**
 * «Ajustar existencias» de un PRODUCTO. Lo que fija:
 *  - Ofrece los tipos que el servidor acepta para productos (antes ofrecía los de insumo, que
 *    daban 400) e incluye LOSS, la merma de productos.
 *  - D4: una merma (LOSS) mayor que la existencia NO se bloquea; viaja negativa, con código y folio.
 *  - Un AJUSTE que deja la existencia bajo cero SIGUE bloqueado, y su cuerpo no cambia.
 */
// Cada namespace con SU archivo: el diálogo usa `inventory` y `common`, y una clave que no existe en
// el suyo sale cruda (así se ve en pantalla).
const makeT = (bundle: object) => (key: string | string[], opts?: Record<string, unknown>) => {
  if (typeof key !== 'string') return String(key)
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], bundle)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
const t = makeT(es)
const tCommon = makeT(esCommon)
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({ t: ns === 'common' ? tCommon : t, i18n: { language: 'es' } }),
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/use-unit-translation', () => ({
  useUnitTranslation: () => ({ formatUnitWithQuantity: (_q: number, unit: string) => unit.toLowerCase() }),
}))
vi.mock('@/hooks/useRecentMovements', () => ({
  useRecentMovements: () => ({ movements: [], isLoading: false, hasRecentMovements: false }),
}))
vi.mock('@/components/inventory/RecentMovementsSection', () => ({ RecentMovementsSection: () => null }))
const adjustStock = vi.fn()
vi.mock('@/services/inventory.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/inventory.service')>()
  return { ...mod, productInventoryApi: { ...mod.productInventoryApi, adjustStock: (...a: unknown[]) => adjustStock(...a) } }
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const producto = (currentStock: number) =>
  ({ id: 'p1', name: 'Coca 600', sku: 'COC-600', unit: 'UNIT', inventory: { currentStock } }) as unknown as Product

function renderDialog(stock: number) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={qc}>
      <AdjustInventoryStockDialog open onOpenChange={() => {}} product={producto(stock)} />
    </QueryClientProvider>,
  )
  // El Dialog de Radix se monta en un portal (document.body), fuera de `container`.
  return { guardar: () => utils.baseElement.querySelector('button[type="submit"]') as HTMLButtonElement }
}
const cantidad = (value: string) => fireEvent.change(screen.getByRole('spinbutton'), { target: { value } })

describe('AdjustInventoryStockDialog', () => {
  it('ofrece los tipos de PRODUCTO: incluye LOSS y ya no USAGE / SPOILAGE / RETURN', () => {
    renderDialog(10)
    const valores = within(screen.getByRole('combobox', { name: 'adjustmentType' }))
      .getAllByRole('option')
      .map(o => (o as HTMLOptionElement).value)
      .filter(Boolean)
    expect(valores).toEqual(['ADJUSTMENT', 'PURCHASE', 'LOSS', 'TRANSFER', 'COUNT'])
  })

  it('D4: LOSS mayor que la existencia NO bloquea y viaja negativo, con código y folio', async () => {
    adjustStock.mockResolvedValue({ data: { message: 'ok', data: { currentStock: 0, minimumStock: 0, reservedStock: 0 } } })
    const user = userEvent.setup()
    const { guardar } = renderDialog(1)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'DROPPED')
    cantidad('4')
    expect(guardar()).toBeEnabled()
    await user.click(guardar()) // 1ª: confirma el ajuste grande (4 > 50 % de 1)
    await user.click(guardar()) // 2ª: envía
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    const [venueId, productId, body] = adjustStock.mock.calls[0]
    expect(venueId).toBe('v1')
    expect(productId).toBe('p1')
    expect(body).toEqual({ type: 'LOSS', quantity: -4, reasonCode: 'DROPPED', idempotencyKey: expect.stringMatching(UUID) })
  })

  it('LOSS sin motivo no se puede guardar', async () => {
    const user = userEvent.setup()
    const { guardar } = renderDialog(10)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    cantidad('1')
    expect(guardar()).toBeDisabled()
  })

  it('un AJUSTE que deja la existencia bajo cero sigue bloqueado', () => {
    const { guardar } = renderDialog(1)
    cantidad('-5')
    expect(guardar()).toBeDisabled()
  })

  it('un AJUSTE viaja exactamente como hoy: sin código ni folio', async () => {
    adjustStock.mockResolvedValue({ data: { message: 'ok', data: { currentStock: 12, minimumStock: 0, reservedStock: 0 } } })
    const user = userEvent.setup()
    const { guardar } = renderDialog(10)
    cantidad('2')
    await user.click(guardar())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    expect(adjustStock.mock.calls[0][2]).toEqual({ type: 'ADJUSTMENT', quantity: 2, reason: '', reference: '' })
  })

  // La vista previa dice lo que hará el SERVIDOR (D4): descuenta lo que hay, el resto «sin existencia».
  // Una resta ingenua (1 − 4 = −3, o 1 + 4 = 5) le mentiría a la persona antes de guardar.
  it('D4: la vista previa de una merma mayor que la existencia deja 0 y avisa «sin existencia»', async () => {
    const user = userEvent.setup()
    renderDialog(1)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    cantidad('4')
    expect(screen.getByText('0.00 unit')).toBeInTheDocument()
    expect(screen.getByText(/quedarán registrados como «sin existencia»/)).toBeInTheDocument()
  })

  // El paso de confirmación del ajuste grande es justo el que recorre toda merma D4 (más de la
  // mitad de la existencia): sus botones no pueden mostrar una clave cruda.
  it('los botones dicen su texto, no la clave — también el de confirmar un ajuste grande', async () => {
    const user = userEvent.setup()
    const { guardar } = renderDialog(1)
    expect(screen.getByRole('button', { name: esCommon.cancel })).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'DROPPED')
    cantidad('4')
    await user.click(guardar())
    expect(guardar()).toHaveTextContent(esCommon.confirmAndSave)
  })

  it('un doble clic en una merma manda UNA sola petición', async () => {
    adjustStock.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    const { guardar } = renderDialog(10)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'EXPIRED')
    cantidad('1')
    // Dos clics en el MISMO tick: con `user.dblClick` React alcanza a deshabilitar el botón entre uno
    // y otro, y la prueba pasaría aunque el candado del envío no existiera.
    const b = guardar()
    fireEvent.click(b)
    fireEvent.click(b)
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    await new Promise(r => setTimeout(r, 50))
    expect(adjustStock).toHaveBeenCalledTimes(1)
  })
})
