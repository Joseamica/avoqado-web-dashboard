/**
 * El regreso de Google cuando la persona venía de CREAR su cuenta (no de iniciar sesión).
 *
 * 🔴 Lo que se protege: el callback manda el intento guardado en `/signup` (campaña, UTM, versión
 * legal) — sin él la persona pierde su oferta —, registra la conversión con método `google` y la
 * lleva al asistente. Sin intento, el callback es el de siempre.
 */
import { StrictMode } from 'react'
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
import { guardarIntentoDeAltaGoogle, GOOGLE_SIGNUP_INTENT_KEY, reiniciarCanjesParaPruebas } from '@/lib/googleSignupIntent'

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
  reiniciarCanjesParaPruebas()
})

describe('GoogleOAuthCallback — alta', () => {
  it('🔴 manda el intento del alta, registra la conversión y lleva al asistente', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1', launchCampaignCode: 'POS22MX', utm: { utm_source: 'google' } })
    googleOAuthCallback.mockResolvedValue({ isNewUser: true, businessCreated: true })

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

  it('🔴 con intento pero la cuenta nació de una INVITACIÓN: no es alta, no cuenta conversión ni va al asistente', async () => {
    // `isNewUser` también es true al aceptar una invitación. Antes eso bastaba para contar la
    // conversión del anuncio (Google y ChatGPT) y mandar al empleado a configurar un negocio ajeno.
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1', launchCampaignCode: 'POS22MX' })
    googleOAuthCallback.mockResolvedValue({ isNewUser: true, businessCreated: false })
    render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(trackSignup).not.toHaveBeenCalled()
  })

  it('un servidor que no manda `businessCreated` nunca se lee como alta', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' })
    googleOAuthCallback.mockResolvedValue({ isNewUser: true })
    render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(trackSignup).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalledWith('/setup', expect.anything())
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

/**
 * 🔴 Encontrado en navegador real (24-sep): la pantalla llamaba al callback CUATRO veces con el mismo
 * code — StrictMode repite el efecto y además se re-ejecutaba al cambiar `t`/`toast`. La primera llevaba
 * el alta; las demás, sólo el code (el intento ya se había consumido) ⇒ en producción el code de Google,
 * que es de UN solo uso, fallaba en la segunda y disparaba el error encima del alta buena.
 */
describe('GoogleOAuthCallback — se procesa UNA vez', () => {
  it('🔴 montada como en la app (StrictMode), llama al servidor una sola vez y con el alta', async () => {
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1', launchCampaignCode: 'POS22MX' })
    googleOAuthCallback.mockResolvedValue({ isNewUser: true, businessCreated: true })
    render(
      <StrictMode>
        <GoogleOAuthCallback />
      </StrictMode>,
    )
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/setup', { replace: true }))
    await new Promise(r => setTimeout(r, 50))
    expect(googleOAuthCallback).toHaveBeenCalledTimes(1)
    expect(googleOAuthCallback).toHaveBeenCalledWith('c-1', { legalVersion: 'v1', launchCampaignCode: 'POS22MX' })
  })

  it('🔴 si la pantalla se MONTA dos veces (el enrutador la remonta al cargar la sesión), el code se canjea una vez', async () => {
    params = new URLSearchParams('code=c-remontada')
    guardarIntentoDeAltaGoogle({ legalVersion: 'v1' })
    googleOAuthCallback.mockResolvedValue({ isNewUser: true, businessCreated: true })
    const primera = render(<GoogleOAuthCallback />)
    primera.unmount()
    render(<GoogleOAuthCallback />)
    await new Promise(r => setTimeout(r, 50))
    expect(googleOAuthCallback).toHaveBeenCalledTimes(1)
    expect(googleOAuthCallback).toHaveBeenCalledWith('c-remontada', { legalVersion: 'v1' })
  })

  it('un re-render con otra función de traducción no vuelve a canjear el code', async () => {
    googleOAuthCallback.mockResolvedValue({ isNewUser: false })
    const { rerender } = render(<GoogleOAuthCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    rerender(<GoogleOAuthCallback />)
    await new Promise(r => setTimeout(r, 50))
    expect(googleOAuthCallback).toHaveBeenCalledTimes(1)
  })
})
