import type { ReactNode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/inventory.json'
import type { WasteReport, WasteReportsPage } from '@/services/inventoryWaste.service'
import InventoryWastePage from './InventoryWastePage'

/**
 * La lista «Mermas». Lo que fija:
 *  - Se ve lo declarado, lo «sin existencia» y el costo; un costo desconocido dice «Sin valorar», nunca $0.
 *  - El motivo sale por CÓDIGO (también el de los registros viejos: «Sin especificar»).
 *  - La página la manda el servidor (50) y «Cargar más» pide la siguiente; ninguna fila se esconde.
 *  - La búsqueda viaja al servidor.
 *  - Un fallo se ve como fallo, nunca como «aún no hay mermas».
 */
const t = (key: string | string[], opts?: Record<string, unknown>) => {
  if (typeof key !== 'string') return String(key)
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venue: { id: 'v1' }, venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => `F:${d}`, formatDate: (d: string) => String(d).slice(0, 10), venueTimezone: 'America/Mexico_City' }) }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ formatUnitWithQuantity: (_q: number, u: string) => u.toLowerCase() }) }))
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }))
const list = vi.fn()
vi.mock('@/services/inventoryWaste.service', async importOriginal => {
  const mod = await importOriginal<typeof import('@/services/inventoryWaste.service')>()
  return { ...mod, wasteReportsApi: { list: (...a: unknown[]) => list(...a) } }
})

const reporte = (o: Partial<WasteReport>): WasteReport => ({
  id: 'r1',
  itemType: 'RAW_MATERIAL',
  rawMaterialId: 'rm1',
  productId: null,
  unit: 'KILOGRAM',
  reasonCode: 'EXPIRED',
  declaredQuantity: '5',
  deductedQuantity: '3',
  unrecordedQuantity: '2',
  costImpact: '8',
  costState: 'PARTIAL',
  unitCostSnapshot: null,
  note: 'caja golpeada',
  reference: null,
  supplier: null,
  source: 'POS',
  createdAt: '2026-09-21T18:00:00.000Z',
  clientOccurredAt: null,
  reportedByStaffId: 's1',
  reportedByStaff: { firstName: 'Fátima', lastName: 'Flores' },
  rawMaterial: { name: 'Aguacate', sku: 'AGU-1' },
  product: null,
  ...o,
})
const pagina = (items: WasteReport[], page: number, total: number): WasteReportsPage => ({ items, total, page, pageSize: 50 })

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InventoryWastePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const fila = async (nombre: string) => within((await screen.findByText(nombre)).closest('tr') as HTMLElement)

