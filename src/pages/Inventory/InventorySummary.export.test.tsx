import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import es from '@/locales/es/inventory.json'
import InventorySummary from './InventorySummary'

/**
 * El botón «Exportar» de Resumen de Existencias no tenía acción: se veía activo y no hacía nada (Carlota, IQ, 2-nov:
 * «¿Puede ser que no me deje exportarlo?»). Estas pruebas tocan el botón de verdad y miran el archivo que saldría.
 */
const mocks = vi.hoisted(() => ({
  products: vi.fn(),
  materials: vi.fn(),
  exportSheets: vi.fn(),
  toast: vi.fn(),
}))
// Esta pantalla pesa: en una máquina cargada cada dibujo tarda segundos y el límite de 5 s da rojos falsos.
vi.setConfig({ testTimeout: 30_000 })

const t = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es)
  if (typeof raw !== 'string') return (opts?.defaultValue as string | undefined) ?? key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true, isLoading: false }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'iq', fullBasePath: '/venues/iq' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }))
vi.mock('@/hooks/useStockAdjustmentTour', () => ({ useStockAdjustmentTour: () => ({ start: vi.fn() }) }))
vi.mock('@/hooks/useInventoryWelcomeTour', () => ({ useInventoryWelcomeTour: () => ({ start: vi.fn() }) }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ getShortLabel: (unit: string) => unit }) }))
// Como la tabla real: mientras carga sólo pinta el esqueleto, así que el botón ni existe (Codex r2).
vi.mock('@/components/data-table', () => ({
  default: ({
    data,
    tableTab,
    tableTabLeft,
    isLoading,
  }: {
    data: { id: string; name: string }[]
    tableTab: ReactNode
    tableTabLeft: ReactNode
    isLoading: boolean
  }) =>
    isLoading ? (
      <div data-testid="esqueleto" />
    ) : (
      <div>
        {tableTabLeft}
        {tableTab}
        {data.length === 0 ? <p>Sin resultados</p> : data.map(fila => <p key={fila.id}>{fila.name}</p>)}
      </div>
    ),
}))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('./components/InventoryLabelModal', () => ({ InventoryLabelModal: () => null }))
vi.mock('./components/AdjustStockDialog', () => ({ AdjustStockDialog: () => null }))
vi.mock('@/services/menu.service', () => ({ getProducts: (...args: unknown[]) => mocks.products(...args) }))
vi.mock('@/services/inventory.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/inventory.service')>()),
  rawMaterialsApi: { getAll: (...args: unknown[]) => mocks.materials(...args) },
}))
vi.mock('@/utils/export', () => ({
  exportSheetsToExcel: (...args: unknown[]) => mocks.exportSheets(...args),
  generateFilename: (prefix: string, venue?: string) => `${prefix}-${venue}-hoy`,
}))

const prenda = (i: number) => ({
  id: `p${i}`,
  name: `Vestido ${i}`,
  sku: `VES-${i}`,
  price: 5550,
  cost: 1500,
  trackInventory: true,
  inventoryMethod: 'QUANTITY',
  availableQuantity: i,
})
const receta = { id: 'r1', name: 'Latte', sku: 'LAT', price: 65, trackInventory: true, inventoryMethod: 'RECIPE', availableQuantity: 4 }
const leche = { id: 'm1', name: 'Leche', sku: null, unit: 'LITER', currentStock: 3, reorderPoint: 1, costPerUnit: 20 }

let client: QueryClient
function renderSummary() {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InventorySummary />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const terminoDeCargar = () => waitFor(() => expect(client.isFetching()).toBe(0))
const exportar = () => screen.getByRole('button', { name: es.stockExport.button })
const toasts = () => mocks.toast.mock.calls.map(([arg]) => arg)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.products.mockResolvedValue([])
  mocks.materials.mockResolvedValue({ data: [] })
  mocks.exportSheets.mockResolvedValue(undefined)
})
afterEach(() => client?.clear())

