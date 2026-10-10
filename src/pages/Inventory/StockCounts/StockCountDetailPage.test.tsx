import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import en from '@/locales/en/inventory.json'
import StockCountDetailPage from './StockCountDetailPage'
import type { StockCountDetail } from '@/services/stockCount.service'

/**
 * La captura de Mindform del 2026-09-07: 137 líneas, 0 contadas, y la pantalla
 * decía «Con diferencia 111 · Diferencia total −6956845.614000001». Lo que
 * cazan estas pruebas: que un borrador vacío se lea como vacío, que las
 * diferencias salgan por unidad, y que cancelar se VEA sin recargar.
 */
const busca = (key: string) => key.split('.').reduce<any>((o, k) => o?.[k], es)
const t = (key: string, opts?: Record<string, unknown>) => {
  // Plurales de i18next (`_one` / `_other`): basta para es, que sólo distingue 1 de lo demás.
  const plural = typeof opts?.count === 'number' ? busca(`${key}_${opts.count === 1 ? 'one' : 'other'}`) : undefined
  const raw = typeof plural === 'string' ? plural : busca(key)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venue: { id: 'v1', slug: 'mindform', timezone: 'America/Mexico_City' },
    venueId: 'v1',
    fullBasePath: '/venues/mindform',
  }),
}))
const can = vi.fn(() => true)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
const get = vi.fn()
const cancel = vi.fn()
vi.mock('@/services/stockCount.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/stockCount.service')>()
  return {
    ...mod,
    stockCountService: { ...mod.stockCountService, get: (...a: unknown[]) => get(...a), cancel: (...a: unknown[]) => cancel(...a) },
  }
})

const borrador = (o: Partial<StockCountDetail> = {}): StockCountDetail => ({
  id: 'c1',
  type: 'FULL',
  status: 'IN_PROGRESS',
  note: null,
  createdAt: '2026-09-07T22:51:23.142Z',
  completedAt: null,
  cancelledAt: null,
  createdBy: 'Fatima Flores',
  itemCount: 3,
  summary: { itemCount: 3, countedCount: 0, matchedCount: 0, mismatchedCount: 0, differenceByUnit: [] },
  totalDifference: 0,
  items: [
    {
      id: 'i1',
      productId: 'p1',
      productName: 'Gorra Beige',
      sku: '10025',
      gtin: null,
      imageUrl: null,
      unit: null,
      expected: 4,
      counted: 0,
      difference: -4,
      countedAt: null,
    },
    {
      id: 'i2',
      productId: 'rm1',
      productName: 'yogurt coco oikos',
      sku: null,
      gtin: null,
      imageUrl: null,
      unit: 'GRAM',
      expected: 6729329,
      counted: 0,
      difference: -6729329,
      countedAt: null,
    },
    {
      id: 'i3',
      productId: 'p3',
      productName: 'Agua',
      sku: null,
      gtin: null,
      imageUrl: null,
      unit: null,
      expected: 0,
      counted: 0,
      difference: 0,
      countedAt: null,
    },
  ],
  ...o,
})

/**
 * El valor de una casilla del resumen es el hermano de su etiqueta («Coinciden» arriba,
 * el número debajo). Se consulta así y no con `getByText('1')` porque un «1» suelto lo
 * satisface cualquier otro renglón de la pantalla: la prueba pasaría sin mirar el resumen.
 */
const valorDeResumen = (etiqueta: string) => screen.getByText(etiqueta).nextElementSibling?.textContent?.trim()

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/venues/mindform/inventory/stock-counts/c1']}>
        <Routes>
          <Route path="/venues/:slug/inventory/stock-counts/:countId" element={<StockCountDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  can.mockReturnValue(true)
})

