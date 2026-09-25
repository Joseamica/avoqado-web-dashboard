/**
 * Codex ronda 7, P3: un intento de alta con Google abandonado (se fue a /signup, dio «atrás») vivía 30 min
 * en sessionStorage; el login NORMAL con Google lo arrastraba y el callback mostraba «Ya tenías una
 * cuenta…» a quien sólo quería entrar. Iniciar sesión con Google lo descarta antes de salir a Google.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

const loginWithGoogle = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), loginWithGoogle, isLoading: false, loginError: null, clearLoginError: vi.fn() }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))

import { UserAuthForm } from '../UserAuthForm'
import { GOOGLE_SIGNUP_INTENT_KEY, guardarIntentoDeAltaGoogle } from '@/lib/googleSignupIntent'

beforeEach(() => {
  sessionStorage.clear()
  loginWithGoogle.mockReset().mockResolvedValue(undefined)
})

it('🔴 «Iniciar sesión con Google» descarta un intento de alta abandonado antes de ir a Google', async () => {
  guardarIntentoDeAltaGoogle({ legalVersion: 'v1', launchCampaignCode: 'POS22MX' })
  expect(sessionStorage.getItem(GOOGLE_SIGNUP_INTENT_KEY)).not.toBeNull()

  render(
    <MemoryRouter>
      <UserAuthForm />
    </MemoryRouter>,
  )
  const boton = screen.getAllByRole('button').find(b => /google/i.test(b.textContent ?? ''))!
  fireEvent.click(boton)

  await waitFor(() => expect(loginWithGoogle).toHaveBeenCalled())
  expect(sessionStorage.getItem(GOOGLE_SIGNUP_INTENT_KEY)).toBeNull()
})
