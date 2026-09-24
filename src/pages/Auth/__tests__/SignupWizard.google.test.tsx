/**
 * «Continuar con Google» en el alta (founder, 24-sep).
 *
 * 🔴 Lo que se protege: el botón exige la MISMA casilla de consentimiento que el alta por correo,
 * y ANTES de salir a Google deja guardado el intento con la versión legal, la campaña resuelta y
 * los UTM — que es lo único que hace que quien llegó de un anuncio conserve su oferta.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signup = vi.fn()
const loginWithGoogle = vi.fn()
const resolveLaunchCampaignCode = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ signup, loginWithGoogle, isLoading: false }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: vi.fn() }) }))
vi.mock('@/lib/gtag', () => ({ trackSignup: vi.fn() }))
vi.mock('@/services/launchOffer.service', () => ({
  resolveLaunchCampaignCode: (...a: unknown[]) => resolveLaunchCampaignCode(...a),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (typeof o?.defaultValue === 'string' ? o.defaultValue : k) }),
  Trans: ({ defaults }: { defaults?: string }) => <span>{defaults ?? ''}</span>,
}))
vi.mock('@/components/layouts/SetupWizardLayout', () => ({
  SetupWizardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import SignupWizard from '../SignupWizard'
import { ACQUISITION_STORAGE_KEY } from '@/lib/acquisition'
import { GOOGLE_SIGNUP_INTENT_KEY } from '@/lib/googleSignupIntent'
import { LEGAL_DOCS_VERSION } from '@/config/legal'

let datos: Map<string, string>
function sembrar(offerParam: string | null, utm: Record<string, string> = {}) {
  datos = new Map<string, string>()
  if (offerParam || Object.keys(utm).length) {
    datos.set(ACQUISITION_STORAGE_KEY, JSON.stringify({ offerParam, utm, savedAt: new Date().toISOString() }))
  }
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
      removeItem: (k: string) => void datos.delete(k),
    },
    writable: true,
    configurable: true,
  })
}

const botonGoogle = () => screen.getByRole('button', { name: /google/i })

describe('SignupWizard — alta con Google', () => {
  beforeEach(() => {
    signup.mockReset()
    loginWithGoogle.mockReset().mockResolvedValue(undefined)
    resolveLaunchCampaignCode.mockReset().mockResolvedValue(null)
    sembrar(null)
  })

  it('ofrece crear la cuenta con Google', () => {
    render(<SignupWizard />)
    expect(botonGoogle()).toBeInTheDocument()
  })

  it('🔴 sin la casilla de consentimiento NO sale a Google', async () => {
    render(<SignupWizard />)
    await userEvent.setup().click(botonGoogle())
    await waitFor(() => expect(screen.getByText(/acepta|accept/i)).toBeInTheDocument())
    expect(loginWithGoogle).not.toHaveBeenCalled()
    expect(datos.has(GOOGLE_SIGNUP_INTENT_KEY)).toBe(false)
  })

  it('🔴 con la casilla, guarda el intento (versión legal + campaña + UTM) ANTES de ir a Google', async () => {
    sembrar('pos-22-mx', { utm_source: 'google', gclid: 'abc' })
    resolveLaunchCampaignCode.mockResolvedValue('POS22MX')
    // Se FOTOGRAFÍA lo guardado en el instante de la redirección y se compara afuera: un `expect`
    // dentro del mock lanzaría dentro del componente, cuyo `catch` se lo tragaría (el sabotaje
    // «no guardar el intento» pasaba verde por eso).
    let enLaRedireccion: string | undefined
    loginWithGoogle.mockImplementation(async () => {
      enLaRedireccion = datos.get(GOOGLE_SIGNUP_INTENT_KEY)
    })
    render(<SignupWizard />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.click(botonGoogle())

    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledTimes(1))
    expect(enLaRedireccion).toBeDefined()
    expect(JSON.parse(enLaRedireccion!)).toMatchObject({
      legalVersion: LEGAL_DOCS_VERSION,
      launchCampaignCode: 'POS22MX',
      utm: { utm_source: 'google', gclid: 'abc' },
    })
    expect(resolveLaunchCampaignCode).toHaveBeenCalledWith('pos-22-mx')
    expect(signup).not.toHaveBeenCalled()
  })

  it('una oferta que no resuelve deja un alta con Google NORMAL, sin campaña', async () => {
    sembrar('caducada')
    resolveLaunchCampaignCode.mockRejectedValue(new Error('sin red'))
    render(<SignupWizard />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.click(botonGoogle())
    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalled())
    const guardado = JSON.parse(datos.get(GOOGLE_SIGNUP_INTENT_KEY)!)
    expect(guardado.legalVersion).toBe(LEGAL_DOCS_VERSION)
    expect(guardado).not.toHaveProperty('launchCampaignCode')
  })

  it('si no se pudo ir a Google, el intento no se queda colgado', async () => {
    loginWithGoogle.mockRejectedValue(new Error('sin red'))
    render(<SignupWizard />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.click(botonGoogle())
    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalled())
    await waitFor(() => expect(datos.has(GOOGLE_SIGNUP_INTENT_KEY)).toBe(false))
  })
})
