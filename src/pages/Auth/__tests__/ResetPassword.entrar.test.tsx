/**
 * D10 (28-oct): «Crear contraseña y entrar» tiene que ENTRAR. Quien vuelve desde el correo de la landing
 * creaba su contraseña y la pantalla lo mandaba a /login a teclear otra vez correo y contraseña.
 *
 * 🔴 Lo que se protege:
 *  - con `entrarUrl` del MISMO origen se navega a esa liga (la canjea /auth/entrar) y NO a /login;
 *  - una `entrarUrl` de otro origen se ignora: nunca se manda a nadie fuera del dashboard;
 *  - sin `entrarUrl` (restablecer de siempre, o servidor viejo) todo sigue igual;
 *  - la `?oferta=`/UTMs de la liga del correo no se pierden al llegar.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resetPassword = vi.fn()
const navigate = vi.fn()

vi.mock('@/services/auth.service', () => ({
  validateResetToken: () => Promise.resolve({ valid: true, email: 'a@test.mx', isNewAccount: true }),
  resetPassword: (...a: unknown[]) => resetPassword(...a),
}))
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn() }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/language-switcher', () => ({ default: () => null }))
vi.mock('react-i18next', () => {
  const t = (k: string) => k
  const translation = { t, i18n: { language: 'es' } }
  return { useTranslation: () => translation }
})

import ResetPassword from '../ResetPassword'
import { leerAtribucion, limpiarAtribucion } from '@/lib/acquisition'

const assign = vi.fn()

function pintar(search = '') {
  vi.stubGlobal('location', { ...window.location, search, assign })
  return render(
    <MemoryRouter initialEntries={['/auth/reset-password/tok']}>
      <Routes>
        <Route path="/auth/reset-password/:token" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function crearContrasena() {
  const nueva = await screen.findByLabelText('resetPassword.newPasswordLabel')
  fireEvent.change(nueva, { target: { value: 'unaClave8' } })
  fireEvent.change(screen.getByLabelText('resetPassword.confirmPasswordLabel'), { target: { value: 'unaClave8' } })
  const boton = screen.getByRole('button', { name: 'resetPassword.createButton' })
  await waitFor(() => expect(boton).toBeEnabled())
  fireEvent.click(boton)
  await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('tok', 'unaClave8'))
}

describe('ResetPassword — crear contraseña y entrar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    resetPassword.mockReset()
    navigate.mockReset()
    assign.mockReset()
    limpiarAtribucion()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('🔴 con entrarUrl del mismo origen entra directo: navega a esa liga y NO a /login', async () => {
    const entrarUrl = `${window.location.origin}/auth/entrar#boleto=firmado`
    resetPassword.mockResolvedValue({ success: true, message: 'ok', entrarUrl })
    pintar()
    await crearContrasena()

    await waitFor(() => expect(assign).toHaveBeenCalledWith(entrarUrl))
    vi.advanceTimersByTime(5000)
    expect(navigate).not.toHaveBeenCalledWith('/login')
  })

  it('🔴 una entrarUrl de OTRO origen se ignora: se queda el camino de siempre (a /login a los 3 s)', async () => {
    resetPassword.mockResolvedValue({ success: true, message: 'ok', entrarUrl: 'https://evil.example/auth/entrar#boleto=x' })
    pintar()
    await crearContrasena()

    await screen.findByText('resetPassword.createSuccessTitle')
    vi.advanceTimersByTime(3100)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
    expect(assign).not.toHaveBeenCalled()
  })

  it('sin entrarUrl (restablecer normal o servidor viejo) se queda el camino de siempre', async () => {
    resetPassword.mockResolvedValue({ success: true, message: 'ok' })
    pintar()
    await crearContrasena()

    await screen.findByText('resetPassword.createSuccessTitle')
    vi.advanceTimersByTime(3100)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
    expect(assign).not.toHaveBeenCalled()
  })

  it('la oferta y las UTMs de la liga del correo se guardan al llegar', async () => {
    pintar('?oferta=pos-22&utm_source=correo')
    await screen.findByLabelText('resetPassword.newPasswordLabel')
    expect(leerAtribucion()).toMatchObject({ offerParam: 'pos-22', utm: { utm_source: 'correo' } })
  })
})
