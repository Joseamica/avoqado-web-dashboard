/**
 * El regreso de Google cuando la persona venía de CREAR su cuenta (no de iniciar sesión).
 *
 * 🔴 Lo que se protege: el callback manda el intento guardado en `/signup` (campaña, UTM, versión
 * legal) — sin él la persona pierde su oferta —, registra la conversión con método `google` y la
 * lleva al asistente. Sin intento, el callback es el de siempre.
 */
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()
const googleOAuthCallback = vi.fn()
const trackSignup = vi.fn()
let params = new URLSearchParams('code=c-1')

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useSearchParams: () => [params] }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/spinner', () => ({ LoadingScreen: () => <div /> }))
vi.mock('@/lib/gtag', () => ({ trackSignup: (...a: unknown[]) => trackSignup(...a) }))
vi.mock('@/services/auth.service', () => ({ googleOAuthCallback: (...a: unknown[]) => googleOAuthCallback(...a) }))

import GoogleOAuthCallback from '../GoogleOAuthCallback'
import { guardarIntentoDeAltaGoogle, GOOGLE_SIGNUP_INTENT_KEY } from '@/lib/googleSignupIntent'

let datos: Map<string, string>
beforeEach(() => {
  datos = new Map()
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
      removeItem: (k: string) => void datos.delete(k),
    },
    writable: true,
    configurable: true,
  })
  navigate.mockReset()
  googleOAuthCallback.mockReset()
  trackSignup.mockReset()
  params = new URLSearchParams('code=c-1')
})

describe('GoogleOAuthCallback — alta', () => {
  it('🔴 manda el intento del alta, registra la conversión y lleva al asistente', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1', launchCampaignCode: 'POS22MX', utm: { utm_source: 'google' } })
    googleOAuthCallback.mockResolvedValue({ isNewUser: true })

    render(<GoogleOAuthCallback />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/setup', { replace: true }))
    expect(googleOAuthCallback).toHaveBeenCalledWith('c-1', {
      legalVersion: 'v1',
      launchCampaignCode: 'POS22MX',
      utm: { utm_source: 'google' },
    })
    expect(trackSignup).toHaveBeenCalledWith('google', 'POS22MX')
    // se consumió: un inicio de sesión posterior no lo reutiliza
    expect(datos.has(GOOGLE_SIGNUP_INTENT_KEY)).toBe(false)
  })

  it('sin intento es el inicio de sesión de siempre: sólo el code, sin conversión', async () => {
    googleOAuthCallback.mockResolvedValue({ isNewUser: false })
    render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(googleOAuthCallback).toHaveBeenCalledWith('c-1', undefined)
    expect(trackSignup).not.toHaveBeenCalled()
  })

  it('con intento pero la cuenta YA existía: entra normal, sin contar una conversión falsa', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' })
    googleOAuthCallback.mockResolvedValue({ isNewUser: false })
    render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(trackSignup).not.toHaveBeenCalled()
  })

  it('si falla viniendo del alta, regresa al ALTA (no al login)', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' })
    googleOAuthCallback.mockRejectedValue(new Error('boom'))
    render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/signup', { replace: true }))
  })

  it('si la persona canceló en Google viniendo del alta, también regresa al alta', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' })
    params = new URLSearchParams('error=access_denied')
    render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/signup', { replace: true }))
    expect(googleOAuthCallback).not.toHaveBeenCalled()
  })
})
