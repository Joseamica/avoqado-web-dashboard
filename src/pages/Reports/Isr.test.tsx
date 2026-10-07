import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useIsrProvisional } from '@/hooks/useIsr'
import Isr from './Isr'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/hooks/useIsr', () => ({ useIsrProvisional: vi.fn() }))
// El candado del plan (la pantalla y su FeatureGate) y su precio suelto: con acceso, sin red ni proveedor. Funciones normales,
// no vi.fn: `mockReset: true` vaciaría un vi.fn() del factory antes de cada prueba.
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, requiredTier: 'premium', isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-feature-price', () => ({ useFeaturePrice: () => ({ price: null, canSeePrices: false, canPurchase: false }) }))

const pantalla = () =>
  render(
    <MemoryRouter>
      <Isr />
    </MemoryRouter>,
  )

describe('Isr · los dos errores del reporte (fallo 2 de la ronda 7; Codex r6 R6-2)', () => {
  // Con llaves: un `beforeEach` que DEVUELVE una función hace que Vitest la llame como limpieza tras cada prueba; sin ellas
  // devolvería el doble y, en el hook, su promesa rechazada tumbaba la prueba después de pasar.
  beforeEach(() => {
    vi.mocked(useIsrProvisional).mockReset()
  })

  it('🔴 REPORT_TOO_LARGE: el texto mensual (el mismo que el IVA), no «elige un rango más corto»', () => {
    vi.mocked(useIsrProvisional).mockReturnValue({
      isLoading: false,
      isError: true,
      error: { response: { data: { code: 'REPORT_TOO_LARGE', message: 'El periodo tiene más de 300,000 ventas…' } } },
      data: undefined,
      refetch: vi.fn(),
    } as never)
    pantalla()
    expect(screen.getByText('accountingError.mesNoCalculado')).toBeInTheDocument()
  })

  it('control · otro error: el genérico', () => {
    vi.mocked(useIsrProvisional).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Network Error'),
      data: undefined,
      refetch: vi.fn(),
    } as never)
    pantalla()
    expect(screen.getByText('accountingError.body')).toBeInTheDocument()
  })
})