describe('Exportar en Resumen de Existencias', () => {
  it('descarga TODO lo de la pestaña, no sólo la página que se ve, y dice cuántos artículos llevó', async () => {
    mocks.products.mockResolvedValue([...Array.from({ length: 60 }, (_, i) => prenda(i + 1)), receta])
    mocks.materials.mockResolvedValue({ data: [leche] })
    renderSummary()
    await terminoDeCargar()

    fireEvent.click(exportar())

    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
    const [[hoja], nombre] = mocks.exportSheets.mock.calls[0]
    expect(nombre).toBe('existencias-iq-hoy')
    expect(hoja.name).toBe('Existencias')
    expect(hoja.rows).toHaveLength(61)
    expect(hoja.rows[0]).toEqual({ Artículo: 'Vestido 1', Tipo: 'Producto', SKU: 'VES-1', Disponible: 1, Unidad: '', Mínimo: '', Precio: 5550 })
    expect(hoja.rows[60]).toMatchObject({ Artículo: 'Leche', Tipo: 'Ingrediente', Disponible: 3, Unidad: 'LITER', Mínimo: 1 })
    await waitFor(() => expect(toasts()).toEqual([{ title: 'Excel descargado', description: 'Artículos: 61' }]))
  })

  it('respeta la búsqueda: sale lo mismo que se ve en pantalla', async () => {
    mocks.products.mockResolvedValue([prenda(1), prenda(2)])
    renderSummary()
    await terminoDeCargar()

    fireEvent.click(document.querySelector('.lucide-search')!.closest('button')!)
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o SKU...'), { target: { value: 'VES-2' } })
    fireEvent.click(exportar())

    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
    expect(mocks.exportSheets.mock.calls[0][0][0].rows.map((r: Record<string, unknown>) => r.SKU)).toEqual(['VES-2'])
  })

  it('en la pestaña de recetas descarga las recetas, en su propio archivo', async () => {
    mocks.products.mockResolvedValue([prenda(1), receta])
    renderSummary()
    await terminoDeCargar()

    fireEvent.click(screen.getByRole('button', { name: /Basados en Receta/ }))
    fireEvent.click(exportar())

    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
    const [[hoja], nombre] = mocks.exportSheets.mock.calls[0]
    expect(nombre).toBe('existencias-receta-iq-hoy')
    expect(hoja.rows).toEqual([{ Artículo: 'Latte', SKU: 'LAT', 'Disponible (teórico)': 4, Precio: 65 }])
  })

  it('sin artículos lo dice y no descarga un archivo vacío', async () => {
    renderSummary()
    await terminoDeCargar()

    fireEvent.click(exportar())

    await waitFor(() => expect(toasts()).toEqual([{ title: 'No hay artículos para exportar' }]))
    expect(mocks.exportSheets).not.toHaveBeenCalled()
  })

  it('si no cargaron los productos, no descarga un archivo incompleto que parezca bueno', async () => {
    mocks.products.mockRejectedValue({ response: { status: 500 } })
    mocks.materials.mockResolvedValue({ data: [leche] })
    renderSummary()
    await waitFor(() => expect(client.getQueryCache().getAll().some(q => q.state.status === 'error')).toBe(true))
    await terminoDeCargar()

    fireEvent.click(exportar())

    await waitFor(() => expect(toasts()[0]).toMatchObject({ title: 'No pudimos cargar el inventario', variant: 'destructive' }))
    expect(mocks.exportSheets).not.toHaveBeenCalled()
  })

  it('si fallaron los ingredientes por un error, tampoco; pero la pestaña de recetas no depende de ellos', async () => {
    mocks.products.mockResolvedValue([prenda(1), receta])
    mocks.materials.mockRejectedValue({ response: { status: 500 } })
    renderSummary()
    await waitFor(() => expect(client.getQueryCache().getAll().some(q => q.state.status === 'error')).toBe(true))
    await terminoDeCargar()

    fireEvent.click(exportar())
    await waitFor(() => expect(toasts()[0]).toMatchObject({ variant: 'destructive' }))
    expect(mocks.exportSheets).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Basados en Receta/ }))
    fireEvent.click(exportar())
    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
  })

  it('un rol sin permiso de ingredientes sí exporta sus productos: es lo que ve', async () => {
    mocks.products.mockResolvedValue([prenda(1)])
    mocks.materials.mockRejectedValue({ response: { status: 403 } })
    renderSummary()
    await waitFor(() => expect(client.getQueryCache().getAll().some(q => q.state.status === 'error')).toBe(true))
    await terminoDeCargar()

    fireEvent.click(exportar())

    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
    expect(mocks.exportSheets.mock.calls[0][0][0].rows).toHaveLength(1)
  })

  it('si falla al armar el Excel lo dice, y se puede reintentar', async () => {
    mocks.products.mockResolvedValue([prenda(1)])
    mocks.exportSheets.mockRejectedValueOnce(new Error('sin memoria'))
    renderSummary()
    await terminoDeCargar()

    fireEvent.click(exportar())

    await waitFor(() => expect(toasts()[0]).toMatchObject({ title: 'No se pudo exportar', variant: 'destructive' }))
    await waitFor(() => expect(exportar()).toBeEnabled())

    fireEvent.click(exportar())
    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(2))
  })

  it('un doble clic descarga un solo archivo, y mientras se arma se ve que está trabajando', async () => {
    mocks.products.mockResolvedValue([prenda(1)])
    let terminar = () => {}
    mocks.exportSheets.mockReturnValue(new Promise<void>(resolve => (terminar = resolve)))
    renderSummary()
    await terminoDeCargar()

    const boton = exportar()
    fireEvent.click(boton)
    fireEvent.click(boton)

    expect(await screen.findByRole('button', { name: es.stockExport.exporting })).toBeDisabled()
    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))

    terminar()
    await waitFor(() => expect(exportar()).toBeEnabled())
    expect(mocks.exportSheets).toHaveBeenCalledTimes(1)
  })

  it('mientras carga no deja exportar', async () => {
    mocks.products.mockReturnValue(new Promise(() => {}))
    renderSummary()

    expect(await screen.findByTestId('esqueleto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: es.stockExport.button })).not.toBeInTheDocument()
  })

  it('mientras se recarga tras un ajuste no baja los números de antes (Codex r1)', async () => {
    mocks.products.mockResolvedValue([prenda(5)])
    renderSummary()
    await terminoDeCargar()
    expect(exportar()).toBeEnabled()

    let responder = (_: unknown[]) => {}
    mocks.products.mockReturnValue(new Promise(resolve => (responder = resolve)))
    void client.invalidateQueries()

    await waitFor(() => expect(exportar()).toBeDisabled())

    responder([{ ...prenda(5), availableQuantity: 2 }])
    await waitFor(() => expect(exportar()).toBeEnabled())
    fireEvent.click(exportar())

    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
    expect(mocks.exportSheets.mock.calls[0][0][0].rows[0].Disponible).toBe(2)
  })

  it('las recetas se exportan aunque los ingredientes sigan cargando: no dependen de ellos (Codex r1)', async () => {
    mocks.products.mockResolvedValue([prenda(1), receta])
    mocks.materials.mockReturnValue(new Promise(() => {}))
    renderSummary()
    await waitFor(() => expect(screen.getByRole('button', { name: /Basados en Receta\s*1/ })).toBeInTheDocument())

    expect(screen.getByTestId('esqueleto')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Basados en Receta/ }))
    expect(exportar()).toBeEnabled()
    fireEvent.click(exportar())

    await waitFor(() => expect(mocks.exportSheets).toHaveBeenCalledTimes(1))
    expect(mocks.exportSheets.mock.calls[0][0][0].rows).toHaveLength(1)
  })
})

