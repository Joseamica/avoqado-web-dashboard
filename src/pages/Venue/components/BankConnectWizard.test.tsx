import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { BankConnectWizard } from './BankConnectWizard'

// ─── i18n: echo key — repo convention (see ReferralCard.test.tsx /
// MoneyLocationStrip.test.tsx). Echoing the key lets this test target the
// toggle without depending on translated copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// ─── financial connection service ──────────────────────────────────────────
const mockListProviders = vi.fn()
const mockCreateConnection = vi.fn()
vi.mock('@/services/financialConnection.service', () => ({
  financialConnectionAPI: {
    listProviders: (...args: unknown[]) => mockListProviders(...args),
    createConnection: (...args: unknown[]) => mockCreateConnection(...args),
    validateTwoFactor: vi.fn(),
    validateDevice: vi.fn(),
    selectAccount: vi.fn(),
    listConnections: vi.fn(),
    getBalance: vi.fn(),
    disconnect: vi.fn(),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

async function goToCredentialsStep() {
  await waitFor(() => expect(screen.getByText('Banco Uno')).toBeInTheDocument())
  fireEvent.click(screen.getByText('Banco Uno'))
  await waitFor(() => expect(screen.getByLabelText('wizard.step2.email')).toBeInTheDocument())
}

describe('BankConnectWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListProviders.mockResolvedValue([{ id: 'prov-1', name: 'Banco Uno' }])
    // Mutation never resolves in these tests — we only assert on the call args.
    mockCreateConnection.mockImplementation(() => new Promise(() => {}))
  })

  it('submits credentials without touching the toggle -> createConnection receives accountKind MERCHANT (retrocompatible default)', async () => {
    renderWithClient(<BankConnectWizard open onClose={vi.fn()} venueId="venue-1" />)
    await goToCredentialsStep()

    fireEvent.change(screen.getByLabelText('wizard.step2.email'), { target: { value: 'owner@negocio.com' } })
    fireEvent.change(screen.getByLabelText('wizard.step2.password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('wizard.step2.submit'))

    await waitFor(() =>
      expect(mockCreateConnection).toHaveBeenCalledWith('venue-1', {
        providerId: 'prov-1',
        email: 'owner@negocio.com',
        password: 'secret123',
        accountKind: 'MERCHANT',
      }),
    )
  })

  it('clicking "Cuenta personal" then submitting -> createConnection receives accountKind CLIENT', async () => {
    renderWithClient(<BankConnectWizard open onClose={vi.fn()} venueId="venue-1" />)
    await goToCredentialsStep()

    fireEvent.click(screen.getByText('wizard.step2.kind.personal'))
    fireEvent.change(screen.getByLabelText('wizard.step2.email'), { target: { value: 'cliente@correo.com' } })
    fireEvent.change(screen.getByLabelText('wizard.step2.password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByText('wizard.step2.submit'))

    await waitFor(() =>
      expect(mockCreateConnection).toHaveBeenCalledWith('venue-1', {
        providerId: 'prov-1',
        email: 'cliente@correo.com',
        password: 'secret123',
        accountKind: 'CLIENT',
      }),
    )
  })
})
