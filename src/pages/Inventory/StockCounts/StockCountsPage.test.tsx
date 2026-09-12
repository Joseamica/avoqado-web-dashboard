import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import StockCountsPage from './StockCountsPage'
import type { StockCountRow } from '@/services/stockCount.service'

/**
 * La lista de conteos. Lo que fijan estas pruebas, todas nacidas de la captura de
 * Mindform (137 líneas, 0 contadas, y la columna decía «−6968054.084»):
 *
 *  - Un borrador sin capturas dice «Sin contar»; NUNCA un número que nadie contó.
 *  - Las diferencias salen POR UNIDAD, porque sumar gramos con piezas no es un número.
 *  - Un conteo cancelado se ve como cancelado.
 *  - La página la manda el SERVIDOR (`page`/`pageSize` 50) y «Cargar más» AÑADE;
 *    ninguna fila cargada se esconde.
 *  - Un fallo de red se ve como fallo, NUNCA como «aún no hay conteos».
 */
// Eco de la clave contra el JSON real de `es`. Tolerante a propósito: i18next acepta
// un ARREGLO de claves con respaldo (`DataTablePagination` llama
// `t(['pagination.selectedRows', 'tpv.pagination.selectedRows'], …)`), y un stub que
// asume string revienta con «key.split is not a function» — un error que no habla del
// sujeto de la prueba. Mismo endurecimiento que ya lleva `Campaigns.test.tsx`.
const t = (key: string | string[], opts?: Record<string, unknown>) => {
  if (typeof key !== 'string') return String(key)
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venue: { id: 'v1', slug: 'mindform' }, venueId: 'v1', fullBasePath: '/venues/mindform' }),
}))
const list = vi.fn()
vi.mock('@/services/stockCount.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/stockCount.service')>()
  return { ...mod, stockCountService: { ...mod.stockCountService, list: (...a: unknown[]) => list(...a) } }
})

