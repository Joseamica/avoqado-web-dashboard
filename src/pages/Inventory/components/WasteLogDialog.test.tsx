import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import type { RawMaterial } from '@/services/inventory.service'
import { WasteLogDialog } from './WasteLogDialog'

/**
 * «Registrar merma» de un ingrediente. Lo que fija:
 *  - D4: una merma MAYOR que la existencia se registra (avisa, no bloquea).
 *  - Viajan código de motivo y folio; la nota va en `reason` y la etiqueta en inglés ya no.
 *  - Reintentar LO MISMO reusa el folio (el servidor no descuenta dos veces); cambiarlo estrena folio.
 *  - Un doble clic manda UNA sola petición.
 */
const t = (key: string | string[], opts?: Record<string, unknown>) => {
  if (typeof key !== 'string') return String(key)
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (...a: unknown[]) => toast(...a) }) }))
vi.mock('@/hooks/use-unit-translation', () => ({
  useUnitTranslation: () => ({ formatUnitWithQuantity: (_q: number, unit: string) => unit.toLowerCase() }),
}))
const adjustStock = vi.fn()
vi.mock('@/services/inventory.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/inventory.service')>()
  return { ...mod, rawMaterialsApi: { ...mod.rawMaterialsApi, adjustStock: (...a: unknown[]) => adjustStock(...a) } }
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const aguacate = { id: 'rm1', name: 'Aguacate', sku: 'AGU-1', currentStock: 2, unit: 'KILOGRAM' } as unknown as RawMaterial
const ok = (waste?: object) => ({ data: { success: true, message: 'Stock adjusted successfully', data: {}, ...(waste ? { waste } : {}) } })

const leche = { id: 'rm2', name: 'Leche', sku: 'LEC-1', currentStock: 10, unit: 'LITER' } as unknown as RawMaterial

function renderDialog() {
  const onOpenChange = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ui = (open: boolean, rawMaterial: RawMaterial) => (
    <QueryClientProvider client={qc}>
      <WasteLogDialog open={open} onOpenChange={onOpenChange} rawMaterial={rawMaterial} />
    </QueryClientProvider>
  )
  const { rerender } = render(ui(true, aguacate))
  // Como en RawMaterials.tsx: el diálogo NO se desmonta al cerrarse; sólo cambia `open`.
  const reabrir = (rawMaterial: RawMaterial = aguacate) => {
    rerender(ui(false, rawMaterial))
    rerender(ui(true, rawMaterial))
  }
  return { onOpenChange, reabrir }
}

const folio = (i: number) => adjustStock.mock.calls[i][2].idempotencyKey

// La cantidad entra con `fireEvent.change`: teclear «1.5» letra por letra en un <input type="number">
// pasa por «1.», que jsdom sanea a vacío. Motivo y nota sí van con userEvent.
async function capturar(user: ReturnType<typeof userEvent.setup>, o: { motivo?: string; cantidad: string; nota?: string }) {
  if (o.motivo) await user.selectOptions(screen.getByRole('combobox', { name: 'wasteReason' }), o.motivo)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: o.cantidad } })
  if (o.nota) await user.type(screen.getByRole('textbox'), o.nota)
}

const boton = () => screen.getByRole('button', { name: /Registrar merma/ })

