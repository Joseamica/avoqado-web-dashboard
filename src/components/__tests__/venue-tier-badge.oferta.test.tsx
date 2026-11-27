// B4 (planes editables): la insignia del plan lleva el nombre de la oferta vigente (v2 «Plus»); con la v1 o sin dato, el de siempre.
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VenueTierBadge } from '@/components/venue-tier-badge'
import { OFERTA_SIN_DATO, OFERTA_V1, OFERTA_V2_PLUS, ofertaActual } from '@/hooks/__tests__/planOfferFixtures'

vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  ofertaActual.valor = OFERTA_V1
})

describe('VenueTierBadge con la oferta vigente', () => {
  it('v2 «Plus»: la insignia de Pro dice «Plus»', () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    render(<VenueTierBadge tier="PRO" />)
    expect(screen.getByText('Plus')).toBeInTheDocument()
  })
  it('con la v1 y sin dato, el nombre localizado de hoy', () => {
    const { rerender } = render(<VenueTierBadge tier="PRO" />)
    expect(screen.getByText('venuesSwitcher.tier.pro')).toBeInTheDocument()
    ofertaActual.valor = OFERTA_SIN_DATO
    rerender(<VenueTierBadge tier="PRO" />)
    expect(screen.getByText('venuesSwitcher.tier.pro')).toBeInTheDocument()
  })
})