const fila = (o: Partial<StockCountRow>): StockCountRow => ({
  id: 'c1',
  type: 'FULL',
  status: 'IN_PROGRESS',
  note: null,
  createdAt: '2026-09-07T22:51:23.142Z',
  completedAt: null,
  cancelledAt: null,
  createdBy: 'Fatima Flores',
  itemCount: 137,
  summary: { itemCount: 137, countedCount: 0, matchedCount: 0, mismatchedCount: 0, differenceByUnit: [] },
  totalDifference: 0,
  ...o,
})
const pagina = (data: StockCountRow[], page: number, totalPages: number, total: number) => ({
  success: true,
  data,
  pagination: { page, pageSize: 50, total, totalPages },
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StockCountsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('StockCountsPage', () => {
  it('un borrador sin capturas dice «Sin contar» y «0 de 137 contados», nunca un número', async () => {
    list.mockResolvedValue(pagina([fila({})], 1, 1, 1))
    renderPage()
    expect(await screen.findByText('Sin contar')).toBeInTheDocument()
    expect(screen.getByText('0 de 137 contados')).toBeInTheDocument()
    expect(screen.queryByText(/-?\d{6,}/)).not.toBeInTheDocument()
  })

  it('un conteo completado enseña la diferencia por unidad', async () => {
    list.mockResolvedValue(
      pagina(
        [
          fila({
            id: 'c2',
            status: 'COMPLETED',
            summary: {
              itemCount: 3,
              countedCount: 3,
              matchedCount: 1,
              mismatchedCount: 2,
              differenceByUnit: [
                { unit: 'GRAM', difference: -150 },
                { unit: 'PIECE', difference: 2 },
              ],
            },
          }),
        ],
        1,
        1,
        1,
      ),
    )
    renderPage()
    expect(await screen.findByText(/[−-]150 g/)).toBeInTheDocument()
    // «pza», no «piece»: `units.PIECE_abbr` SÍ existe en es/inventory.json, así que
    // `etiquetaDeUnidad` devuelve la abreviatura traducida y nunca cae al nombre del
    // enum. Afirmar «piece» pasaría por el motivo equivocado — sería fijar un respaldo
    // que el usuario mexicano no ve jamás.
    expect(screen.getByText(/\+2 pza/)).toBeInTheDocument()
    expect(screen.getByText('3 de 3 contados')).toBeInTheDocument()
  })

  // 🔴 Dependencia de orden de despliegue: `summary` lo ESTRENA el servidor de este
  // mismo cambio. Dashboard y servidor despliegan en minutos, pero nada garantiza el
  // orden — y si el dashboard sale primero, una fila sin `summary` no puede tumbar la
  // lista entera: degrada esa columna y nada más. El tipo se queda obligatorio a
  // propósito (por eso el cast), porque la respuesta futura sí lo trae siempre.
  it('una fila sin `summary` (servidor viejo) no revienta: dice «Sin contar» y «0 de 137 contados»', async () => {
    const sinResumen: Partial<StockCountRow> = { ...fila({ id: 'c9' }) }
    delete sinResumen.summary
    list.mockResolvedValue(pagina([sinResumen as unknown as StockCountRow], 1, 1, 1))
    renderPage()
    expect(await screen.findByText('Sin contar')).toBeInTheDocument()
    // El total cae al `itemCount` de la fila, que el servidor viejo SÍ manda.
    expect(screen.getByText('0 de 137 contados')).toBeInTheDocument()
  })

  it('un conteo cancelado se ve como Cancelado', async () => {
    list.mockResolvedValue(pagina([fila({ id: 'c3', status: 'CANCELLED', cancelledAt: '2026-09-08T01:00:00.000Z' })], 1, 1, 1))
    renderPage()
    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
  })

  it('«Cargar más» pide la siguiente página y la AÑADE; enseña «Mostrando X de Y»', async () => {
    list
      .mockResolvedValueOnce(pagina([fila({ id: 'c1' })], 1, 2, 51))
      .mockResolvedValueOnce(pagina([fila({ id: 'c2', createdBy: 'Segunda Página' })], 2, 2, 51))
    renderPage()
    expect(await screen.findByText('Mostrando 1 de 51')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: es.stockCounts.loadMore }))
    expect(await screen.findByText('Segunda Página')).toBeInTheDocument()
    expect(screen.getByText('Fatima Flores')).toBeInTheDocument() // la primera sigue
    expect(screen.getByText('Mostrando 2 de 51')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith('v1', expect.objectContaining({ page: 2, pageSize: 50 }))
    expect(screen.queryByRole('button', { name: es.stockCounts.loadMore })).not.toBeInTheDocument()
  })

  // 🔴 Lo que «Cargar más» esconde si la tabla vuelve a rebanar: DataTable pagina por
  // dentro a 20 filas y con `hidePagination` no queda ni un control para alcanzar el
  // resto — 30 de 50 filas CARGADAS desaparecen sin un error, sin un aviso, y con el
  // pie diciendo «Mostrando 50 de 51». Es justo el truncado silencioso que prohíbe
  // `bounded-data-and-query-load.md`.
  it('ninguna fila cargada se esconde: 50 + 1 de «Cargar más» se ven las 51', async () => {
    const primera = Array.from({ length: 50 }, (_, i) => fila({ id: `c${i + 1}`, createdBy: `Persona ${i + 1}` }))
    list
      .mockResolvedValueOnce(pagina(primera, 1, 2, 51))
      .mockResolvedValueOnce(pagina([fila({ id: 'c51', createdBy: 'Persona 51' })], 2, 2, 51))
    renderPage()
    expect(await screen.findByText('Persona 1')).toBeInTheDocument()
    expect(screen.getByText('Persona 21')).toBeInTheDocument() // más allá de las 20 del default

    await userEvent.click(screen.getByRole('button', { name: es.stockCounts.loadMore }))
    // 🔴 La 51 es la que discrimina: con el rebanado interno encendido (pageSize 50) la
    // fila 51 se caería de la tabla y, con `hidePagination`, no habría control para
    // alcanzarla — 1 de 51 filas CARGADAS desaparecida en silencio.
    expect(await screen.findByText('Persona 51')).toBeInTheDocument()
    expect(screen.getByText('Persona 50')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 51 de 51')).toBeInTheDocument()
  })

  // 🔴 Una lista vacía por un 500 que se ve igual que «no hay nada» es un reporte FALSO
  // al dueño: le dice que su equipo nunca ha contado, cuando lo que pasó es que el
  // servidor no contestó. Lo prohíbe `testing-and-git.md` §3, y aplica aquí porque este
  // trabajo cambió de dónde lee la lista.
  it('un fallo de red se ve como fallo —no como «aún no hay conteos»— y se puede reintentar', async () => {
    list.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(pagina([fila({ createdBy: 'Tras el reintento' })], 1, 1, 1))
    renderPage()
    expect(await screen.findByText(es.stockCounts.loadError)).toBeInTheDocument()
    expect(screen.queryByText('Aún no hay conteos')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: es.stockCounts.retry }))
    expect(await screen.findByText('Tras el reintento')).toBeInTheDocument()
    expect(screen.queryByText(es.stockCounts.loadError)).not.toBeInTheDocument()
  })
})
