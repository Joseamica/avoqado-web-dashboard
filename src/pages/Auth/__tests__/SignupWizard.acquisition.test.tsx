/**
 * El registro con consentimiento y atribución de campaña (§3.5 y §4.1).
 *
 * 🔴 Lo que se protege aquí:
 *  - sin la casilla marcada NO se envía nada (el servidor exige el consentimiento para terminar,
 *    así que dejar pasar el alta sin él produce un callejón al final, no un error temprano);
 *  - el cuerpo lleva `legalVersion`, el CÓDIGO de campaña resuelto y las UTMs;
 *  - un `?oferta=` que no resuelve deja un registro NORMAL: un anuncio caducado nunca puede
 *    impedir que alguien se dé de alta.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signup = vi.fn()
const navigate = vi.fn()
const trackSignup = vi.fn()
const resolveLaunchCampaignCode = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ signup, isLoading: false }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ refetchQueries: vi.fn() }) }))
vi.mock('@/lib/gtag', () => ({ trackSignup: (...a: unknown[]) => trackSignup(...a) }))
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
import { LEGAL_DOCS_VERSION } from '@/config/legal'

function sembrarAtribucion(offerParam: string | null, utm: Record<string, string> = {}) {
  const datos = new Map<string, string>()
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

async function llenarYEnviar(marcarCasilla: boolean) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/correo|email/i), 'nuevo@negocio.mx')
  await user.type(screen.getByLabelText(/contraseña|password/i), 'unaContraseña8')
  if (marcarCasilla) await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: /crear|create/i }))
}

describe('SignupWizard — consentimiento y campaña', () => {
  beforeEach(() => {
    signup.mockReset().mockResolvedValue(undefined)
    navigate.mockReset()
    trackSignup.mockReset()
    resolveLaunchCampaignCode.mockReset().mockResolvedValue(null)
    sembrarAtribucion(null)
  })

  it('sin la casilla marcada NO envía el registro', async () => {
    render(<SignupWizard />)
    await llenarYEnviar(false)
    await waitFor(() => expect(screen.getByText(/acepta|accept/i)).toBeInTheDocument())
    expect(signup).not.toHaveBeenCalled()
  })

  it('con la casilla marcada manda la VERSIÓN legal, y NO la fecha del día', async () => {
    // El dashboard de producción manda `new Date().toISOString().split('T')[0]`: la fecha de HOY.
    // Se mueve el reloj para que las dos no puedan coincidir por casualidad.
    vi.setSystemTime(new Date('2027-03-04T12:00:00Z'))
    try {
      render(<SignupWizard />)
      await llenarYEnviar(true)
      await waitFor(() => expect(signup).toHaveBeenCalled())
      const cuerpo = signup.mock.calls[0][0]
      expect(cuerpo.legalVersion).toBe(LEGAL_DOCS_VERSION)
      expect(cuerpo.legalVersion).not.toBe(new Date().toISOString().split('T')[0])
    } finally {
      vi.setSystemTime(new Date())
      vi.useRealTimers()
    }
  })

  it('manda el CÓDIGO resuelto de la campaña y las UTMs guardadas', async () => {
    sembrarAtribucion('pos-22', { utm_source: 'google', utm_medium: 'cpc' })
    resolveLaunchCampaignCode.mockResolvedValue('POS22')

    render(<SignupWizard />)
    await llenarYEnviar(true)

    await waitFor(() => expect(signup).toHaveBeenCalled())
    expect(resolveLaunchCampaignCode).toHaveBeenCalledWith('pos-22')
    const cuerpo = signup.mock.calls[0][0]
    expect(cuerpo.launchCampaignCode).toBe('POS22')
    expect(cuerpo.utm).toEqual({ utm_source: 'google', utm_medium: 'cpc' })
    expect(trackSignup).toHaveBeenCalledWith('email', 'POS22')
  })

  it('un ?oferta= que no resuelve deja un registro NORMAL, sin campaña y sin error', async () => {
    sembrarAtribucion('no-existe')
    resolveLaunchCampaignCode.mockResolvedValue(null)

    render(<SignupWizard />)
    await llenarYEnviar(true)

    await waitFor(() => expect(signup).toHaveBeenCalled())
    const cuerpo = signup.mock.calls[0][0]
    expect(cuerpo.launchCampaignCode).toBeUndefined()
    expect(cuerpo.email).toBe('nuevo@negocio.mx')
    expect(trackSignup).toHaveBeenCalledWith('email', undefined)
  })

  it('si la resolución del código REVIENTA, el alta sigue igual', async () => {
    sembrarAtribucion('pos-22')
    resolveLaunchCampaignCode.mockRejectedValue(new Error('sin red'))

    render(<SignupWizard />)
    await llenarYEnviar(true)

    await waitFor(() => expect(signup).toHaveBeenCalled())
    expect(signup.mock.calls[0][0].launchCampaignCode).toBeUndefined()
  })

  it('sin atribución guardada no se consulta la API pública', async () => {
    render(<SignupWizard />)
    await llenarYEnviar(true)
    await waitFor(() => expect(signup).toHaveBeenCalled())
    expect(resolveLaunchCampaignCode).not.toHaveBeenCalled()
    expect(signup.mock.calls[0][0].utm).toBeUndefined()
  })
})
