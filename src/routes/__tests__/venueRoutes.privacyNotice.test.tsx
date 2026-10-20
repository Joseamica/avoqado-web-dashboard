import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useRoutes, type RouteObject } from 'react-router-dom'
import { createVenueRoutes } from '@/routes/venueRoutes'
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

const m = vi.hoisted(() => ({ denied: '' as string }))

// Sólo se finge lo que está fuera de la guardia: el permiso y la página (para no cargar el módulo entero).
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => p !== m.denied, canAny: () => true, canAll: () => true, isLoading: false, role: 'ADMIN' }),
}))
vi.mock('react-i18next', async importOriginal => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('@/pages/Venue/Edit/PrivacyNotice', () => ({ default: () => <p>PAGINA_AVISO</p> }))

/** settings → local (ADMIN) → VenueEditLayout → privacy */
const aviso = () =>
  createVenueRoutes()
    .find(x => x.path === 'settings')!
    .children!.find(x => x.path === 'local')!
    .children![0].children!.find(x => x.path === 'privacy')!

const guarda = (r: RouteObject) => r.element as { type: unknown; props: { permission?: string } }

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

describe('ruta settings/local/privacy (la casa del aviso de privacidad)', () => {
  it('existe dentro de la configuración del negocio y la protege marketing:manage, el permiso con el que se edita el aviso', () => {
    const r = aviso()
    expect(r).toBeDefined()
    expect(guarda(r).type).toBe(PermissionProtectedRoute)
    expect(guarda(r).props.permission).toBe('marketing:manage')
    expect(r.children?.[0]?.index).toBe(true)
  })

  it('con marketing:manage monta la página del aviso', async () => {
    pintar('/privacy', [aviso()])
    expect(await screen.findByText('PAGINA_AVISO')).toBeInTheDocument()
  })

  it('sin marketing:manage no monta la página', async () => {
    m.denied = 'marketing:manage'
    pintar('/privacy', [aviso()])
    expect(await screen.findByText('routeProtection.accessDenied')).toBeInTheDocument()
    expect(screen.queryByText('PAGINA_AVISO')).not.toBeInTheDocument()
  })
})
