// Tarjetas de regalo (fase 1a): la entrada de «Clientes». Se finge sólo lo que está fuera del menú (sesión, permisos, plan,
// marca blanca y los componentes que pintan); `AppSidebar` y sus listas son los de verdad. Textos reales de es/sidebar.json.
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
const clientes = () => {
  render(<AppSidebar user={usuario as never} />)
  return m.captured!.subSidebarSections.customers ?? []
}

beforeEach(() => {
  m.captured = null
  m.denied = ''
  m.whiteLabel = false
  m.planCompleto = true
})

describe('Menú «Clientes» — Tarjetas de regalo', () => {
  it('aparece con su texto, su permiso de lectura y el código de plan para la insignia', () => {
    const e = clientes().find(i => i.url === 'gift-cards')!
    expect(e.title).toBe('Tarjetas de regalo')
    expect(e.permission).toBe('giftCards:read')
    expect(e.gatedFeature).toBe('GIFT_CARDS')
    expect(e.premiumLocked).toBe(false)
    expect(e.keywords).toContain('regalo')
  })

  it('sin el plan sigue a la vista con la insignia (ver saldos nunca se esconde; la página decide el cartel)', () => {
    m.planCompleto = false
    const e = clientes().find(i => i.url === 'gift-cards')!
    expect(e.premiumLocked).toBe(true)
  })

  it('sin giftCards:read no aparece', () => {
    m.denied = 'giftCards:read'
    expect(clientes().map(i => i.url)).not.toContain('gift-cards')
  })

  it('en una sede de marca blanca no aparece (fase 1a)', () => {
    m.whiteLabel = true
    expect(clientes().map(i => i.url)).not.toContain('gift-cards')
  })
})
