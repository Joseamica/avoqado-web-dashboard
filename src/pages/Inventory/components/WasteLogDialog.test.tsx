import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  return { onOpenChange, reabrir, qc }
}

const folio = (i: number) => adjustStock.mock.calls[i][2].idempotencyKey

/** Una respuesta que la prueba resuelve o rechaza cuando quiere: la red «colgada» de axios sin timeout. */
function respuestaColgada() {
  let resolver: (value: unknown) => void = () => {}
  let rechazar: (reason: unknown) => void = () => {}
  const promesa = new Promise((res, rej) => {
    resolver = res
    rechazar = rej
  })
  return {
    promesa,
    resolver: (value: unknown) => act(async () => resolver(value)),
    rechazar: (reason: unknown) => act(async () => rechazar(reason)),
  }
}

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

  // Hallazgo 3: cerrar el diálogo (Escape o la X) con la petición EN VUELO y reabrirlo no puede
  // estrenar folio. Mientras no hay desenlace, el folio del envío es el único que puede viajar con lo mismo.
  it('reabrir con la petición en vuelo → falla por red → capturar lo mismo reusa el folio ENVIADO', async () => {
    const red = respuestaColgada()
    adjustStock.mockImplementationOnce(() => red.promesa).mockResolvedValueOnce(ok())
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    reabrir()
    await red.rechazar({ message: 'Network Error' })
    expect(await screen.findByText(es.waste.ambiguousHint)).toBeInTheDocument()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await waitFor(() => expect(boton()).toBeEnabled())
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(folio(1)).toBe(folio(0))
  })

  it('en vuelo → abrir OTRO artículo → falla por red → volver al primero: el folio enviado se conserva', async () => {
    const red = respuestaColgada()
    adjustStock.mockImplementationOnce(() => red.promesa).mockResolvedValueOnce(ok())
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    reabrir(leche)
    await red.rechazar({ message: 'Network Error' })
    // El aviso es del aguacate: en la leche no aparece.
    expect(screen.queryByText(es.waste.ambiguousHint)).not.toBeInTheDocument()
    reabrir(aguacate)
    expect(screen.getByText(es.waste.ambiguousHint)).toBeInTheDocument()
    await capturar(user, { motivo: 'DROPPED', cantidad: '1' })
    await waitFor(() => expect(boton()).toBeEnabled())
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(adjustStock.mock.calls[1][1]).toBe('rm1')
    expect(folio(1)).toBe(folio(0))
  })

  // Hallazgo 4: el éxito refresca y describe el artículo ENVIADO, no el que está abierto al llegar la respuesta.
  it('un éxito que llega con OTRO artículo abierto refresca y describe el artículo enviado', async () => {
    const red = respuestaColgada()
    adjustStock.mockImplementationOnce(() => red.promesa)
    const user = userEvent.setup()
    const { reabrir, qc } = renderDialog()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    await capturar(user, { motivo: 'EXPIRED', cantidad: '5' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    reabrir(leche)
    await red.resolver(ok({ reportId: 'r1', declared: '5', deducted: '2', unrecorded: '3' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Merma registrada', description: expect.stringContaining('3 kilogram') })),
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stockMovements', 'v1', 'rm1'] })
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['stockMovements', 'v1', 'rm2'] })
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

  // La CUARTA puerta de merma con captura de cantidad. Aquí el 0 lo frena la validación `min` de
  // react-hook-form (las otras tres lo frenan en el botón y en `onSubmit`), y hasta ahora ninguna
  // prueba lo cuidaba: quitar ese `min` devolvía el defecto sin que nada cayera. Una merma de 0 no
  // es merma — `-Math.abs(0)` viaja como 0, el servidor la manda al ajuste VIEJO (movimiento de 0
  // sin folio, otra fila por cada reintento) y la pantalla diría «Merma registrada».
  it('una merma de cantidad 0 no se manda, y dice por qué', async () => {
    const user = userEvent.setup()
    renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '0' })
    await user.click(boton())
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    expect(adjustStock).not.toHaveBeenCalled()
    expect(screen.getByText(es.waste.quantityMinimum)).toBeInTheDocument()
  })

  // Auditoría de Codex, P1-1: un fallo CLARO posterior no prueba que la petición ANTERIOR no se haya
  // aplicado. Si se borra la duda, `restart` estrena folio al reabrir y la siguiente captura idéntica
  // descuenta por segunda vez. Sólo un ÉXITO confirmado resuelve la duda.
  it('un rechazo claro DESPUÉS de una duda no borra la duda: el folio sigue siendo el mismo', async () => {
    adjustStock
      .mockRejectedValueOnce({ message: 'Network Error' })
      .mockRejectedValueOnce({ response: { status: 403, data: { message: 'sin permiso' } } })
      .mockResolvedValueOnce(ok({ reportId: 'r1', declared: '3', deducted: '3', unrecorded: '0' }))
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '3' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(es.waste.ambiguousHint)).toBeInTheDocument()

    // Reintento idéntico: ahora falla con un 403 (permiso o plan que cambió).
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    expect(screen.getByText(es.waste.ambiguousHint)).toBeInTheDocument()

    // Cerrar, reabrir y volver a capturar LO MISMO tiene que ser el reintento que el aviso promete.
    reabrir()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '3' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(3))
    expect(folio(2)).toBe(folio(0))
  })

  // Auditoría de Codex, P1-2: si TanStack pausa el envío (sin conexión) y entre tanto el diálogo
  // cambia de artículo, al reanudar `mutationFn` no puede usar el `send` del artículo NUEVO: el
  // POST saldría para el artículo equivocado con el payload del original.
  it('un envío que se reanuda tras cambiar de artículo sigue yendo al artículo ENVIADO', async () => {
    adjustStock.mockResolvedValue(ok({ reportId: 'r1', declared: '2', deducted: '2', unrecorded: '0' }))
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    // Sin conexión: TanStack PAUSA la mutación y no llama a `mutationFn` hasta que vuelva la red.
    onlineManager.setOnline(false)
    try {
      await capturar(user, { motivo: 'EXPIRED', cantidad: '2' })
      await user.click(boton())
      expect(adjustStock).not.toHaveBeenCalled()
      // Mientras está pausada, el diálogo se reabre con OTRO artículo (leche, rm2).
      reabrir(leche)
      await act(async () => {
        onlineManager.setOnline(true)
        await new Promise(r => setTimeout(r, 80))
      })
      await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(1))
      // El POST tiene que salir con el artículo que se capturó (aguacate, rm1), no con el abierto.
      expect(adjustStock.mock.calls[0][1]).toBe('rm1')
    } finally {
      onlineManager.setOnline(true)
    }
  })

  // Ronda 2 de Codex, P2: `WASTE_VOIDED` es un estado TERMINAL — el servidor dice que ese folio
  // quedó anulado, así que PRUEBA que la merma no se aplicó. Es el único rechazo que resuelve la
  // duda: si se conservara el folio, el texto diría «cierra y regístralo de nuevo» y al reabrir
  // volvería el mismo 409 para siempre.
  it('un 409 WASTE_VOIDED sí cierra la duda: al reabrir se puede registrar con un folio nuevo', async () => {
    adjustStock
      .mockRejectedValueOnce({ message: 'Network Error' })
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'WASTE_VOIDED', message: 'anulado' } } })
      .mockResolvedValueOnce(ok({ reportId: 'r9', declared: '3', deducted: '3', unrecorded: '0' }))
    const user = userEvent.setup()
    const { reabrir } = renderDialog()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '3' })
    await user.click(boton())
    expect(await screen.findByText(es.waste.ambiguousHint)).toBeInTheDocument()

    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(es.waste.ambiguousHint)).toBeNull())

    reabrir()
    await capturar(user, { motivo: 'EXPIRED', cantidad: '3' })
    await user.click(boton())
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(3))
    expect(folio(2)).not.toBe(folio(0))
  })
})
