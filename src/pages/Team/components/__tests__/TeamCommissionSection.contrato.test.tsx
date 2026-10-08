// E6a-fix4: el historial de comisiones de una persona en Equipo trae 12 periodos y el servidor dice cuántos tiene en total
// (`summariesTotal`). Del JSON del servidor a la pantalla, con el servicio y los hooks REALES (sólo `api.get` simulado): con 13
// periodos se dice «Mostrando 12 de 13»; nunca un recorte mudo.
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamCommissionSection from '../TeamCommissionSection'

const m = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('react-router-dom', () => ({ Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a> }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/api', () => ({ default: { get: m.get } }))
vi.mock('@/components/data-table', () => ({
  default: ({ data }: { data: unknown[] }) => <output data-testid="renglones">{data.length}</output>,
}))

const periodo = (i: number) => ({
  id: `s${i}`,
  staffId: 'st1',
  periodStart: `2025-${String((i % 12) + 1).padStart(2, '0')}-01`,
  periodEnd: `2025-${String((i % 12) + 1).padStart(2, '0')}-28`,
  totalCommissions: 10,
  totalBonuses: 0,
  netAmount: 10,
  status: 'PAID',
})
const servidor = (extra: object) =>
  m.get.mockImplementation(async (url: string) => {
    if (url.includes('/staff/st1/commissions')) {
      return { data: { data: { calculations: [], summaries: Array.from({ length: 12 }, (_, i) => periodo(i)), stats: { thisMonth: 0, lastMonth: 0, total: 120 }, tierProgress: null, ...extra } } }
    }
    if (url.endsWith('/stats')) return { data: { staffPayActive: false } }
    throw new Error(`sin simular: ${url}`)
  })
const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TeamCommissionSection staffId="st1" />
    </QueryClientProvider>,
  )

beforeEach(() => vi.clearAllMocks())

describe('historial de comisiones de una persona: del servidor a la pantalla', () => {
  it('con 13 periodos y 12 renglones dice «Mostrando 12 de 13»', async () => {
    servidor({ summariesTotal: 13 })
    montar()
    expect(await screen.findByText('summary.showing:{"n":12,"total":13}')).toBeInTheDocument()
    expect(screen.getByTestId('renglones')).toHaveTextContent('12')
  })
  it('con 12 de 12, o con un servidor previo sin el total, no dice nada', async () => {
    servidor({ summariesTotal: 12 })
    const { unmount } = montar()
    expect(await screen.findByTestId('renglones')).toHaveTextContent('12')
    expect(screen.queryByText(/summary\.showing/)).toBeNull()
    unmount()
    servidor({})
    montar()
    expect(await screen.findByTestId('renglones')).toHaveTextContent('12')
    expect(screen.queryByText(/summary\.showing/)).toBeNull()
  })
})
