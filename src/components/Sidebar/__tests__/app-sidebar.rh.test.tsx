// RH fase 1a · Tarea 9: el grupo «Equipo» del menú pasa a ser «RH» (Personas · Puestos · Asistencia y turnos · Comisiones ·
// Pago al personal), va después de lo del día a día y antes de lo administrativo, y «Turnos» de caja (que no es RH) se muda al
// grupo de Ventas. Se finge sólo lo que está fuera del menú (sesión, permisos, plan, marca blanca y los componentes que pintan);
// `AppSidebar` y sus listas son los de verdad. Los textos son los reales de es/rh.json y es/sidebar.json.
import { cleanup, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigate, type RouteObject } from 'react-router-dom'
import { createVenueRoutes } from '@/routes/venueRoutes'
import { NotWhiteLabelRoute } from '@/routes/NotWhiteLabelRoute'
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'
import { AppSidebar } from '../app-sidebar'

type Item = { title: string; url: string; subSidebar?: string; permission?: string; premiumLocked?: boolean; gatedFeature?: string; keywords?: string[] }

const m = vi.hoisted(() => ({
  captured: null as null | { items: Item[]; subSidebarSections: Record<string, Item[]> },
  denied: '' as string, // permiso que NO se tiene
  enableShifts: true,
  whiteLabel: false,
  wlSinFeature: '' as string, // feature de marca blanca apagada
  planCompleto: true, // hasFeatureAccess
}))

// Un traductor estable (el menú lo usa en las dependencias de su useMemo) que entiende `espacio:llave` y cae al defaultValue.
vi.mock('react-i18next', async () => {
  const [rh, sidebar] = (await Promise.all([import('@/locales/es/rh.json'), import('@/locales/es/sidebar.json')])).map(x => x.default as unknown)
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
    activeVenue: { id: 'v1', slug: 'demo', status: 'ACTIVE', kycStatus: 'VERIFIED', settings: { enableShifts: m.enableShifts } },
  }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p !== m.denied, canFeature: (c: string) => c !== m.wlSinFeature }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => ({ hasFeatureAccess: () => m.planCompleto }) }))
