import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  const product = producto(stock)
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <AdjustInventoryStockDialog open={open} onOpenChange={() => {}} product={product} />
    </QueryClientProvider>
  )
  const utils = render(ui(true))
  // El Dialog de Radix se monta en un portal (document.body), fuera de `container`.
  const guardar = () => utils.baseElement.querySelector('button[type="submit"]') as HTMLButtonElement
  // Como en ProductStock.tsx: el diálogo NO se desmonta al cerrarse; sólo cambia `open`.
  const reabrir = () => {
    utils.rerender(ui(false))
    utils.rerender(ui(true))
  }
  return { guardar, reabrir, formulario: () => guardar().closest('form') as HTMLFormElement }
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

  // Ronda 1, hallazgo 1: una merma de 0 no es merma. `-Math.abs(0)` viaja como 0, el servidor no la
  // manda al libro de merma (exige cantidad NEGATIVA) sino al ajuste viejo: escribe un LOSS de 0 sin
  // folio (cada reintento suma otra fila) y la pantalla diría «Merma registrada» sin haber registrado nada.
  it('LOSS con cantidad 0 no se puede guardar, y dice por qué', async () => {
    const user = userEvent.setup()
    const { guardar } = renderDialog(10)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'DROPPED')
    cantidad('0')
    expect(guardar()).toBeDisabled()
    expect(screen.getByText(es.waste.quantityMinimum)).toBeInTheDocument()
  })

  it('LOSS con cantidad 0 no manda nada aunque el formulario se envíe', async () => {
    adjustStock.mockResolvedValue({ data: { message: 'ok', data: { currentStock: 10, minimumStock: 0, reservedStock: 0 } } })
    const user = userEvent.setup()
    const { formulario } = renderDialog(10)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'DROPPED')
    cantidad('0')
    // Enviar el formulario directo (no por el botón, que ya está deshabilitado): así se prueba el candado
    // de `onSubmit`, que es lo que queda si alguien vuelve a habilitar el botón.
    await act(async () => {
      fireEvent.submit(formulario())
      await new Promise(r => setTimeout(r, 50))
    })
    expect(adjustStock).not.toHaveBeenCalled()
  })

  it('un AJUSTE con cantidad 0 se sigue pudiendo guardar, como hoy', () => {
    const { guardar } = renderDialog(10)
    cantidad('0')
    expect(guardar()).toBeEnabled()
    expect(screen.queryByText(es.waste.quantityMinimum)).not.toBeInTheDocument()
  })

  // Ronda 1, hallazgo 2: al reabrir, el formulario vuelve a «Ajuste». Si el aviso sólo se viera con
  // «Merma» elegida, la persona podría capturar un ajuste −4 sin enterarse de que la merma pudo entrar.
  it('fallo ambiguo en una merma → cerrar → reabrir: el aviso sigue a la vista aunque el tipo vuelva a Ajuste', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' })
    const user = userEvent.setup()
    const { guardar, reabrir } = renderDialog(10)
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'DROPPED')
    cantidad('1')
    await user.click(guardar())
    expect(await screen.findByText(es.waste.ambiguousHint)).toBeInTheDocument()
    reabrir()
    expect((screen.getByRole('combobox', { name: 'adjustmentType' }) as HTMLSelectElement).value).toBe('ADJUSTMENT')
    expect(screen.getByText(es.waste.ambiguousHint)).toBeInTheDocument()
  })

  // El único caso donde el candado de «bajo cero» se ejercita en una merma: la existencia YA es
  // negativa. Con D4 la merma se registra igual (el servidor no toca una existencia negativa y todo
  // queda «sin existencia»); un AJUSTE que la hunde más sigue bloqueado. Sin esta prueba, quitar el
  // `!isLoss` de `isNegativeStock` no tumbaba nada: con existencia >= 0 la vista previa nunca es negativa.
  it('D4: con la existencia en NEGATIVO la merma se puede guardar; un ajuste no', async () => {
    adjustStock.mockResolvedValue({ data: { message: 'ok', data: { currentStock: -2, minimumStock: 0, reservedStock: 0 } } })
    const user = userEvent.setup()
    const { guardar } = renderDialog(-2)
    cantidad('-1')
    expect(guardar()).toBeDisabled()
    cantidad('3')
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'LOSS')
    await user.selectOptions(screen.getByRole('combobox', { name: 'productWasteReason' }), 'EXPIRED')
    expect(guardar()).toBeEnabled()
    await user.click(guardar())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    expect(adjustStock.mock.calls[0][2]).toMatchObject({ type: 'LOSS', quantity: -3, reasonCode: 'EXPIRED' })
  })
})
