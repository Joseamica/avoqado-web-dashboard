// «Bancos» (banca en vivo, transferencias y SPEI) es legacy (founder, 11-nov-2026) y se esconde del menú para todos
// (D35, 15-nov). Mismo arnés que app-sidebar.giftCards.test.tsx: sólo se finge lo de fuera del menú; las rutas siguen
// para quien llegue por la liga.
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from '../app-sidebar'

type Item = {
  title: string
  url: string
  subSidebar?: string
  permission?: string
  premiumLocked?: boolean
  gatedFeature?: string
  keywords?: string[]
}

const m = vi.hoisted(() => ({
  captured: null as null | { items: Item[]; subSidebarSections: Record<string, Item[]> },
  denied: '' as string,
  whiteLabel: false,
  planCompleto: true,
}))

vi.mock('react-i18next', async () => {
  const [rh, sidebar] = (await Promise.all([import('@/locales/es/rh.json'), import('@/locales/es/sidebar.json')])).map(
    x => x.default as unknown,
  )
  const bundles: Record<string, unknown> = { rh, sidebar }
  const buscar = (b: unknown, k: string) => k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown> | undefined)?.[p], b)
  const t = (k: string, o?: Record<string, unknown>) => {
    const [ns, ruta] = k.includes(':') ? k.split(':') : ['common', k]
    const v = buscar(bundles[ns], ruta)
    return typeof v === 'string' ? v : String(o?.defaultValue ?? k)
  }
  const resultado = { t, i18n: { language: 'es' } }
  return { useTranslation: () => resultado }
})
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }))
vi.mock('@/api', () => ({ default: {} }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    allVenues: [],
    checkModuleAccess: () => false,
    staffInfo: { role: 'OWNER' },
    activeVenue: { id: 'v1', slug: 'demo', status: 'ACTIVE', kycStatus: 'VERIFIED', settings: { enableShifts: true } },
  }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p !== m.denied, canFeature: () => true }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => m.planCompleto }) }))
vi.mock('@/hooks/useWhiteLabelConfig', () => ({
  useWhiteLabelConfig: () => ({ isWhiteLabelEnabled: m.whiteLabel, navigation: [], isFeatureEnabled: () => true }),
  getFeatureRoute: (c: string) => c,
}))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (k: string) => k }) }))
vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  SidebarContent: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  SidebarFooter: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  SidebarHeader: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  SidebarRail: () => null,
  useSidebar: () => ({ state: 'expanded', isMobile: false }),
}))
vi.mock('@/components/Sidebar/nav-main', () => ({
  NavMain: (props: { items: Item[]; subSidebarSections: Record<string, Item[]> }) => {
    m.captured = props
    return null
  },
}))
vi.mock('@/components/Sidebar/nav-user', () => ({ NavUser: () => null }))
vi.mock('@/components/Sidebar/venues-switcher', () => ({ VenuesSwitcher: () => null }))
vi.mock('@/components/Sidebar/AcceptPaymentTrigger', () => ({ AcceptPaymentTrigger: () => null }))

const usuario = { role: 'OWNER', firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com', photoUrl: '', venues: [] }
const menu = () => {
  render(<AppSidebar user={usuario as never} />)
  return m.captured!
}

beforeEach(() => {
  m.captured = null
  m.denied = ''
  m.whiteLabel = false
  m.planCompleto = true
})

describe('Menú «Bancos» (legacy) — no aparece para nadie', () => {
  it('un dueño con plan completo y permiso no lo ve en el menú ni en el buscador', () => {
    const { items, subSidebarSections } = menu()
    expect(items.map(i => i.subSidebar)).not.toContain('bancos')
    expect(subSidebarSections.bancos).toBeUndefined()
    expect(Object.values(subSidebarSections).flat().map(i => i.url)).not.toContain('bancos/spei')
  })

  it('sin el plan tampoco sale como anzuelo para subir de plan', () => {
    m.planCompleto = false
    expect(menu().items.map(i => i.subSidebar)).not.toContain('bancos')
  })

  it('«Contabilidad → Bancos y cajas» (conciliación) sigue en su lugar', () => {
    expect(Object.values(menu().subSidebarSections).flat().map(i => i.url)).toContain('contabilidad/bancos')
  })
})
