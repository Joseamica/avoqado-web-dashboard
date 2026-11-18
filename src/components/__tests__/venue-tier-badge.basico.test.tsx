// Plan Básico (full-testing 17-nov): el chip del negocio decía «Free» con un Básico vigente. El Básico no es un tier: lo
// dice `/plan-tier` aparte (`basicPlanActive`), y el chip lo enseña sólo donde el tier es Gratis.
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VenueTierBadgeById } from '@/components/venue-tier-badge'
import { getVenuePlanTierInfo, parseVenuePlanTierInfo } from '@/services/features.service'

vi.mock('react-i18next', async () => {
  const { default: es } = await import('@/locales/es/common.json')
  const lookup = (key: string) => key.split('.').reduce((node: any, part) => node?.[part], es)
  return { useTranslation: () => ({ t: (key: string) => lookup(key) ?? key }) }
})
vi.mock('@/services/features.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/features.service')>()),
  getVenuePlanTierInfo: vi.fn(),
}))

const renderBadge = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VenueTierBadgeById venueId="venue" />
    </QueryClientProvider>,
  )
const FREE = { tier: 'FREE', grandfathered: false, exempt: false } as const

beforeEach(() => vi.mocked(getVenuePlanTierInfo).mockReset())

describe('chip del negocio con el Plan Básico', () => {
  it('🔴 Gratis con el Básico vigente → «Básico», nunca «Free»', async () => {
    vi.mocked(getVenuePlanTierInfo).mockResolvedValue({ ...FREE, basicPlanActive: true })
    renderBadge()
    expect(await screen.findByText('Básico')).toBeInTheDocument()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
  })

  it('sin Básico → «Free» como siempre', async () => {
    vi.mocked(getVenuePlanTierInfo).mockResolvedValue({ ...FREE })
    renderBadge()
    expect(await screen.findByText('Free')).toBeInTheDocument()
  })

  it('Pro (la prueba con todo Pro) gana sobre el Básico: el chip dice el plan que da acceso', async () => {
    vi.mocked(getVenuePlanTierInfo).mockResolvedValue({ ...FREE, tier: 'PRO', basicPlanActive: true })
    renderBadge()
    expect(await screen.findByText('Pro')).toBeInTheDocument()
  })

  it('el lector conserva `basicPlanActive` (zod quitaría la llave si no la conoce)', () => {
    expect(parseVenuePlanTierInfo({ ...FREE, basicPlanActive: true }).basicPlanActive).toBe(true)
    expect(parseVenuePlanTierInfo({ ...FREE }).basicPlanActive).toBeUndefined()
  })
})
