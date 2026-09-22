import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import esCommon from '@/locales/es/common.json'
import type { RawMaterial } from '@/services/inventory.service'
import { AdjustStockDialog } from './AdjustStockDialog'

/**
 * «Ajustar existencias» de un INGREDIENTE. La opción «Desperdicio» (SPOILAGE) es merma:
 * pide motivo, viaja con código y folio, y no se bloquea por existencia (D4). Lo demás, igual.
 */
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
const adjustStock = vi.fn()
vi.mock('@/services/inventory.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/inventory.service')>()
  return { ...mod, rawMaterialsApi: { ...mod.rawMaterialsApi, adjustStock: (...a: unknown[]) => adjustStock(...a) } }
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const harina = (currentStock: number) =>
  ({ id: 'rm9', name: 'Harina', sku: 'HAR', currentStock, unit: 'KILOGRAM' }) as unknown as RawMaterial

function renderDialog(stock = 1) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const rawMaterial = harina(stock)
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <AdjustStockDialog open={open} onOpenChange={() => {}} rawMaterial={rawMaterial} />
    </QueryClientProvider>
  )
  const utils = render(ui(true))
  // El Dialog de Radix se monta en un portal (document.body), fuera de `container`.
  const guardar = () => utils.baseElement.querySelector('button[type="submit"]') as HTMLButtonElement
  // Como en RawMaterials.tsx: el diálogo NO se desmonta al cerrarse; sólo cambia `open`.
  const reabrir = () => {
    utils.rerender(ui(false))
    utils.rerender(ui(true))
  }
  return { guardar, reabrir, formulario: () => guardar().closest('form') as HTMLFormElement }
}
const cantidad = (value: string) => fireEvent.change(screen.getByRole('spinbutton'), { target: { value } })

