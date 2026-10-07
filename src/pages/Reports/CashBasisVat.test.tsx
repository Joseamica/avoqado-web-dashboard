import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useIvaCashflow } from '@/hooks/useIvaCashflow'
import CashBasisVat from './CashBasisVat'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: { timezone: 'America/Mexico_City' } }),
}))
vi.mock('@/hooks/useIvaCashflow', () => ({ useIvaCashflow: vi.fn() }))
// La pantalla (y su FeatureGate) piden el candado del plan, su precio suelto y la DIOT: se simulan con acceso, sin red ni
// proveedor (nota del brief: se ajusta la simulación, nunca la pantalla). Funciones normales, no vi.fn: la config tiene
// `mockReset: true`, que vaciaría un vi.fn() del factory antes de cada prueba.
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, requiredTier: 'premium', isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-feature-price', () => ({ useFeaturePrice: () => ({ price: null, canSeePrices: false, canPurchase: false }) }))
vi.mock('@/hooks/useExpenses', () => ({ useDiot: () => ({ data: undefined, isLoading: false, isError: false }) }))

const pantalla = () =>
  render(
    <MemoryRouter>
      <CashBasisVat />
    </MemoryRouter>,
  )

describe('CashBasisVat · el error del mes y la línea de las devoluciones (Codex r5 R5-8, R5-10; fallo 6)', () => {
  // Con llaves: un `beforeEach` que DEVUELVE una función hace que Vitest la llame como limpieza tras cada prueba; sin ellas
  // devolvería el doble y, en el hook, su promesa rechazada tumbaba la prueba después de pasar.
  beforeEach(() => {
    vi.mocked(useIvaCashflow).mockReset()
  })

  it('🔴 REPORT_TIMEOUT: el texto propio de la pantalla mensual, no «elige un rango más corto»', () => {
    vi.mocked(useIvaCashflow).mockReturnValue({
      isLoading: false,
      isError: true,
      error: { response: { data: { code: 'REPORT_TIMEOUT', message: 'El periodo es muy grande…' } } },
      data: undefined,
      refetch: vi.fn(),
    } as never)
    pantalla()
    expect(screen.getByText('accountingError.mesNoCalculado')).toBeInTheDocument()
    expect(screen.queryByText('El periodo es muy grande…')).not.toBeInTheDocument()
  })

  it('🔴 un mes con devoluciones y sin ventas: sin el aviso de actividad cero, y con la línea fija (que sale siempre)', () => {
    vi.mocked(useIvaCashflow).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: { needsFiscalSetup: false, zeroActivity: false, refundCount: 2, ivaTrasladadoPorTasaCents: { '0.16': -690 } },
      refetch: vi.fn(),
    } as never)
    pantalla()
    expect(screen.queryByText('cashBasisVat.zeroBody')).not.toBeInTheDocument()
    expect(screen.getByTestId('aviso-iva-por-tasa')).toBeInTheDocument()
  })
})
