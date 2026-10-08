// Agregado a la Parte 2 (revisión de la Parte 1 server, duda 3): `GET /summaries` sin fechas —así lo llama esta tabla— recorría
// toda la historia de la sede. El servidor ahora usa, sin fechas, los últimos 12 meses; la tabla lo DICE («Últimos 12 meses») y
// conserva «Mostrando N de total» cuando el servidor topa los renglones. Se prueba con la API simulada: el servicio y el hook reales
// sobre un `api.get` fingido, así la prueba ve la petición tal cual sale y la respuesta tal cual llega.
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamCommissionTable from '../TeamCommissionTable'

const m = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'x', fullBasePath: '/venues/x' }) }))
vi.mock('@/components/data-table', () => ({ default: ({ data }: { data: unknown[] }) => <p>{`renglones:${data.length}`}</p> }))

const resumen = (i: number) => ({
  id: `s${i}`,
  staffId: `st${i}`,
  staff: { firstName: 'Carlos', lastName: `R${i}`, staffVenueId: `sv${i}` },
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  totalCommissions: 10,
  netAmount: 10,
  status: 'CALCULATED',
})

const pintar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TeamCommissionTable />
    </QueryClientProvider>,
  )

beforeEach(() => vi.clearAllMocks())

describe('TeamCommissionTable — ventana de 12 meses del servidor', () => {
  it('🔴 pide los resúmenes SIN fechas (el servidor pone la ventana) y dice «Últimos 12 meses»', async () => {
    m.get.mockResolvedValue({ data: { data: [resumen(1), resumen(2)], total: 2 } })
    pintar()
    expect(await screen.findByText('renglones:2')).toBeInTheDocument()
    expect(m.get).toHaveBeenCalledTimes(1)
    const url = String(m.get.mock.calls[0][0])
    expect(url).toMatch(/^\/api\/v1\/dashboard\/commissions\/venues\/v1\/summaries\?/)
    expect(url).not.toMatch(/periodStart|periodEnd|startDate|endDate/)
    expect(screen.getByText('summary.lastTwelveMonths')).toBeInTheDocument()
    expect(screen.queryByText(/summary\.showing/)).toBeNull()
  })

  it('🔴 si el servidor topó la ventana, dice las dos cosas: «Últimos 12 meses» y «Mostrando N de total»', async () => {
    m.get.mockResolvedValue({ data: { data: Array.from({ length: 500 }, (_, i) => resumen(i)), total: 730 } })
    pintar()
    expect(await screen.findByText('renglones:500')).toBeInTheDocument()
    expect(screen.getByText('summary.lastTwelveMonths')).toBeInTheDocument()
    expect(screen.getByText('summary.showing:{"n":500,"total":730}')).toBeInTheDocument()
  })

  it('🔴 sin resúmenes en la ventana, el vacío también dice de qué ventana habla', async () => {
    m.get.mockResolvedValue({ data: { data: [], total: 0 } })
    pintar()
    await waitFor(() => expect(screen.getByText('summary.noSummaries')).toBeInTheDocument())
    expect(screen.getByText('summary.lastTwelveMonths')).toBeInTheDocument()
  })
})