describe('InventoryWastePage', () => {
  it('muestra registrado, «sin existencia», costo parcial, motivo por código, nota, quién y desde dónde', async () => {
    list.mockResolvedValue(pagina([reporte({})], 1, 1))
    renderPage()
    const r = await fila('Aguacate')
    expect(r.getByText(/^5 kilogram$/)).toBeInTheDocument()
    expect(r.getByText('3 descontados')).toBeInTheDocument()
    expect(r.getByText('2 sin existencia')).toBeInTheDocument()
    expect(r.getByText(/\$8\.00/)).toBeInTheDocument()
    expect(r.getByText(es.wasteReports.cost.partial)).toBeInTheDocument()
    expect(r.getByText(es.waste.reasons.EXPIRED.label)).toBeInTheDocument()
    expect(r.getByText('caja golpeada')).toBeInTheDocument()
    expect(r.getByText('Fátima Flores')).toBeInTheDocument()
    expect(r.getByText('Punto de venta')).toBeInTheDocument()
  })

  it('sin costo conocido dice «Sin valorar», nunca $0; un registro viejo dice «Sin especificar»', async () => {
    list.mockResolvedValue(
      pagina([reporte({ id: 'r2', costImpact: null, costState: 'UNKNOWN', reasonCode: 'UNSPECIFIED', rawMaterial: { name: 'Leche', sku: 'LEC' } })], 1, 1),
    )
    renderPage()
    const r = await fila('Leche')
    expect(r.getByText('Sin valorar')).toBeInTheDocument()
    expect(r.queryByText(/\$0\.00/)).toBeNull()
    expect(r.getByText('Sin especificar')).toBeInTheDocument()
  })

  it('«Cargar más» pide la página 2 y AÑADE sus filas', async () => {
    const primeras = Array.from({ length: 50 }, (_, i) => reporte({ id: `a${i}`, rawMaterial: { name: `Insumo ${i}`, sku: `S${i}` } }))
    list.mockImplementation((_venueId: string, q: { page: number }) =>
      Promise.resolve(q.page === 1 ? pagina(primeras, 1, 51) : pagina([reporte({ id: 'z', rawMaterial: { name: 'El 51', sku: 'Z' } })], 2, 51)),
    )
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Mostrando 50 de 51')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('El 51')).toBeInTheDocument()
    expect(screen.getByText('Insumo 0')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith('v1', expect.objectContaining({ page: 2, pageSize: 50 }), expect.anything())
  })

  it('la búsqueda viaja al servidor', async () => {
    list.mockResolvedValue(pagina([reporte({})], 1, 1))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aguacate')
    await user.click(screen.getByRole('button', { name: es.wasteReports.searchPlaceholder }))
    await user.type(screen.getByPlaceholderText(es.wasteReports.searchPlaceholder), 'agua')
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('v1', expect.objectContaining({ search: 'agua', page: 1 }), expect.anything()))
  })

  it('un error se ve como error y deja reintentar; nunca «aún no hay mermas»', async () => {
    list.mockRejectedValue(new Error('500'))
    renderPage()
    // La lista reintenta UNA vez (regla de datos acotados), así que el error tarda en asentarse.
    expect(await screen.findByText(es.wasteReports.loadError, undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByText(es.wasteReports.emptyTitle)).toBeNull()
    expect(screen.getByRole('button', { name: es.wasteReports.retry })).toBeInTheDocument()
  })

  it('sin mermas lo dice y explica dónde se registran', async () => {
    list.mockResolvedValue(pagina([], 1, 0))
    renderPage()
    expect(await screen.findByText(es.wasteReports.emptyTitle)).toBeInTheDocument()
  })

  // Auditoría de Codex, P2-3: el servidor pagina por desplazamiento. Si entra una merma entre la
  // página 1 y la 2, la 2 repite una fila que ya se vio; concatenar sin deduplicar mostraba un folio
  // dos veces y «Mostrando 52 de 51» (el total se tomaba de la PRIMERA página, ya vieja).
  it('«Cargar más» no repite folios y el total es el ÚLTIMO que dijo el servidor', async () => {
    const primeras = Array.from({ length: 50 }, (_, i) => reporte({ id: `a${i}`, rawMaterial: { name: `Insumo ${i}`, sku: `S${i}` } }))
    list.mockImplementation((_venueId: string, q: { page: number }) =>
      Promise.resolve(
        q.page === 1
          ? pagina(primeras, 1, 51)
          : // entró una merma: la página 2 devuelve la ÚLTIMA de la página 1, ya desplazada, y el total nuevo
            pagina([reporte({ id: 'a49', rawMaterial: { name: 'Insumo 49', sku: 'S49' } }), reporte({ id: 'z', rawMaterial: { name: 'El 51', sku: 'Z' } })], 2, 52),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Mostrando 50 de 51')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('El 51')).toBeInTheDocument()
    expect(screen.getAllByText('Insumo 49')).toHaveLength(1)
    expect(screen.getByText('Mostrando 51 de 52')).toBeInTheDocument()
  })

  // Auditoría de Codex, P2-4: `.claude/rules/bounded-data-and-query-load.md` exige en una lista
  // pesada `staleTime >= 30s`, `retry: 1` y `refetchOnWindowFocus: false`. Sin eso, volver a la
  // pestaña vuelve a pedir TODAS las páginas cargadas, cada una con su conteo.
  it('volver a la ventana no vuelve a pedir las páginas ya cargadas', async () => {
    list.mockResolvedValue(pagina([reporte({})], 1, 1))
    renderPage()
    await screen.findByText('Aguacate')
    const antes = list.mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
      await new Promise(r => setTimeout(r, 300))
    })
    expect(list.mock.calls.length).toBe(antes)
  })

  // Auditoría de Codex, P3-6: L6 del spec acepta que la merma CUENTE en el día que llegó, pero
  // promete mostrar la fecha del aparato como dato informativo. Si sólo se ve la de llegada, el
  // dueño no puede distinguir «se tiró el 21» de «entró al sistema el 22».
  it('una merma que llegó tarde muestra también el día en que ocurrió', async () => {
    list.mockResolvedValue(
      pagina([reporte({ createdAt: '2026-09-22T18:00:00.000Z', clientOccurredAt: '2026-09-21T18:00:00.000Z' })], 1, 1),
    )
    renderPage()
    const r = await fila('Aguacate')
    expect(r.getByText(/Ocurrió el/)).toBeInTheDocument()
  })

  it('cuando ocurrió y llegó el MISMO día no repite la fecha', async () => {
    list.mockResolvedValue(
      pagina([reporte({ createdAt: '2026-09-22T18:00:00.000Z', clientOccurredAt: '2026-09-22T17:00:00.000Z' })], 1, 1),
    )
    renderPage()
    const r = await fila('Aguacate')
    expect(r.queryByText(/Ocurrió el/)).toBeNull()
  })

  // Auditoría de Codex, P2-5: una declaración que no descontó nada NO es «sin costo» — es que no hay
  // nada que valorar. El texto no puede afirmar que la pérdida no costó dinero.
  it('una merma que no descontó nada dice que no hay nada que valorar, no «sin costo»', async () => {
    list.mockResolvedValue(pagina([reporte({ costImpact: null, costState: 'NONE', deductedQuantity: '0', unrecordedQuantity: '5' })], 1, 1))
    renderPage()
    const r = await fila('Aguacate')
    expect(r.getByText(es.wasteReports.cost.none)).toBeInTheDocument()
    expect(es.wasteReports.cost.none).not.toMatch(/sin costo/i)
  })
})
