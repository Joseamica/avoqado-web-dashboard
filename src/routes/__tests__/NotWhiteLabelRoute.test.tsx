/**
 * NotWhiteLabelRoute — bloquea por CONFIGURACIÓN del venue, no por prefijo de URL.
 * Auditoría Codex de la fase 2 del checador (2026-08-26), P2-8: `/venues/<slug-PT>/asistencia`
 * abría la pantalla genérica aunque `/wl/venues/<slug-PT>/asistencia` estuviera bloqueada.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { NotWhiteLabelRoute } from '@/routes/NotWhiteLabelRoute'
import { useAccess } from '@/hooks/use-access'

vi.mock('@/hooks/use-access', () => ({ useAccess: vi.fn() }))
const mockedUseAccess = vi.mocked(useAccess)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {['/venues/:slug', '/wl/venues/:slug'].map(base => (
          <Route key={base} path={base}>
            <Route element={<NotWhiteLabelRoute />}>
              <Route path="asistencia" element={<div>pantalla-generica</div>} />
            </Route>
            <Route index element={<LocationProbe />} />
          </Route>
        ))}
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotWhiteLabelRoute', () => {
  beforeEach(() => {
    mockedUseAccess.mockReturnValue({ isWhiteLabelEnabled: false, isLoading: false } as any)
  })

  it('venue normal por /venues → muestra la pantalla', () => {
    renderAt('/venues/estetica/asistencia')
    expect(screen.getByText('pantalla-generica')).toBeInTheDocument()
  })

  it('entrada por /wl/ → manda al inicio del venue en su árbol (comportamiento previo)', () => {
    renderAt('/wl/venues/bae-portal/asistencia')
    expect(screen.queryByText('pantalla-generica')).toBeNull()
    expect(screen.getByTestId('location')).toHaveTextContent('/wl/venues/bae-portal')
  })

  it('P2-8: venue WHITE-LABEL tecleando /venues/<slug> → también bloqueado, y regresa a /wl/', () => {
    mockedUseAccess.mockReturnValue({ isWhiteLabelEnabled: true, isLoading: false } as any)
    renderAt('/venues/bae-portal/asistencia')
    expect(screen.queryByText('pantalla-generica')).toBeNull()
    expect(screen.getByTestId('location')).toHaveTextContent('/wl/venues/bae-portal')
  })

  it('mientras carga la configuración deja pasar (sin parpadeo), igual que PermissionProtectedRoute', () => {
    mockedUseAccess.mockReturnValue({ isWhiteLabelEnabled: false, isLoading: true } as any)
    renderAt('/venues/estetica/asistencia')
    expect(screen.getByText('pantalla-generica')).toBeInTheDocument()
  })
})
