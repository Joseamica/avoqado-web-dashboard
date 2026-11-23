// Máquina de efectivo · fase 1a · B2 (R4-4): «Cobros de la máquina en duda» sólo lo abre quien tiene `cash-machine:resolve`
// (de fábrica MANAGER, ADMIN y OWNER). Sin el permiso la página no se monta y la guardia explica que no tiene acceso.
import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useRoutes, type RouteObject } from 'react-router-dom'
import { createVenueRoutes } from '@/routes/venueRoutes'
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

const m = vi.hoisted(() => ({ denied: '' as string }))

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => p !== m.denied, canAny: () => true, canAll: () => true, isLoading: false, role: 'MANAGER' }),
}))
vi.mock('react-i18next', async importOriginal => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('@/pages/Shift/CashMachineDoubts', () => ({ default: () => <p>PAGINA_DUDAS</p> }))

const ruta = () => createVenueRoutes().find(x => x.path === 'cash-machine-doubts')!
const guarda = (r: RouteObject) => r.element as { type: unknown; props: { permission?: string } }

function Arbol({ routes }: { routes: RouteObject[] }) {
  return useRoutes(routes)
}
function pintar() {
  render(
    <MemoryRouter initialEntries={['/cash-machine-doubts']}>
      <Suspense fallback={null}>
        <Arbol routes={[ruta()]} />
      </Suspense>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  m.denied = ''
})

describe('ruta de cobros de la máquina en duda', () => {
  it('la protege cash-machine:resolve, el permiso EXACTO del servidor', () => {
    expect(guarda(ruta()).type).toBe(PermissionProtectedRoute)
    expect(guarda(ruta()).props.permission).toBe('cash-machine:resolve')
  })

  it('con el permiso, monta la página', async () => {
    pintar()
    expect(await screen.findByText('PAGINA_DUDAS')).toBeInTheDocument()
  })

  it('sin el permiso, no la monta y explica que no tiene acceso', async () => {
    m.denied = 'cash-machine:resolve'
    pintar()
    expect(await screen.findByText('routeProtection.accessDenied')).toBeInTheDocument()
    expect(screen.getByText('routeProtection.insufficientPermissions')).toBeInTheDocument()
    expect(screen.queryByText('PAGINA_DUDAS')).not.toBeInTheDocument()
  })
})
