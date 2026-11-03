/**
 * El Centro de Mando decía «Dinero en Calle $45,200», «Meta diaria $135,000» y «+12.5 % vs ayer» siempre, en cualquier negocio
 * y cualquier día: estaban escritos a mano en el código. Lo que no se calcula no se pinta como dato.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { sinDatos } = vi.hoisted(() => ({ sinDatos: () => ({ data: undefined, isLoading: false, refetch: () => undefined }) }))
vi.mock('@/hooks/useStoresAnalysis', () => ({
  useStoresOverview: () => ({ data: { todaySales: 1234 }, isLoading: false, refetch: () => undefined }),
  useStoresVenues: sinDatos,
  useStoresOnlineStaff: sinDatos,
  useStoresActivityFeed: sinDatos,
  useStoresStockSummary: sinDatos,
  useStoresAnomalies: sinDatos,
  useStoresRevenueVsTarget: sinDatos,
  useStoresVolumeVsTarget: sinDatos,
  useStoresTopPromoter: sinDatos,
  useStoresWorstAttendance: sinDatos,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { timezone: 'America/Mexico_City' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'es' } }),
}))

import CommandCenter from '../CommandCenter'

describe('Centro de Mando', () => {
  it('no pinta cifras escritas a mano', () => {
    render(
      <MemoryRouter>
        <CommandCenter />
      </MemoryRouter>,
    )
    const texto = document.body.textContent ?? ''
    expect(texto).not.toMatch(/45,200|135,000|12\.5%|Meta diaria/)
  })

  it('«Dinero en Calle» dice que viene pronto, y las ventas reales siguen', () => {
    render(
      <MemoryRouter>
        <CommandCenter />
      </MemoryRouter>,
    )
    expect(screen.getByText('Dinero en Calle (Riesgo)')).toBeInTheDocument()
    expect(screen.getByText('common:common.comingSoon')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver Detalle' })).toBeNull()
    expect(document.body.textContent).toMatch(/1,234/)
  })
})
