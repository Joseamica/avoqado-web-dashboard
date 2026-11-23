// Máquina de efectivo (fase 1a): «Cobros de la máquina en duda» sólo sale en Ventas si el negocio tiene dudas abiertas (el `total`
// de la lista con limit=1). Un negocio sin máquina no la ve; la ruta sigue por URL. `AppSidebar`, sus listas y TanStack Query son los
// de verdad; se finge la sesión, los permisos, el plan, la marca blanca, la API y lo que pinta. Textos reales de es/sidebar.json.
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from '../app-sidebar'

type Item = { title: string; url: string; permission?: string; keywords?: string[] }

const m = vi.hoisted(() => ({
  captured: null as null | { items: Item[]; subSidebarSections: Record<string, Item[]> },
  denied: '' as string,
  get: (..._a: unknown[]): Promise<unknown> => Promise.resolve({ data: { data: [], total: 0, nextCursor: null } }),
  calls: [] as unknown[][],
}))

vi.mock('react-i18next', async () => {
  const sidebar = (await import('@/locales/es/sidebar.json')).default as unknown
  const bundles: Record<string, unknown> = { sidebar }
  const buscar = (b: unknown, k: string) => k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown> | undefined)?.[p], b)
  const t = (k: string, o?: Record<string, unknown>) => {
    const [ns, ruta] = k.includes(':') ? k.split(':') : ['common', k]
    const v = buscar(bundles[ns], ruta)
    return typeof v === 'string' ? v : String(o?.defaultValue ?? k)
  }
  const resultado = { t, i18n: { language: 'es' } }
  return { useTranslation: () => resultado }
})
vi.mock('@/api', () => ({
  default: {
    get: (...a: unknown[]) => {
      m.calls.push(a)
      return m.get(...a)
    },
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    allVenues: [],
    checkModuleAccess: () => false,
    staffInfo: { role: 'MANAGER' },
    activeVenue: { id: 'v1', slug: 'demo', status: 'ACTIVE', kycStatus: 'VERIFIED', settings: { enableShifts: true } },
  }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p !== m.denied, canFeature: () => true }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => true }) }))
vi.mock('@/hooks/useWhiteLabelConfig', () => ({
  useWhiteLabelConfig: () => ({ isWhiteLabelEnabled: false, navigation: [], isFeatureEnabled: () => true }),
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

const usuario = { role: 'MANAGER', firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com', photoUrl: '', venues: [] }
const MENU_KEY = ['cash-machine-doubts', 'v1', 'menu']

function pintar() {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <AppSidebar user={usuario as never} />
    </QueryClientProvider>,
  )
  return client
}
const ventas = () => (m.captured!.subSidebarSections.sales ?? []).map(i => i.url)

beforeEach(() => {
  m.captured = null
  m.denied = ''
  m.calls.length = 0
  m.get = () => Promise.resolve({ data: { data: [], total: 0, nextCursor: null } })
})

describe('Menú «Ventas» — Cobros de la máquina en duda', () => {
  it('pregunta sólo el total de las dudas ABIERTAS (limit=1), no la lista', async () => {
    const client = pintar()
    await waitFor(() => expect(client.getQueryState(MENU_KEY)?.status).toBe('success'))
    expect(m.calls).toEqual([['/api/v1/dashboard/venues/v1/cash-machine/doubts', { params: { status: 'ABIERTO', limit: 1 } }]])
    const opciones = client.getQueryCache().find({ queryKey: MENU_KEY })?.options as { staleTime?: number } | undefined
    expect(opciones?.staleTime).toBeGreaterThanOrEqual(5 * 60_000)
  })

  it('con total 0 (un negocio sin máquina o sin dudas) no aparece', async () => {
    const client = pintar()
    await waitFor(() => expect(client.getQueryState(MENU_KEY)?.status).toBe('success'))
    expect(ventas()).not.toContain('cash-machine-doubts')
    expect(ventas()).toContain('shifts')
  })

  it('con dudas abiertas aparece, con su texto y su permiso exacto', async () => {
    m.get = () => Promise.resolve({ data: { data: [{ id: 'inc1' }], total: 3, nextCursor: null } })
    pintar()
    await waitFor(() => expect(ventas()).toContain('cash-machine-doubts'))
    const e = m.captured!.subSidebarSections.sales.find(i => i.url === 'cash-machine-doubts')!
    expect(e.title).toBe('Cobros de la máquina en duda')
    expect(e.permission).toBe('cash-machine:resolve')
  })

  it('si la consulta falla, no aparece (no adivina)', async () => {
    m.get = () => Promise.reject(new Error('500'))
    const client = pintar()
    await waitFor(() => expect(client.getQueryState(MENU_KEY)?.status).toBe('error'))
    expect(ventas()).not.toContain('cash-machine-doubts')
  })

  it('sin cash-machine:resolve ni pregunta ni aparece', async () => {
    m.denied = 'cash-machine:resolve'
    m.get = () => Promise.resolve({ data: { data: [], total: 3, nextCursor: null } })
    pintar()
    await new Promise(r => setTimeout(r, 0))
    expect(m.calls).toHaveLength(0)
    expect(ventas()).not.toContain('cash-machine-doubts')
  })
})
