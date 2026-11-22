import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false, logout: () => undefined }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

function LoginProbe() {
  const location = useLocation()
  return <output data-testid="returnTo">{new URLSearchParams(location.search).get('returnTo')}</output>
}

describe('ProtectedRoute — regresar a la misma dirección después de iniciar sesión', () => {
  it('conserva la ruta, los ?… y el #… (la pestaña de Configuración de Reservaciones vive en el #)', () => {
    render(
      <MemoryRouter initialEntries={['/venues/test/reservations/settings?x=1#citas']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/venues/test/reservations/settings" element={<div>ajustes</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('returnTo').textContent).toBe('/venues/test/reservations/settings?x=1#citas')
  })
})
