import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useRoutes, type RouteObject } from 'react-router-dom'
import { createVenueRoutes } from '@/routes/venueRoutes'
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

const m = vi.hoisted(() => ({ denied: '' as string }))

// Sólo se finge lo que está fuera de la guardia: el permiso y las dos páginas (para no cargar el módulo entero).
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => p !== m.denied, canAny: () => true, canAll: () => true, isLoading: false, role: 'MANAGER' }),
}))
vi.mock('react-i18next', async importOriginal => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('@/pages/GiftCards/GiftCardsPage', () => ({ default: () => <p>PAGINA_TARJETAS</p> }))
vi.mock('@/pages/Settings/GiftCardSettings', () => ({ default: () => <p>AJUSTES_TARJETAS</p> }))

const guarda = (r: RouteObject) => r.element as { type: unknown; props: { permission?: string } }
const tarjetas = () => createVenueRoutes().find(x => x.path === 'gift-cards')!
const ajustes = () =>
  createVenueRoutes()
    .find(x => x.path === 'settings')!
    .children!.find(x => x.path === 'gift-cards')!

function Arbol({ routes }: { routes: RouteObject[] }) {
  return useRoutes(routes)
}
function pintar(url: string, routes: RouteObject[]) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Suspense fallback={null}>
        <Arbol routes={routes} />
      </Suspense>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  m.denied = ''
})

describe('rutas de tarjetas de regalo', () => {
  it('/gift-cards: la protege giftCards:read (el plan se decide DENTRO de la página, R9 y T3)', () => {
    const r = tarjetas()
    expect(guarda(r).type).toBe(PermissionProtectedRoute)
    expect(guarda(r).props.permission).toBe('giftCards:read')
    expect(r.children?.[0]?.index).toBe(true)
  })

  it('/settings/gift-cards: también giftCards:read (sin manage se ve en sólo lectura)', () => {
    const r = ajustes()
    expect(guarda(r).type).toBe(PermissionProtectedRoute)
    expect(guarda(r).props.permission).toBe('giftCards:read')
  })

  // Nota 16 del coordinador: sin giftCards:read las consultas del módulo se apagan y la página caería en «no se pudo
  // cargar»; la guardia muestra «sin acceso» (como sus vecinas) y nunca monta la página.
  it('con giftCards:read, /gift-cards monta la lista', async () => {
    pintar('/gift-cards', [tarjetas()])
    expect(await screen.findByText('PAGINA_TARJETAS')).toBeInTheDocument()
  })

  it('sin giftCards:read, /gift-cards no monta la página', async () => {
    m.denied = 'giftCards:read'
    pintar('/gift-cards', [tarjetas()])
    expect(await screen.findByText('routeProtection.accessDenied')).toBeInTheDocument()
    expect(screen.queryByText('PAGINA_TARJETAS')).not.toBeInTheDocument()
  })

  it('sin giftCards:read, /settings/gift-cards tampoco monta la configuración', async () => {
    m.denied = 'giftCards:read'
    pintar('/settings/gift-cards', [{ path: 'settings', children: [ajustes()] }])
    expect(await screen.findByText('routeProtection.accessDenied')).toBeInTheDocument()
    expect(screen.queryByText('AJUSTES_TARJETAS')).not.toBeInTheDocument()
  })

  it('con giftCards:read, /settings/gift-cards monta la configuración', async () => {
    pintar('/settings/gift-cards', [{ path: 'settings', children: [ajustes()] }])
    expect(await screen.findByText('AJUSTES_TARJETAS')).toBeInTheDocument()
  })
})
