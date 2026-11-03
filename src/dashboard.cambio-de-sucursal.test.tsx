import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Dashboard from './dashboard'
import { useAuth } from './context/AuthContext'
import { getLast7Days } from './utils/datetime'

// Hallazgo D3: las pantallas arman su rango inicial con la zona del negocio en un `useState(() => ...)`,
// que sólo corre al montarse, y casi todas leen la zona de `useAuth().activeVenue`. Ese `activeVenue` se
// pone al día con la URL en un efecto del layout (authorizeVenue), DESPUÉS de que la pantalla ya se montó.
// Así, al cambiar de sucursal (por el selector, «Atrás» o una liga) el rango quedaba en la zona de la
// sucursal anterior.

const datos = vi.hoisted(() => {
  const sucursales: Record<string, { id: string; slug: string; name: string; timezone: string }> = {
    centro: { id: 'v-centro', slug: 'centro', name: 'Centro', timezone: 'America/Mexico_City' },
    tijuana: { id: 'v-tijuana', slug: 'tijuana', name: 'Tijuana', timezone: 'America/Tijuana' },
  }
  // activeVenue vive fuera de React, como el estado del AuthContext real, y sólo cambia con authorizeVenue.
  let activa = 'centro'
  const oyentes = new Set<() => void>()
  return {
    sucursales,
    leer: () => activa,
    suscribir: (oyente: () => void) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    activar: (slug: string) => {
      activa = slug
      oyentes.forEach(oyente => oyente())
    },
  }
})

vi.mock('./context/AuthContext', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useAuth: () => {
      const activa = useSyncExternalStore(datos.suscribir, datos.leer)
      return {
        user: null,
        allVenues: [],
        activeVenue: datos.sucursales[activa],
        // Igual que el real: pone activeVenue en la sucursal pedida si es otra.
        authorizeVenue: (slug: string) => {
          if (datos.leer() !== slug) datos.activar(slug)
          return true
        },
      }
    },
  }
})

// La sucursal sale de la URL, como en el hook real.
vi.mock('./hooks/use-current-venue', () => ({
  useCurrentVenue: () => {
    const { slug = '' } = useParams()
    return {
      venue: datos.sucursales[slug] ?? null,
      venueSlug: slug,
      fullBasePath: `/venues/${slug}`,
      isLoading: false,
      hasVenueAccess: true,
    }
  },
}))

vi.mock('./hooks/useInventoryWelcomeTour', () => ({ useInventoryWelcomeTourOrchestrator: () => {} }))
vi.mock('./hooks/useAutoLaunchPlatformWelcomeTour', () => ({ useAutoLaunchPlatformWelcomeTour: () => {} }))
vi.mock('./hooks/useHomeChecklistAutoMark', () => ({ useHomeChecklistAutoMark: () => {} }))
vi.mock('./hooks/useTourProgressSync', () => ({ useTourProgressSync: () => {} }))
vi.mock('./hooks/useDemoTour', () => ({ useDemoTour: () => {} }))
vi.mock('./hooks/useAtomicTourListener', () => ({
  consumeAtomicTourReturnPath: () => null,
  usePeekAtomicTourCompletion: () => {},
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

// Lo que rodea al contenido no importa aquí.
vi.mock('./components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => null,
}))
vi.mock('./components/Sidebar/app-sidebar', () => ({ AppSidebar: () => null }))
vi.mock('./components/Sidebar/DashboardCommandPalette', () => ({ default: () => null }))
vi.mock('./components/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('./components/DemoBanner', () => ({ DemoBanner: () => null }))
vi.mock('./components/TrialStatusBanner', () => ({ TrialStatusBanner: () => null }))
vi.mock('./components/PaymentSetupAlert', () => ({ PaymentSetupAlert: () => null }))
vi.mock('./components/notifications/NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('./components/announcements/AnnouncementGate', () => ({ AnnouncementGate: () => null }))
vi.mock('./components/language-switcher', () => ({ default: () => null }))
vi.mock('./components/impersonation/ImpersonationHeaderButton', () => ({ ImpersonationHeaderButton: () => null }))
vi.mock('./components/impersonation/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('./components/impersonation/ImpersonationShortcut', () => ({ ImpersonationShortcut: () => null }))
vi.mock('./components/impersonation/ImpersonationScreenRing', () => ({ ImpersonationScreenRing: () => null }))
vi.mock('./components/impersonation/ImpersonationErrorListener', () => ({ ImpersonationErrorListener: () => null }))
vi.mock('./api', () => ({ default: {} }))

/** Igual que Pedidos o Pagos: el rango inicial se calcula una sola vez, al montarse, con la zona de activeVenue. */
function PantallaConRango() {
  const { activeVenue } = useAuth()
  const [rango] = useState(() => getLast7Days(activeVenue!.timezone))
  return <p data-testid="fin-del-rango">{rango.to.toISOString()}</p>
}

const finDelDia = (zona: string) => DateTime.now().setZone(zona).endOf('day').toJSDate().toISOString()

describe('Dashboard: cambiar de sucursal sin salir de la pantalla', () => {
  it('la pantalla se vuelve a montar con la zona de la sucursal nueva, y al regresar con la de la anterior', async () => {
    const router = createMemoryRouter(
      [{ path: '/venues/:slug', element: <Dashboard />, children: [{ path: 'orders', element: <PantallaConRango /> }] }],
      { initialEntries: ['/venues/centro/orders'] },
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('fin-del-rango')).toHaveTextContent(finDelDia('America/Mexico_City'))

    await act(() => router.navigate('/venues/tijuana/orders'))

    expect(screen.getByTestId('fin-del-rango')).toHaveTextContent(finDelDia('America/Tijuana'))

    // «Atrás» del navegador: misma pantalla, otra vez la sucursal de CDMX.
    await act(() => router.navigate(-1))

    expect(screen.getByTestId('fin-del-rango')).toHaveTextContent(finDelDia('America/Mexico_City'))
  })
})