describe('StockCountDetailPage — un borrador vacío se lee como vacío', () => {
  it('«0 de 3 contados», sin diferencias inventadas, y las líneas dicen «Sin contar»', async () => {
    get.mockResolvedValue({ success: true, data: borrador() })
    renderPage()
    expect(await screen.findByText('0 de 3 contados')).toBeInTheDocument()
    expect(screen.getByText(es.stockCounts.nothingCountedYet)).toBeInTheDocument()
    expect(screen.queryByText(/6,968,054|6968054|−4|-4/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Sin contar').length).toBeGreaterThanOrEqual(3)
    // 🔴 Sin nada contado, «Coinciden» y «Con diferencia» son «—», no 0: un 0 afirmaría
    // que se revisaron las 3 líneas y ninguna cuadró, que es una conclusión que nadie sacó.
    expect(valorDeResumen(es.stockCounts.matched)).toBe('—')
    expect(valorDeResumen(es.stockCounts.mismatched)).toBe('—')
    // La cantidad esperada lleva su unidad: «6,729,329 g» se lee como lo que es.
    expect(screen.getByText('6,729,329 g')).toBeInTheDocument()
  })

  it('con líneas contadas enseña coinciden/con diferencia sobre lo contado y la diferencia por unidad', async () => {
    get.mockResolvedValue({
      success: true,
      data: borrador({
        summary: {
          itemCount: 3,
          countedCount: 2,
          matchedCount: 1,
          mismatchedCount: 1,
          differenceByUnit: [
            { unit: 'GRAM', difference: -329 },
            { unit: 'PIECE', difference: 0 },
          ],
        },
        items: [
          {
            id: 'i1',
            productId: 'p1',
            productName: 'Gorra Beige',
            sku: '10025',
            gtin: null,
            imageUrl: null,
            unit: null,
            expected: 4,
            counted: 4,
            difference: 0,
            countedAt: '2026-09-07T23:00:00.000Z',
          },
          {
            id: 'i2',
            productId: 'rm1',
            productName: 'yogurt coco oikos',
            sku: null,
            gtin: null,
            imageUrl: null,
            unit: 'GRAM',
            expected: 6729329,
            counted: 6729000,
            difference: -329,
            countedAt: '2026-09-07T23:01:00.000Z',
          },
          {
            id: 'i3',
            productId: 'p3',
            productName: 'Agua',
            sku: null,
            gtin: null,
            imageUrl: null,
            unit: null,
            expected: 0,
            counted: 0,
            difference: 0,
            countedAt: null,
          },
        ],
      }),
    })
    renderPage()
    expect(await screen.findByText('2 de 3 contados')).toBeInTheDocument()
    // «−329 g» sale DOS veces y las dos son correctas: el resumen por unidad y la línea
    // del yogurt. `getByText` (singular) revienta con «found multiple elements», así que
    // se afirma lo que de verdad importa: que la diferencia por unidad esté en AMBOS.
    expect(screen.getAllByText(/[−-]329 g/).length).toBeGreaterThanOrEqual(2)
    // Con 2 de 3 contadas, el resumen habla de LO CONTADO: 1 coincide y 1 difiere. La
    // tercera línea no entra en ninguna de las dos cuentas.
    expect(valorDeResumen(es.stockCounts.matched)).toBe('1')
    expect(valorDeResumen(es.stockCounts.mismatched)).toBe('1')
    expect(screen.getAllByText('Sin contar')).toHaveLength(2) // Contado y Diferencia de la línea sin contar
  })
})

describe('Cancelar conteo', () => {
  it('el botón sólo aparece sobre un borrador y con permiso', async () => {
    get.mockResolvedValue({ success: true, data: borrador({ status: 'COMPLETED' }) })
    const { unmount } = renderPage()
    await screen.findByText('Completado')
    expect(screen.queryByRole('button', { name: es.stockCounts.cancel.button })).not.toBeInTheDocument()
    unmount()

    can.mockReturnValue(false)
    get.mockResolvedValue({ success: true, data: borrador() })
    renderPage()
    await screen.findByText('0 de 3 contados')
    expect(screen.queryByRole('button', { name: es.stockCounts.cancel.button })).not.toBeInTheDocument()
  })

  it('🔴 escribir y VER: tras confirmar, el estado cambia a Cancelado sin recargar', async () => {
    get
      .mockResolvedValueOnce({ success: true, data: borrador() })
      .mockResolvedValue({ success: true, data: borrador({ status: 'CANCELLED', cancelledAt: '2026-09-08T01:00:00.000Z' }) })
    cancel.mockResolvedValue({ success: true, data: { id: 'c1', status: 'CANCELLED', cancelledAt: '2026-09-08T01:00:00.000Z' } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.stockCounts.cancel.button }))
    await userEvent.click(await screen.findByRole('button', { name: es.stockCounts.cancel.confirm }))
    expect(cancel).toHaveBeenCalledWith('v1', 'c1')
    await waitFor(() => expect(screen.getByText('Cancelado')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: es.stockCounts.cancel.button })).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: es.stockCounts.cancel.success }))
  })

  // 🔴 El servidor construye TRES motivos distintos para el 409 («ya estaba cancelado»,
  // «se está aplicando al inventario; espera a que termine», «un conteo completado no se
  // puede cancelar: ya ajustó el inventario») y la pantalla los tiraba a la basura para
  // decir siempre «No se pudo cancelar el conteo». Es alcanzable: un cajero confirma
  // desde el POS mientras el gerente tiene el detalle abierto. Y sin invalidar, la
  // pantalla se quedaba «En progreso» con su botón — el gerente reintenta en bucle.
  it('🔴 un 409 enseña el motivo del SERVIDOR y relee el estado real', async () => {
    get
      .mockResolvedValueOnce({ success: true, data: borrador() })
      .mockResolvedValue({ success: true, data: borrador({ status: 'COMPLETED', completedAt: '2026-09-08T01:00:00.000Z' }) })
    cancel.mockRejectedValue({
      response: { status: 409, data: { message: 'Un conteo completado no se puede cancelar: ya ajustó el inventario' } },
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: es.stockCounts.cancel.button }))
    await userEvent.click(await screen.findByRole('button', { name: es.stockCounts.cancel.confirm }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: es.stockCounts.cancel.error,
          description: expect.stringContaining('ya ajustó el inventario'),
          variant: 'destructive',
        }),
      ),
    )
    // La invalidación es lo que corta el bucle: el detalle se relee y la pantalla deja
    // de ofrecer un botón que el servidor ya rechazó.
    await waitFor(() => expect(screen.getByText('Completado')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: es.stockCounts.cancel.button })).not.toBeInTheDocument()
  })
})

