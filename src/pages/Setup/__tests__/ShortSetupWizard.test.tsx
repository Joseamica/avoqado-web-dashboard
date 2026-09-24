/**
 * El asistente corto, montado (§4.1).
 *
 * 🔴 Lo que fija:
 *  - reanuda en la pantalla que corresponde a los DATOS, no a `currentStep`;
 *  - un guardado que falla NO avanza y lo dice (el asistente largo se lo tragaba y el alta moría
 *    al final, sin explicación);
 *  - un `complete` que falla muestra el mensaje del servidor;
 *  - si hay un código de anuncio guardado y el progreso no tiene campaña, se reclama una vez;
 *  - una campaña que no se puede asociar nunca bloquea el alta.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProgress = vi.fn()
const saveStep = vi.fn()
const acceptTerms = vi.fn()
const completeSetup = vi.fn()
const attachLaunchCampaign = vi.fn()
const toast = vi.fn()
const navigate = vi.fn()

vi.mock('@/services/setup.service', () => ({
  setupService: {
    getProgress: (...a: unknown[]) => getProgress(...a),
    saveStep: (...a: unknown[]) => saveStep(...a),
    acceptTerms: (...a: unknown[]) => acceptTerms(...a),
    completeSetup: (...a: unknown[]) => completeSetup(...a),
    attachLaunchCampaign: (...a: unknown[]) => attachLaunchCampaign(...a),
    planSetupIntent: vi.fn().mockResolvedValue({ data: { data: { clientSecret: 'seti' } } }),
  },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => {
      const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
      return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
    },
    i18n: { language: 'es' },
  }),
  Trans: ({ defaults }: { defaults?: string }) => <span>{defaults ?? ''}</span>,
}))
vi.mock('@/components/layouts/SetupWizardLayout', () => ({
  SetupWizardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../steps/OfferStep', () => ({ OfferStep: () => <div data-testid="pantalla-oferta" /> }))
vi.mock('../steps/BusinessTypeStep', () => ({
  BusinessTypeStep: ({ onNext }: { onNext: (d: unknown) => void }) => (
    <button onClick={() => onNext({ businessType: 'CAFE' })}>giro-continuar</button>
  ),
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ShortSetupWizard from '../ShortSetupWizard'
import { ACQUISITION_STORAGE_KEY } from '@/lib/acquisition'
import { LEGAL_DOCS_VERSION } from '@/config/legal'

function progresoDe(over: Record<string, unknown> = {}) {
  return {
    data: {
      progress: {
        legal: { currentVersion: '2026-09-17', acceptedVersion: '2026-09-17', consentRequired: false },
        v2SetupData: { step2: { businessName: 'Café Testarudo' }, step3: { businessType: 'CAFE' } },
        planActivationStatus: 'NONE',
        launchOffer: null,
        planQuote: null,
        venueId: 'venue_1',
        ...over,
      },
      featureFlags: { shortOnboarding: true },
    },
  }
}

function sembrarAtribucion(offerParam: string | null) {
  const datos = new Map<string, string>()
  if (offerParam) datos.set(ACQUISITION_STORAGE_KEY, JSON.stringify({ offerParam, utm: {}, savedAt: new Date().toISOString() }))
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

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ShortSetupWizard organizationId="org_1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getProgress.mockReset().mockResolvedValue(progresoDe())
  saveStep.mockReset().mockResolvedValue({})
  acceptTerms.mockReset().mockResolvedValue({})
  completeSetup.mockReset().mockResolvedValue({})
  attachLaunchCampaign.mockReset().mockResolvedValue({})
  toast.mockReset()
  navigate.mockReset()
  sembrarAtribucion(null)
})

describe('ShortSetupWizard — dónde reanuda', () => {
  it('con consentimiento pendiente abre en la casilla', async () => {
    getProgress.mockResolvedValue(progresoDe({ legal: { currentVersion: '2026-09-17', acceptedVersion: null, consentRequired: true } }))
    pintar()
    expect(await screen.findByText(/Antes de empezar/i)).toBeInTheDocument()
  })

  it('sin nombre del negocio abre en «Tu negocio»', async () => {
    getProgress.mockResolvedValue(progresoDe({ v2SetupData: {} }))
    pintar()
    expect(await screen.findByLabelText(/Nombre del negocio/i)).toBeInTheDocument()
  })

  it('con lo básico capturado abre en la oferta', async () => {
    pintar()
    expect(await screen.findByTestId('pantalla-oferta')).toBeInTheDocument()
  })

  it('con el plan ya cobrado abre en el cierre', async () => {
    getProgress.mockResolvedValue(progresoDe({ planActivationStatus: 'ACTIVE' }))
    pintar()
    expect(await screen.findByText(/Todo listo/i)).toBeInTheDocument()
  })
})

describe('ShortSetupWizard — guardados', () => {
  it('🔴 un guardado que FALLA no avanza y lo dice', async () => {
    getProgress.mockResolvedValue(progresoDe({ v2SetupData: {} }))
    saveStep.mockRejectedValue({ response: { data: { message: 'El servidor dijo que no' } } })

    pintar()
    const campo = await screen.findByLabelText(/Nombre del negocio/i)
    const user = userEvent.setup()
    await user.type(campo, 'Café Testarudo')
    await user.click(screen.getByRole('button', { name: /Continuar/i }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'El servidor dijo que no' })))
    expect(await screen.findByLabelText(/Nombre del negocio/i)).toBeInTheDocument()
  })

  it('un guardado que funciona avanza a la pantalla siguiente', async () => {
    getProgress.mockResolvedValue(progresoDe({ v2SetupData: {} }))
    pintar()
    const campo = await screen.findByLabelText(/Nombre del negocio/i)
    const user = userEvent.setup()
    await user.type(campo, 'Café Testarudo')
    await user.click(screen.getByRole('button', { name: /Continuar/i }))

    await waitFor(() => expect(saveStep).toHaveBeenCalledWith('org_1', 2, { businessName: 'Café Testarudo' }))
    expect(await screen.findByText('giro-continuar')).toBeInTheDocument()
  })

  it('el giro se guarda en el paso 3 — nunca en el 9 ni en el 5', async () => {
    getProgress.mockResolvedValue(progresoDe({ v2SetupData: { step2: { businessName: 'X' } } }))
    pintar()
    await userEvent.setup().click(await screen.findByText('giro-continuar'))
    await waitFor(() => expect(saveStep).toHaveBeenCalledWith('org_1', 3, { businessType: 'CAFE' }))
  })

  it('el consentimiento manda la VERSIÓN, no la fecha', async () => {
    getProgress.mockResolvedValue(progresoDe({ legal: { currentVersion: '2026-09-17', acceptedVersion: null, consentRequired: true } }))
    pintar()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Continuar/i }))
    // Se compara contra la constante declarada, no contra un literal: el literal que estaba aquí
    // era `'2026-09-17'` — una FECHA, que es justo lo que el título dice que NO se manda, y lo que
    // el servidor lee como el marcador legacy del asistente viejo.
    await waitFor(() =>
      expect(acceptTerms).toHaveBeenCalledWith('org_1', {
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: LEGAL_DOCS_VERSION,
      }),
    )
    // 🔴 Y el título se comprueba de verdad, no solo se afirma en el nombre del test.
    expect(acceptTerms.mock.calls[0][1].termsVersion).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('ShortSetupWizard — cierre', () => {
  it('un complete que falla MUESTRA el mensaje del servidor y no navega', async () => {
    getProgress.mockResolvedValue(progresoDe({ planActivationStatus: 'ACTIVE' }))
    completeSetup.mockRejectedValue({ response: { data: { message: 'Acepta los términos para terminar' } } })

    pintar()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Entrar a Avoqado/i }))

    expect(await screen.findByText(/Acepta los términos para terminar/)).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('un complete exitoso entra al dashboard', async () => {
    getProgress.mockResolvedValue(progresoDe({ planActivationStatus: 'ACTIVE' }))
    pintar()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Entrar a Avoqado/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })
})

describe('ShortSetupWizard — campaña del anuncio', () => {
  it('con un código guardado y sin campaña en el progreso, lo reclama UNA vez', async () => {
    sembrarAtribucion('pos-22')
    pintar()
    await waitFor(() => expect(attachLaunchCampaign).toHaveBeenCalledWith('org_1', { slug: 'pos-22' }))
    expect(attachLaunchCampaign).toHaveBeenCalledTimes(1)
  })

  it('si el progreso YA tiene campaña no se vuelve a reclamar', async () => {
    sembrarAtribucion('pos-22')
    getProgress.mockResolvedValue(progresoDe({ launchCampaignId: 'lc_1' }))
    pintar()
    await screen.findByTestId('pantalla-oferta')
    expect(attachLaunchCampaign).not.toHaveBeenCalled()
  })

  it('sin código guardado no se llama al endpoint', async () => {
    pintar()
    await screen.findByTestId('pantalla-oferta')
    expect(attachLaunchCampaign).not.toHaveBeenCalled()
  })

  it('🔴 un reclamo que REVIENTA no bloquea el alta', async () => {
    sembrarAtribucion('pos-22')
    attachLaunchCampaign.mockRejectedValue(new Error('500'))
    pintar()
    expect(await screen.findByTestId('pantalla-oferta')).toBeInTheDocument()
  })
})
