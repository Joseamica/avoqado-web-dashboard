// B4 (planes editables) · M4: las ventanas del plan leen el nombre de la oferta vigente (v2 «Plus»), no el localizado.
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTierDef } from '@/config/plan-catalog'
import { OFERTA_V1, OFERTA_V2_PLUS, ofertaActual } from '@/hooks/__tests__/planOfferFixtures'
import { PlanBenefitsDialog } from '../PlanBenefitsDialog'
import { PlanUpgradeDialog } from '../PlanUpgradeDialog'

vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { tier?: string }) => (o?.tier ? `${k}:${o.tier}` : k) }),
}))

afterEach(() => {
  ofertaActual.valor = OFERTA_V1
})

describe('ventanas del plan con la oferta vigente', () => {
  it.each([
    ['PlanUpgradeDialog', 'plan.cta.upgrade:Plus', () => <PlanUpgradeDialog tier="PRO" onClose={() => {}} />],
    [
      'PlanBenefitsDialog',
      'plan.benefits.title:Plus',
      () => <PlanBenefitsDialog tier={getTierDef('PRO')} open onOpenChange={() => {}} accentClassName="" />,
    ],
  ])('%s: con la v2 «Plus» dice Plus', (_nombre, texto, vista) => {
    ofertaActual.valor = OFERTA_V2_PLUS
    render(vista())
    expect(screen.getByText(texto)).toBeInTheDocument()
  })
})
