/**
 * Con el asistente CORTO en pantalla, la dirección no puede decir el paso del asistente LARGO:
 * el 29-sep se veía «#step-3» mientras la pantalla decía «Paso 4 de 4».
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'

const getProgress = vi.fn()
vi.mock('@/services/setup.service', () => ({ setupService: { getProgress: (...a: unknown[]) => getProgress(...a) } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { organizationId: 'org_1' }, logout: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn(), startSessionReplay: vi.fn(), stopSessionReplay: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/components/layouts/SetupWizardLayout', () => ({
  SetupWizardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../ShortSetupWizard', () => ({ default: () => <p>asistente corto</p> }))
for (const step of [
  'BusinessInfoStep',
  'BusinessTypeStep',
  'EntityTypeStep',
  'IdentityStep',
  'TermsStep',
  'BankAccountStep',
  'PaymentProvidersStep',
  'BuyTpvStep',
  'PlanStep',
])
  vi.doMock(`../steps/${step}`, () => ({ [step]: () => null }))

beforeEach(() => {
  getProgress.mockResolvedValue({
    data: { progress: { currentStep: 'step4', v2SetupData: {} }, featureFlags: { shortOnboarding: true } },
  })
  window.history.replaceState(null, '', '/setup#step-3')
})

it('con el asistente corto, la dirección no conserva ni escribe el «#step-N» del largo', async () => {
  const { default: SetupWizard } = await import('../SetupWizard')
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SetupWizard />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('asistente corto')).toBeInTheDocument()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(window.location.hash).toBe('')
  expect(window.location.pathname).toBe('/setup')
})

it('con el asistente largo, la dirección sigue diciendo su paso (regresión)', async () => {
  getProgress.mockResolvedValue({ data: { progress: { currentStep: 'step2', v2SetupData: {} } } })
  window.history.replaceState(null, '', '/setup')
  const { default: SetupWizard } = await import('../SetupWizard')
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SetupWizard />
    </QueryClientProvider>,
  )
  await vi.waitFor(() => expect(window.location.hash).toMatch(/^#step-\d+$/))
})