describe('AdjustStockDialog (ingredientes)', () => {
  it('D4: «Desperdicio» mayor que la existencia NO bloquea y viaja con código, folio y cantidad negativa', async () => {
    adjustStock.mockResolvedValue({ data: { success: true, message: 'ok', data: {} } })
    const user = userEvent.setup()
    const { guardar } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'EXPIRED')
    cantidad('3')
    expect(guardar()).toBeEnabled()
    await user.click(guardar())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    expect(adjustStock.mock.calls[0][2]).toEqual({
      type: 'SPOILAGE',
      quantity: -3,
      reasonCode: 'EXPIRED',
      idempotencyKey: expect.stringMatching(UUID),
    })
  })

  it('«Desperdicio» sin motivo no se puede guardar', async () => {
    const user = userEvent.setup()
    const { guardar } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    cantidad('1')
    expect(guardar()).toBeDisabled()
  })

  it('un AJUSTE que deja la existencia bajo cero sigue bloqueado', () => {
    const { guardar } = renderDialog()
    cantidad('-5')
    expect(guardar()).toBeDisabled()
  })

  it('un uso (USAGE) viaja exactamente como hoy', async () => {
    adjustStock.mockResolvedValue({ data: { success: true, message: 'ok', data: {} } })
    const user = userEvent.setup()
    const { guardar } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'USAGE')
    cantidad('-1')
    await user.click(guardar())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    expect(adjustStock.mock.calls[0][2]).toEqual({ type: 'USAGE', quantity: -1, reason: '', reference: '' })
  })

  // Mismo defecto que cerró la ronda 1 de la Task 3 en el diálogo de productos: `-Math.abs(0)` viaja
  // como 0, el servidor lo manda al ajuste VIEJO (movimiento de 0 sin folio, cada reintento otra
  // fila) y la pantalla diría «Merma registrada» sin haber registrado nada.
  it('«Desperdicio» con cantidad 0 no se puede guardar, y dice por qué', async () => {
    const user = userEvent.setup()
    const { guardar } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'DROPPED')
    cantidad('0')
    expect(guardar()).toBeDisabled()
    expect(screen.getByText(es.waste.quantityMinimum)).toBeInTheDocument()
  })

  it('«Desperdicio» con cantidad 0 no manda nada aunque el formulario se envíe', async () => {
    const user = userEvent.setup()
    const { formulario } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'DROPPED')
    cantidad('0')
    // Enviar el formulario directo (el botón ya está deshabilitado): así se prueba el candado de
    // `onSubmit`, que es lo que queda si alguien vuelve a habilitar el botón.
    await act(async () => {
      fireEvent.submit(formulario())
      await new Promise(r => setTimeout(r, 50))
    })
    expect(adjustStock).not.toHaveBeenCalled()
  })

  it('un AJUSTE con cantidad 0 se sigue pudiendo guardar, como hoy', () => {
    const { guardar } = renderDialog()
    cantidad('0')
    expect(guardar()).toBeEnabled()
    expect(screen.queryByText(es.waste.quantityMinimum)).not.toBeInTheDocument()
  })

  // Dos clics en el MISMO tick (nunca `user.dblClick`: React deshabilita el botón entre clics y el
  // sabotaje del candado no se cazaría).
  it('dos clics seguidos mandan UNA sola merma', async () => {
    adjustStock.mockImplementation(() => new Promise(r => setTimeout(() => r({ data: { success: true, data: {} } }), 30)))
    const user = userEvent.setup()
    const { guardar } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'SPOILED')
    cantidad('1')
    await act(async () => {
      fireEvent.click(guardar())
      fireEvent.click(guardar())
      await new Promise(r => setTimeout(r, 60))
    })
    expect(adjustStock).toHaveBeenCalledTimes(1)
  })

  // Al reabrir, el formulario vuelve a «Ajuste». Si el aviso sólo se viera con «Desperdicio»
  // elegido, la persona podría capturar otra cosa sin enterarse de que la merma pudo entrar.
  it('fallo ambiguo en una merma → cerrar → reabrir: el aviso sigue a la vista aunque el tipo vuelva a Ajuste', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' })
    const user = userEvent.setup()
    const { guardar, reabrir } = renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'DROPPED')
    cantidad('1')
    await user.click(guardar())
    expect(await screen.findByText(es.waste.ambiguousHint)).toBeInTheDocument()
    reabrir()
    expect((screen.getByRole('combobox', { name: 'adjustmentType' }) as HTMLSelectElement).value).toBe('ADJUSTMENT')
    expect(screen.getByText(es.waste.ambiguousHint)).toBeInTheDocument()
  })

  it('el aviso «sin existencia» avisa de lo que no alcanza, sin bloquear (D4)', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'EXPIRED')
    cantidad('3')
    // Sólo hay 1 kg: se descuenta 1 y quedan 2 «sin existencia».
    expect(screen.getByText(/2 kilogram/i)).toBeInTheDocument()
  })

  // El único caso donde el candado de «bajo cero» se ejercita en una merma: la existencia YA es
  // negativa (hueco legacy). Con D4 la merma se registra igual — el servidor no toca la existencia y
  // todo queda «sin existencia» —, mientras que un AJUSTE sí se sigue bloqueando.
  it('D4: con la existencia en NEGATIVO la merma se puede guardar; un ajuste no', async () => {
    adjustStock.mockResolvedValue({ data: { success: true, message: 'ok', data: {} } })
    const user = userEvent.setup()
    const { guardar } = renderDialog(-2)
    // Un AJUSTE que hunde más la existencia sigue bloqueado (−2 − 1 = −3).
    cantidad('-1')
    expect(guardar()).toBeDisabled()
    cantidad('3')
    await user.selectOptions(screen.getByRole('combobox', { name: 'adjustmentType' }), 'SPOILAGE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'ingredientWasteReason' }), 'EXPIRED')
    expect(guardar()).toBeEnabled()
    await user.click(guardar())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    expect(adjustStock.mock.calls[0][2]).toMatchObject({ type: 'SPOILAGE', quantity: -3, reasonCode: 'EXPIRED' })
  })
})