describe('Si falla la carga del inventario', () => {
  const caida = { response: { status: 500 } }
  const aviso = () => screen.queryByRole('alert')
  const reintentar = () => screen.getByRole('button', { name: 'retry' })
  const pestanaFisica = () => screen.getByRole('button', { name: /Artículos e Ingredientes/ })
  const pestanaRecetas = () => screen.getByRole('button', { name: /Basados en Receta/ })

  it('si no cargó nada lo dice y deja reintentar, en vez de «Sin resultados» con el contador en 0', async () => {
    mocks.products.mockRejectedValue(caida)
    renderSummary()

    expect(await screen.findByRole('alert')).toHaveTextContent(es.stockLoad.failed)
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument()
    expect(pestanaFisica()).not.toHaveTextContent(/\d/)

    mocks.products.mockResolvedValue([prenda(1)])
    fireEvent.click(reintentar())

    expect(await screen.findByText('Vestido 1')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
    expect(pestanaFisica()).toHaveTextContent('1')
  })

  it('si sólo fallaron los productos enseña lo que sí llegó y avisa que falta algo; recetas no tiene nada que enseñar', async () => {
    mocks.products.mockRejectedValue(caida)
    mocks.materials.mockResolvedValue({ data: [leche] })
    renderSummary()

    expect(await screen.findByRole('alert')).toHaveTextContent(es.stockLoad.partial)
    expect(await screen.findByText('Leche')).toBeInTheDocument()

    fireEvent.click(pestanaRecetas())

    expect(aviso()).toHaveTextContent(es.stockLoad.failed)
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument()
  })

  it('si sólo fallaron los ingredientes avisa en su pestaña; las recetas no dependen de ellos', async () => {
    mocks.products.mockResolvedValue([prenda(1), receta])
    mocks.materials.mockRejectedValue(caida)
    renderSummary()

    expect(await screen.findByRole('alert')).toHaveTextContent(es.stockLoad.partial)
    expect(screen.getByText('Vestido 1')).toBeInTheDocument()

    fireEvent.click(pestanaRecetas())

    expect(aviso()).not.toBeInTheDocument()
    expect(screen.getByText('Latte')).toBeInTheDocument()
  })

  it('reintentar repite sólo lo que falló', async () => {
    mocks.products.mockResolvedValue([prenda(1)])
    mocks.materials.mockRejectedValue(caida)
    renderSummary()
    await screen.findByRole('alert')
    await terminoDeCargar()
    mocks.products.mockClear()
    mocks.materials.mockResolvedValue({ data: [leche] })

    fireEvent.click(reintentar())

    expect(await screen.findByText('Leche')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
    expect(mocks.products).not.toHaveBeenCalled()
  })

  it('si falla la recarga tras un ajuste conserva la lista y avisa que puede estar vieja; al reintentar se quita el aviso', async () => {
    mocks.products.mockResolvedValue([prenda(1)])
    renderSummary()
    await screen.findByText('Vestido 1')

    mocks.products.mockRejectedValue(caida)
    void client.invalidateQueries()

    expect(await screen.findByRole('alert')).toHaveTextContent(es.stockLoad.partial)
    expect(screen.getByText('Vestido 1')).toBeInTheDocument()
    await terminoDeCargar()

    mocks.products.mockReturnValue(new Promise(() => {}))
    fireEvent.click(reintentar())

    await waitFor(() => expect(aviso()).not.toBeInTheDocument())
    expect(screen.getByText('Vestido 1')).toBeInTheDocument()
  })

  it('un rol sin permiso de ingredientes no tiene un fallo: ve lo suyo, sin aviso', async () => {
    mocks.products.mockResolvedValue([prenda(1)])
    mocks.materials.mockRejectedValue({ response: { status: 403 } })
    renderSummary()
    await waitFor(() => expect(client.getQueryCache().getAll().some(q => q.state.status === 'error')).toBe(true))
    await terminoDeCargar()

    expect(screen.getByText('Vestido 1')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })

  it('un negocio de verdad vacío sigue diciendo «Sin resultados», sin aviso', async () => {
    renderSummary()
    await terminoDeCargar()

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })

  it('mientras carga no avisa de nada', async () => {
    mocks.products.mockReturnValue(new Promise(() => {}))
    renderSummary()

    expect(await screen.findByTestId('esqueleto')).toBeInTheDocument()
    expect(aviso()).not.toBeInTheDocument()
  })
})

describe('Importar', () => {
  it('no se ve como si funcionara: está apagado y dice «Muy pronto»', async () => {
    renderSummary()
    await terminoDeCargar()

    const boton = screen.getByRole('button', { name: /Importar/ })
    expect(boton).toBeDisabled()
    expect(boton).toHaveTextContent('Muy pronto')
  })
})
