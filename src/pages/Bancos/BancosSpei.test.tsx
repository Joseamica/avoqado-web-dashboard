import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import BancosSpei from './BancosSpei'

// i18n: echo key — convención del repo (ver BankConnectWizard.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test' }),
}))

// PRO ya desbloqueado — el sujeto de este test es el flujo de envío, no el gate.
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, requiredTier: 'PRO', isLoading: false }),
}))

// Nota: funciones async planas en vez de `vi.fn().mockResolvedValue(...)` encadenado —
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
    listSpeiBanks: vi.fn(async () => [
      { idBanco: 40012, name: 'BBVA MEXICO', clabePrefix: 32 },
      { idBanco: 40002, name: 'BANAMEX', clabePrefix: 2 },
    ]),
    sendSpeiOut: vi.fn(async () => ({ ok: true, operationId: 'op-777', transferId: 'uuid-1', message: 'OK' })),
  },
}))

const VALID_CLABE = '032180000118359719'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BancosSpei />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillValidForm() {
  await waitFor(() => expect(screen.getByLabelText('hub.spei.fields.clabe')).toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('hub.spei.fields.clabe'), { target: { value: VALID_CLABE } })
  fireEvent.change(screen.getByLabelText('hub.spei.fields.beneficiaryName'), { target: { value: 'Juan Pérez' } })
  fireEvent.change(screen.getByLabelText('hub.spei.fields.amount'), { target: { value: '150.50' } })
  fireEvent.change(screen.getByLabelText('hub.spei.fields.concept'), { target: { value: 'Renta' } })
  // El banco se autosugiere por el prefijo de la CLABE (032 → BBVA en el fixture).
  await waitFor(() => expect(screen.getByRole('button', { name: /hub\.spei\.review/ })).toBeEnabled())
}

describe('BancosSpei (flujo real)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CLABE con dígito verificador inválido: muestra el error y "Revisar" queda deshabilitado', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('hub.spei.fields.clabe')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('hub.spei.fields.clabe'), { target: { value: '032180000118359710' } })
    fireEvent.change(screen.getByLabelText('hub.spei.fields.beneficiaryName'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('hub.spei.fields.amount'), { target: { value: '10' } })
    expect(await screen.findByText('hub.spei.clabeInvalid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hub\.spei\.review/ })).toBeDisabled()
  })

  it('flujo completo: form válido → confirmación con advertencia → enviar llama al API y muestra el folio', async () => {
    const { financialConnectionAPI } = await import('@/services/financialConnection.service')
    renderPage()
    await fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: /hub\.spei\.review/ }))

    // Paso de confirmación: advertencia de irreversibilidad + datos del destino visibles.
    expect(await screen.findByText('hub.spei.irreversibleWarning')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText(`CLABE ${VALID_CLABE}`)).toBeInTheDocument()
    // Nada se envió todavía.
    expect(financialConnectionAPI.sendSpeiOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /hub\.spei\.send$/ }))

    await waitFor(() => expect(screen.getByText('hub.spei.successTitle')).toBeInTheDocument())
    expect(financialConnectionAPI.sendSpeiOut).toHaveBeenCalledWith('v1', 'acc-1', {
      destinationClabe: VALID_CLABE,
      beneficiaryName: 'Juan Pérez',
      idBanco: 40012, // autosugerido por el prefijo 032
      amount: 150.5,
      concept: 'Renta',
      // Generada en el CLIENTE al entrar a confirmación — el retry HTTP reenvía la misma.
      idempotencyKey: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    })
    expect(screen.getByText('hub.spei.successBody')).toBeInTheDocument()
  })

  it('rechazo del proveedor (422 → axios error con message): muestra error honesto + hint de verificar movimientos', async () => {
    const { financialConnectionAPI } = await import('@/services/financialConnection.service')
    vi.mocked(financialConnectionAPI.sendSpeiOut).mockRejectedValueOnce({
      response: { status: 422, data: { success: false, data: { message: 'Saldo insuficiente' } } },
    })
    renderPage()
    await fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /hub\.spei\.review/ }))
    fireEvent.click(await screen.findByRole('button', { name: /hub\.spei\.send$/ }))

    await waitFor(() => expect(screen.getByText('hub.spei.errorTitle')).toBeInTheDocument())
    expect(screen.getByText('Saldo insuficiente')).toBeInTheDocument()
    expect(screen.getByText('hub.spei.errorHint')).toBeInTheDocument()
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

  it('conexión MERCHANT con VARIAS cuentas: se excluye del envío (el proveedor debita por usuario, no por cuenta elegida)', async () => {
    const { financialConnectionAPI } = await import('@/services/financialConnection.service')
    const acc = (id: string) => ({
      id,
      externalId: `ext-${id}`,
      label: `Negocio ${id}`,
      clabe: null,
      currency: 'MXN',
      lastBalance: 100,
      lastSyncedAt: null,
      balanceState: 'OK' as const,
      merchantAccounts: [],
    })
    vi.mocked(financialConnectionAPI.listConnections).mockResolvedValueOnce([
      {
        id: 'conn-multi',
        status: 'CONNECTED',
        mode: 'LIVE',
        lastError: null,
        provider: { code: 'EXTERNAL_BANK', name: 'Banco Uno' },
        accountKind: 'MERCHANT',
        accounts: [acc('m1'), acc('m2')], // 2 cuentas en UNA conexión
      },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('hub.spei.multiAccountUnavailable')).toBeInTheDocument())
    expect(screen.queryByLabelText('hub.spei.fields.clabe')).not.toBeInTheDocument()
  })
})
