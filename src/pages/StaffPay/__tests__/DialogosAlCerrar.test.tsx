// E6a-fix4 K-n1, hermanos: los diálogos de confirmación que se abren con un estado (`open={!!x}`) vaciaban ese estado al cerrar,
// y durante la animación de salida (Radix deja el contenido montado) el texto cambiaba: propinas decía «¿Apagar…?» tras pedir
// encenderlas, archivar un nivel perdía su nombre («¿Archivar «»?») y cambiar la frecuencia se quedaba sin título. La animación
// se simula como la lee Radix (`@/test/animacionDeSalida`). Hooks REALES; sólo los servicios y lo que no se prueba aquí, simulados.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simularAnimacionDeSalida, terminarAnimacion } from '@/test/animacionDeSalida'
import { InterruptorPropinas } from '../components/InterruptorPropinas'
import { NivelesSection } from '../components/NivelesSection'
import { PeriodosTab } from '../components/PeriodosTab'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => d }) }))
vi.mock('../components/PeriodoAbiertoTab', () => ({ PeriodoAbiertoTab: () => null }))
vi.mock('../components/PeriodoCerradoView', () => ({ PeriodoCerradoView: () => null }))
vi.mock('../components/ActivarPagoAlPersonal', () => ({ ActivarPagoAlPersonal: () => null }))
vi.mock('../components/AvisoSedesFuera', () => ({ AvisoSedesFuera: () => null }))
// Select nativo: el Select de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: { value: string; onValueChange: (v: string) => void; disabled?: boolean; children: ReactNode }) => (
    <select aria-label="select" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}))
vi.mock('@/hooks/useStaffPay', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useStaffPay')>()),
  useStaffPayAccess: () => ({ data: { enabled: true, activado: true, startDate: '2026-09-01', propinasEncendidas: false } }),
  useStaffPayPeriods: () => ({
    data: {
      periodicidad: 'MONTHLY',
      puedeCambiarPeriodicidad: true,
      items: [{ id: null, start: '2026-10-01', end: '2026-10-31', estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' }],
      antesDe: null,
    },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
    refetch: vi.fn(),
  }),
}))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: {} }))

beforeEach(() => simularAnimacionDeSalida())
afterEach(() => vi.restoreAllMocks())

const pintar = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
/** Cancela el diálogo y, mientras dura la animación de salida, devuelve su texto; luego la termina. */
async function textoAlCerrar() {
  const dialogo = screen.getByRole('alertdialog')
  fireEvent.click(within(dialogo).getByRole('button', { name: /cancel/ }))
  await waitFor(() => expect(dialogo).toHaveAttribute('data-state', 'closed'))
  const texto = dialogo.textContent
  terminarAnimacion(dialogo)
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  return texto
}

describe('diálogos de confirmación al cerrarse (K-n1, hermanos)', () => {
  it('🔴 propinas: tras pedir ENCENDERLAS, al cerrarse sigue diciendo «encender», nunca «apagar»', async () => {
    pintar(<InterruptorPropinas encendidas={false} />)
    fireEvent.click(screen.getByRole('switch'))
    await screen.findByText('tips.onTitle')
    const texto = await textoAlCerrar()
    expect(texto).toContain('tips.onTitle')
    expect(texto).not.toContain('tips.offTitle')
  })
  it('🔴 archivar un nivel: al cerrarse el título conserva el nombre', async () => {
    pintar(<NivelesSection activos={[{ id: 'hc', name: 'Head Coach', sortOrder: 0, archivedAt: null }]} />)
    fireEvent.click(screen.getByRole('button', { name: /levels\.archiveLevel/ }))
    await screen.findByText('levels.archiveTitle:{"name":"Head Coach"}')
    expect(await textoAlCerrar()).toContain('levels.archiveTitle:{"name":"Head Coach"}')
  })
  it('🔴 cambiar la frecuencia: al cerrarse el título y el botón siguen diciendo a cuál', async () => {
    pintar(<PeriodosTab activa />)
    fireEvent.change(screen.getAllByRole('combobox', { name: 'select' })[1], { target: { value: 'SEMIMONTHLY' } })
    await screen.findByRole('button', { name: /periods\.changeConfirm/ })
    const texto = await textoAlCerrar()
    expect(texto).toContain('periods.changeTitle:{"frecuencia":"periods.short.SEMIMONTHLY"}')
    expect(texto).toContain('periods.changeConfirm:{"frecuencia":"periods.short.SEMIMONTHLY"}')
  })
})
