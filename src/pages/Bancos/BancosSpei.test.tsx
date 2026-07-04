import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import BancosSpei from './BancosSpei'

// i18n: echo key — convención del repo (ver BankConnectWizard.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test' }),
}))

// PRO ya desbloqueado — el sujeto de este test es el formulario, no el gate.
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, requiredTier: 'PRO', isLoading: false }),
}))

// Nota: usar funciones async planas en vez de `vi.fn().mockResolvedValue(...)` encadenado —
// en esta versión de Vitest el encadenado no sobrevive el hoisting del factory de vi.mock.
vi.mock('@/services/financialConnection.service', () => ({
  financialConnectionAPI: {
    listConnections: vi.fn(async () => [
      {
        id: 'conn-1',
        status: 'CONNECTED',
        mode: 'LIVE',
        lastError: null,
        provider: { code: 'EXTERNAL_BANK', name: 'Banco Uno' },
        accountKind: 'MERCHANT',
        accounts: [
          {
            id: 'acc-1',
            externalId: 'ext-1',
            label: 'Cuenta negocio',
            clabe: '032180000118359719',
            currency: 'MXN',
            lastBalance: 1000,
            lastSyncedAt: null,
            balanceState: 'OK',
            merchantAccounts: [],
          },
        ],
      },
    ]),
    listProviders: vi.fn(async () => [{ id: 'prov-1', name: 'Banco Uno', active: true, connectionType: 'DIRECT_CREDENTIAL' }]),
  },
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BancosSpei />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BancosSpei', () => {
  it('con una cuenta MERCHANT conectada: renderiza el formulario completo con el submit SIEMPRE deshabilitado', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByLabelText('hub.spei.fields.clabe')).toBeInTheDocument())
    expect(screen.getByLabelText('hub.spei.fields.beneficiaryName')).toBeInTheDocument()
    expect(screen.getByLabelText('hub.spei.fields.amount')).toBeInTheDocument()
    expect(screen.getByLabelText('hub.spei.fields.twoFactorCode')).toBeInTheDocument()

    const submit = screen.getByRole('button', { name: /hub\.spei\.submit/ })
    expect(submit).toBeDisabled()
  })

  it('sin cuentas MERCHANT (solo CLIENT): muestra el aviso "solo negocio", nunca el formulario', async () => {
    const { financialConnectionAPI } = await import('@/services/financialConnection.service')
    vi.mocked(financialConnectionAPI.listConnections).mockResolvedValueOnce([
      {
        id: 'conn-2',
        status: 'CONNECTED',
        mode: 'LIVE',
        lastError: null,
        provider: { code: 'EXTERNAL_BANK', name: 'Banco Uno' },
        accountKind: 'CLIENT',
        accounts: [
          {
            id: 'acc-2',
            externalId: 'ext-2',
            label: 'Cuenta personal',
            clabe: null,
            currency: 'MXN',
            lastBalance: 500,
            lastSyncedAt: null,
            balanceState: 'OK',
            merchantAccounts: [],
          },
        ],
      },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('hub.merchantOnly')).toBeInTheDocument())
    expect(screen.queryByLabelText('hub.spei.fields.clabe')).not.toBeInTheDocument()
  })
})