// L5: una línea que el conteo NO aplicó por Shopify se veía contada y aplicada (integridad K18).
describe('StockCountDetailPage — líneas que no se aplicaron por Shopify', () => {
  const contada = (o: Partial<StockCountDetail['items'][number]>): StockCountDetail['items'][number] => ({
    id: 'i1',
    productId: 'p1',
    productName: 'Gorra Beige',
    sku: '10025',
    gtin: null,
    imageUrl: null,
    unit: null,
    expected: 4,
    counted: 3,
    difference: -1,
    countedAt: '2026-10-08T14:00:00.000Z',
    shopifyHeld: null,
    ...o,
  })
  const completado = (items: StockCountDetail['items'], noAplicadas: number) =>
    borrador({
      status: 'COMPLETED',
      completedAt: '2026-10-08T15:00:00.000Z',
      itemCount: items.length,
      summary: {
        itemCount: items.length,
        countedCount: items.length,
        matchedCount: 0,
        mismatchedCount: items.length,
        differenceByUnit: [],
      },
      items,
      noAplicadas,
    })

  it('ENVIO_EN_CAMINO: la línea dice «No se aplicó» y que se vuelva a contar en unos minutos, sin enlace', async () => {
    get.mockResolvedValue({
      success: true,
      data: completado(
        [
          contada({ shopifyHeld: { at: '2026-10-08T15:00:00.000Z', motivo: 'ENVIO_EN_CAMINO' } }),
          contada({ id: 'i2', productName: 'Agua' }),
        ],
        1,
      ),
    })
    renderPage()
    expect(await screen.findByText('Había un envío a Shopify en camino; vuelve a contar este producto en unos minutos')).toBeInTheDocument()
    // Sólo la línea retenida lleva el aviso; la otra se aplicó.
    expect(screen.getAllByText('No se aplicó')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: es.stockCounts.held.reviewLink })).not.toBeInTheDocument()
    expect(screen.getByText('1 línea no se aplicó')).toBeInTheDocument()
  })

  it('DUDA_POR_REVISAR: el motivo lleva a «Por revisar» de Integraciones → Shopify, dentro del negocio', async () => {
    get.mockResolvedValue({
      success: true,
      data: completado(
        [
          contada({ shopifyHeld: { at: '2026-10-08T15:00:00.000Z', motivo: 'DUDA_POR_REVISAR' } }),
          contada({ id: 'i2', productName: 'Agua', shopifyHeld: { at: '2026-10-08T15:00:00.000Z', motivo: 'ENVIO_EN_CAMINO' } }),
        ],
        2,
      ),
    })
    renderPage()
    expect(await screen.findByText('Hay una diferencia con Shopify por revisar; resuélvela primero')).toBeInTheDocument()
    expect(screen.getAllByText('No se aplicó')).toHaveLength(2)
    expect(screen.getByRole('link', { name: es.stockCounts.held.reviewLink })).toHaveAttribute(
      'href',
      '/venues/mindform/settings/integrations/shopify#por-revisar',
    )
    expect(screen.getByText('2 líneas no se aplicaron')).toBeInTheDocument()
  })

  it('la «Diferencia» del resumen avisa que incluye las líneas no aplicadas (singular y plural)', async () => {
    const retenida = (id: string) => contada({ id, shopifyHeld: { at: '2026-10-08T15:00:00.000Z', motivo: 'ENVIO_EN_CAMINO' } })
    get.mockResolvedValue({ success: true, data: completado([retenida('i1'), retenida('i2'), contada({ id: 'i3' })], 2) })
    const { unmount } = renderPage()
    expect(await screen.findByText('(incluye 2 no aplicadas)')).toBeInTheDocument()
    // Vive en la casilla «Diferencia», no suelto en la pantalla.
    // (La tabla también tiene una columna «Diferencia»: la casilla del resumen es el <div>.)
    const casilla = screen.getAllByText(es.stockCounts.difference).find(e => e.tagName === 'DIV')
    expect(casilla?.parentElement).toHaveTextContent('(incluye 2 no aplicadas)')
    unmount()

    get.mockResolvedValue({ success: true, data: completado([retenida('i1'), contada({ id: 'i2' })], 1) })
    renderPage()
    expect(await screen.findByText('(incluye 1 no aplicada)')).toBeInTheDocument()
  })

  it('regresión: sin líneas retenidas (o un servidor que aún no manda el campo) no aparece nada nuevo', async () => {
    get.mockResolvedValue({ success: true, data: completado([contada({}), contada({ id: 'i2', shopifyHeld: undefined })], 0) })
    renderPage()
    expect(await screen.findByText('Completado')).toBeInTheDocument()
    expect(screen.queryByText('No se aplicó')).not.toBeInTheDocument()
    expect(screen.queryByText(/no se aplic/)).not.toBeInTheDocument()
  })

  it('los textos nuevos existen en es y en, con las mismas llaves y sin vacíos', () => {
    const hojas = (v: unknown, p = ''): string[] =>
      v && typeof v === 'object' ? Object.entries(v).flatMap(([k, c]) => hojas(c, p ? `${p}.${k}` : k)) : [p]
    expect(hojas(en.stockCounts).sort()).toEqual(hojas(es.stockCounts).sort())
    for (const fuente of [es, en]) for (const v of Object.values(fuente.stockCounts.held)) expect(String(v).trim()).not.toBe('')
    expect(es.stockCounts.held.summary_other).toBe('{{count}} líneas no se aplicaron')
  })
})