vi.mock('@/hooks/useWhiteLabelConfig', () => ({
  useWhiteLabelConfig: () => ({ isWhiteLabelEnabled: m.whiteLabel, navigation: [], isFeatureEnabled: (c: string) => c !== m.wlSinFeature }),
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
  const { items, subSidebarSections } = m.captured!
  return { items, secciones: subSidebarSections, rh: items.find(i => i.subSidebar === 'team')! }
}
// Un grupo que no existe NO es «antes» ni «después» de nada: si falta, la prueba truena en vez de pasar por error.
const posicion = (items: Item[], url: string) => {
  const i = items.findIndex(g => g.url === url)
  if (i < 0) throw new Error(`No hay un grupo ${url} en el menú`)
  return i
}

beforeEach(() => {
  m.captured = null
  m.denied = ''
  m.enableShifts = true
  m.whiteLabel = false
  m.wlSinFeature = ''
  m.planCompleto = true
})

describe('Menú «RH» (fase 1a)', () => {
  it('el grupo se llama «RH» y trae Personas → Puestos → Asistencia y turnos → Comisiones → Pago al personal', () => {
    const { rh, secciones } = menu()

    expect(rh.title).toBe('RH')
    expect(secciones.team.map(i => i.title)).toEqual(['Personas', 'Puestos', 'Asistencia y turnos', 'Comisiones', 'Pago al personal'])
    // Las rutas no cambian; sólo se reagrupan (y Puestos es nueva).
    expect(secciones.team.map(i => i.url)).toEqual(['team', 'rh/puestos', 'asistencia', 'commissions', 'servicio-pago'])
  })

  it('Puestos pide teams:read y no lleva candado de plan (la fase 1a es gratis), aunque el plan sea bajo', () => {
    m.planCompleto = false
    const { secciones } = menu()
    const puestos = secciones.team.find(i => i.url === 'rh/puestos')!

    expect(puestos.permission).toBe('teams:read')
    expect(puestos.premiumLocked).toBeFalsy()
    expect(puestos.gatedFeature).toBeUndefined()
  })

  it('Personas y Puestos se encuentran en la paleta de comandos escribiendo «rh»', () => {
    const { secciones } = menu()
    const personas = secciones.team.find(i => i.url === 'team')!
    const puestos = secciones.team.find(i => i.url === 'rh/puestos')!

    expect(personas.keywords).toContain('rh')
    expect(puestos.keywords).toContain('rh')
  })

  it('sin teams:read no aparece Puestos', () => {
    m.denied = 'teams:read'
    const { secciones } = menu()

    expect((secciones.team ?? []).map(i => i.url)).not.toContain('rh/puestos')
  })

  it('en una sede de marca blanca no aparece Puestos', () => {
    m.whiteLabel = true
    const { secciones } = menu()

    const urls = secciones.team.map(i => i.url)
    expect(urls).not.toContain('rh/puestos')
    expect(urls).toContain('team') // lo demás del grupo sigue como hoy
  })

  it('RH va después de lo del día a día (Inventario, Ventas, Clientes, Reportes) y antes de lo administrativo (Facturación, Contabilidad, Configuración)', () => {
    const { items, rh } = menu()
    const i = items.indexOf(rh)

    expect(i).toBeGreaterThan(posicion(items, '#inventory'))
    expect(i).toBeGreaterThan(posicion(items, '#sales'))
    expect(i).toBeGreaterThan(posicion(items, '#customers'))
    expect(i).toBeGreaterThan(posicion(items, '#reports'))
    expect(i).toBeLessThan(posicion(items, '#facturacion'))
    expect(i).toBeLessThan(posicion(items, '#contabilidad'))
    expect(i).toBeLessThan(posicion(items, 'settings'))
  })

  it('«Turnos» de caja ya no es de RH: se muda a Ventas con su permiso y su condición enableShifts', () => {
    const { secciones } = menu()
    const turnos = secciones.sales.find(i => i.url === 'shifts')!

    expect(secciones.team.map(i => i.url)).not.toContain('shifts')
    expect(turnos.title).toBe('Turnos de caja')
    expect(turnos.permission).toBe('shifts:read')
  })

  it('con enableShifts apagado «Turnos» no aparece en ningún grupo', () => {
    m.enableShifts = false
    const { secciones } = menu()

    expect(secciones.sales.map(i => i.url)).not.toContain('shifts')
    expect(secciones.team.map(i => i.url)).not.toContain('shifts')
  })

  it('en marca blanca «Turnos» sigue atado a su feature AVOQADO_SHIFTS, ahora desde Ventas', () => {
    m.whiteLabel = true
    expect(menu().secciones.sales.map(i => i.url)).toContain('shifts')

    cleanup()
    m.wlSinFeature = 'AVOQADO_SHIFTS'
    expect(menu().secciones.sales.map(i => i.url)).not.toContain('shifts')
  })
})

describe('Ruta rh/puestos (fase 1a)', () => {
  // Se buscan TODOS los bloques NotWhiteLabelRoute (hoy hay más de uno), no sólo el primero.
  const guardas = () =>
    createVenueRoutes()
      .filter(r => (r.element as { type?: unknown } | undefined)?.type === NotWhiteLabelRoute)
      .flatMap(b => (b.children ?? []) as RouteObject[])
  const guarda = () => guardas().find(g => g.children?.some(h => h.path === 'rh/puestos'))!

  it('vive dentro de NotWhiteLabelRoute y pide teams:read', () => {
    expect((guarda().element as { type: unknown }).type).toBe(PermissionProtectedRoute)
    expect((guarda().element as { props: { permission: string } }).props.permission).toBe('teams:read')
  })

  it('/rh (la miga «RH») redirige a Puestos, bajo la MISMA guarda que la página', () => {
    const redireccion = guarda().children!.find(h => h.path === 'rh')!
    const el = redireccion.element as { type: unknown; props: { to: string; replace: boolean } }

    expect(el.type).toBe(Navigate)
    expect(el.props.to).toBe('puestos')
    expect(el.props.replace).toBe(true)
  })
})