describe('WasteLogDialog', () => {
  it('D4: más merma que existencia NO bloquea — avisa «sin existencia» y deja registrar', async () => {
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '5' })
    expect(boton()).toBeEnabled()
    expect(screen.getByText(/quedarán registrados como «sin existencia»/)).toBeInTheDocument()
  })

  it('sin motivo no se puede registrar', async () => {
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { cantidad: '1' })
    expect(boton()).toBeDisabled()
  })

  it('manda código, folio y la nota en reason; nunca la etiqueta ni reference', async () => {
    adjustStock.mockResolvedValue(ok({ reportId: 'r1', declared: '1.5', deducted: '1.5', unrecorded: '0' }))
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '1.5', nota: 'caja golpeada' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    const [venueId, rawMaterialId, body] = adjustStock.mock.calls[0]
    expect(venueId).toBe('v1')
    expect(rawMaterialId).toBe('rm1')
    expect(body).toEqual({
      type: 'SPOILAGE',
      quantity: -1.5,
      reasonCode: 'EXPIRED',
      idempotencyKey: expect.stringMatching(UUID),
      reason: 'caja golpeada',
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('reintentar LO MISMO tras un error de red reusa el folio', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValueOnce(ok())
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    expect(await screen.findByText(es.waste.ambiguousHint)).toBeInTheDocument()
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(adjustStock.mock.calls[1][2].idempotencyKey).toBe(adjustStock.mock.calls[0][2].idempotencyKey)
  })

  it('cambiar la cantidad después del error estrena folio', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValueOnce(ok())
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await screen.findByText(es.waste.ambiguousHint)
    await capturar(user, { cantidad: '2' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(adjustStock.mock.calls[1][2].idempotencyKey).not.toBe(adjustStock.mock.calls[0][2].idempotencyKey)
    expect(adjustStock.mock.calls[1][2].quantity).toBe(-2)
  })

  it('un doble clic manda UNA sola petición', async () => {
    adjustStock.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '1' })
    // Dos clics en el MISMO tick, sin repintado entre ellos: el doble clic más rápido posible. Con
    // `user.dblClick` React alcanza a pintar el botón deshabilitado (`isPending`) entre clic y clic, y
    // eso escondía si el candado de `submit` existe de verdad.
    const b = boton()
    fireEvent.click(b)
    fireEvent.click(b)
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    // Y sigue en una: el segundo envío no llega tarde.
    await new Promise(r => setTimeout(r, 50))
    expect(adjustStock).toHaveBeenCalledTimes(1)
  })

  it('el aviso de éxito dice cuánto quedó «sin existencia»', async () => {
    adjustStock.mockResolvedValue(ok({ reportId: 'r1', declared: '5', deducted: '2', unrecorded: '3' }))
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '5' })
    await user.click(boton())
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Merma registrada', description: expect.stringContaining('3 kilogram') })),
    )
  })

  // Hallazgo 1 de la revisión: un éxito CONFIRMADO gasta el folio en el hook, no en la disciplina de
  // cada diálogo. Si no, otra merma real idéntica (otro kilo de aguacate al día siguiente) reusaría el
  // folio y el servidor la tomaría por reintento: no descontaría nada, en silencio.
  it('tras un éxito el folio se gasta: otra merma idéntica estrena folio aunque nadie llame restart', async () => {
    adjustStock.mockResolvedValue(ok())
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Merma registrada' })))
    // La prueba NO cierra el diálogo (no hay `restart`): es el consumidor que se olvida de llamarlo.
    await waitFor(() => expect(boton()).toBeEnabled())
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(adjustStock.mock.calls[1][2]).toMatchObject({ quantity: -1, reasonCode: 'EXPIRED' })
    expect(folio(1)).not.toBe(folio(0))
  })

  it('éxito → cerrar → reabrir → capturar lo mismo estrena folio', async () => {
    adjustStock.mockResolvedValue(ok())
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Merma registrada' })))
    reabrir()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(folio(1)).not.toBe(folio(0))
  })

  // Hallazgo 2: el aviso ambiguo promete que reintentar lo mismo no registra dos veces. Cerrar y
  // reabrir no puede romper esa promesa.
  it('fallo ambiguo → cerrar → reabrir → capturar lo mismo reusa el folio del intento fallido', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValueOnce(ok())
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await screen.findByText(es.waste.ambiguousHint)
    reabrir()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(folio(1)).toBe(folio(0))
  })

  it('fallo ambiguo → cerrar → reabrir: el aviso sigue a la vista', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' })
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await screen.findByText(es.waste.ambiguousHint)
    reabrir()
    expect(screen.getByText(es.waste.ambiguousHint)).toBeInTheDocument()
  })

  it('fallo ambiguo con un artículo → abrir OTRO artículo: sin aviso y con folio propio', async () => {
    adjustStock.mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValueOnce(ok())
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await screen.findByText(es.waste.ambiguousHint)
    reabrir(leche)
    expect(screen.queryByText(es.waste.ambiguousHint)).not.toBeInTheDocument()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(adjustStock.mock.calls[1][1]).toBe('rm2')
    expect(folio(1)).not.toBe(folio(0))
  })

  it('un 409 WASTE_VOIDED se explica con su texto, no con el genérico', async () => {
    adjustStock.mockRejectedValue({ response: { status: 409, data: { code: 'WASTE_VOIDED', message: 'x' } } })
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: es.waste.errors.voided, variant: 'destructive' })),
    )
  })
})
