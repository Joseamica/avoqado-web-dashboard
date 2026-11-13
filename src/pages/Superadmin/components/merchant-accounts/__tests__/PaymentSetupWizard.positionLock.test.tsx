/**
 * Candado de posiciones (tarifa al comercio, paso 1) en el asistente de pagos de la organización: la configuración de la
 * organización se guarda PRIMERO (por el candado) y sólo después se tocan las terminales y lo demás. Si el SERVIDOR pide
 * confirmar y la persona cancela, no se toca ninguna terminal ni se guarda nada más.
 * El asistente, el diálogo y TanStack son de verdad: se fingen los servicios y los pasos (que aquí no importan).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => ({
  llamadas: [] as Array<[string, ...unknown[]]>,
  configResponde: [] as Array<'candado' | 'ok'>,
  avisos: [] as Array<{ title?: string }>,
}))

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (t: { title?: string }) => red.avisos.push(t) }) }))

vi.mock('@/services/paymentProvider.service', () => {
  const anota =
    (nombre: string) =>
    async (...args: unknown[]) => {
      red.llamadas.push([nombre, ...args])
      return { id: `${nombre}-id` }
    }
  return {
    paymentProviderAPI: {
      getPaymentSetupSummary: async () => ({
        targetType: 'organization',
        targetId: 'org-1',
        config: {
          primaryAccountId: 'acc-1',
          // La secundaria ya no está entre las cuentas activas: el asistente la deja fuera y la posición se vacía.
          secondaryAccountId: 'acc-2',
          tertiaryAccountId: null,
          primaryAccount: { id: 'acc-1', costStructures: [], settlementConfigs: [] },
        },
        terminals: [
          { id: 't1', assignedMerchantIds: ['acc-1'] },
          { id: 't2', assignedMerchantIds: ['acc-huerfana'] },
        ],
        pricingStructures: [],
        venues: [],
        venuePricingStructures: [],
      }),
      getMerchantAccountsList: async () => [{ id: 'acc-1', displayName: 'Cuenta 1' }],
      batchAssignTerminals: anota('batchAssignTerminals'),
      removeMerchantFromTerminal: anota('removeMerchantFromTerminal'),
      updateProviderCostStructure: anota('updateProviderCostStructure'),
      createProviderCostStructure: anota('createProviderCostStructure'),
      deactivateVenuePricingStructure: anota('deactivateVenuePricingStructure'),
      updateVenuePricingStructure: anota('updateVenuePricingStructure'),
      createVenuePricingStructure: anota('createVenuePricingStructure'),
    },
  }
})
vi.mock('@/services/superadmin-organizations.service', () => ({
  setOrganizationPaymentConfig: async (orgId: string, data: Record<string, unknown>) => {
    red.llamadas.push(['setOrganizationPaymentConfig', orgId, data])
    if (red.configResponde.shift() === 'candado') throw errorDelCandado()
    return { success: true }
  },
  setOrganizationPricing: async (...args: unknown[]) => {
    red.llamadas.push(['setOrganizationPricing', ...args])
    return { success: true }
  },
}))
vi.mock('@/services/settlementConfiguration.service', () => ({
  bulkCreateSettlementConfigurations: async (...args: unknown[]) => {
    red.llamadas.push(['bulkCreateSettlementConfigurations', ...args])
    return []
  },
}))
// Los pasos no participan en el guardado: se quitan para que la prueba no dependa de sus pantallas.
vi.mock('../wizard-steps/MerchantStep', () => ({ MerchantStep: () => null }))
vi.mock('../wizard-steps/TerminalStep', () => ({ TerminalStep: () => null }))
vi.mock('../wizard-steps/CostStructureStep', () => ({ CostStructureStep: () => null }))
vi.mock('../wizard-steps/VenuePricingStep', () => ({ VenuePricingStep: () => null }))
vi.mock('../wizard-steps/SettlementStep', () => ({ SettlementStep: () => null }))
vi.mock('../wizard-steps/VenueOverridesStep', () => ({ VenueOverridesStep: () => null }))
vi.mock('../wizard-steps/SummaryStep', () => ({ SummaryStep: () => null }))

import { PaymentSetupWizard } from '../PaymentSetupWizard'

function errorDelCandado() {
  return new AxiosError('400', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {
      code: 'CONFIRMAR_POSICION',
      details: {
        positions: [
          {
            slot: 'SECONDARY',
            label: 'Secundaria',
            accountChanges: true,
            currentAccount: { id: 'acc-2', name: 'Cuenta 2', providerCode: 'BLUMON' },
            nextAccount: null,
            pricing: null,
            pricingFingerprint: 'SIN_TARIFA',
            inheritingTerminals: { total: 1, byBrand: { PAX: 1 }, losingAccount: 1 },
            needs: { previousAccountId: true, nextAccountId: false, rate: false, inheritingTerminals: true },
            problems: ['FALTA_TERMINALES'],
          },
        ],
      },
    },
  })
}

async function abrirYGuardar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PaymentSetupWizard open onClose={() => {}} context={{ organizationId: 'org-1', orgName: 'Org Uno' }} />
    </QueryClientProvider>,
  )
  // «Guardar» se habilita cuando el asistente ya cargó la configuración de la organización (la cuenta principal).
  const guardar = await screen.findByRole('button', { name: /Guardar/ })
  await waitFor(() => expect(guardar).not.toBeDisabled())
  await act(async () => {
    fireEvent.click(guardar)
  })
}

const nombres = () => red.llamadas.map(([n]) => n)

describe('PaymentSetupWizard · candado de posiciones', () => {
  beforeEach(() => {
    red.llamadas.length = 0
    red.configResponde.length = 0
    red.avisos.length = 0
  })

  it('guarda la configuración de la organización ANTES de tocar cualquier terminal, con las cuentas que la pantalla leyó', async () => {
    red.configResponde.push('ok')
    await abrirYGuardar()

    await waitFor(() => expect(nombres()).toContain('bulkCreateSettlementConfigurations'))
    expect(nombres()[0]).toBe('setOrganizationPaymentConfig')
    expect(nombres()).toEqual(
      expect.arrayContaining(['batchAssignTerminals', 'removeMerchantFromTerminal', 'bulkCreateSettlementConfigurations']),
    )
    expect(red.llamadas[0]).toEqual([
      'setOrganizationPaymentConfig',
      'org-1',
      {
        primaryAccountId: 'acc-1',
        secondaryAccountId: undefined,
        tertiaryAccountId: undefined,
        positionConfirmations: {
          PRIMARY: { previousAccountId: 'acc-1' },
          SECONDARY: { previousAccountId: 'acc-2' },
          TERTIARY: { previousAccountId: null },
        },
      },
    ])
    expect(red.avisos.map(a => a.title)).toEqual(['Configuración guardada'])
  })

  it('si la persona cancela la confirmación, no se toca ninguna terminal ni se guarda nada más (y no sale error)', async () => {
    red.configResponde.push('candado')
    await abrirYGuardar()

    expect(await screen.findByText('Confirma el cambio de cuenta')).toBeInTheDocument()
    expect(nombres()).toEqual(['setOrganizationPaymentConfig'])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    })

    await waitFor(() => expect(screen.queryByText('Confirma el cambio de cuenta')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar/ })).not.toBeDisabled())
    expect(nombres()).toEqual(['setOrganizationPaymentConfig'])
    expect(red.avisos).toEqual([])
  })

  it('al confirmar se reenvía SÓLO la configuración con lo confirmado y después siguen las terminales', async () => {
    red.configResponde.push('candado', 'ok')
    await abrirYGuardar()

    expect(await screen.findByText('Confirma el cambio de cuenta')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Entiendo lo de las terminales'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('position-confirm-ok'))
    })

    await waitFor(() => expect(nombres()).toContain('bulkCreateSettlementConfigurations'))
    expect(nombres().slice(0, 2)).toEqual(['setOrganizationPaymentConfig', 'setOrganizationPaymentConfig'])
    expect((red.llamadas[1][2] as { positionConfirmations: unknown }).positionConfirmations).toEqual({
      PRIMARY: { previousAccountId: 'acc-1' },
      SECONDARY: { previousAccountId: 'acc-2', inheritingTerminals: 1 },
      TERTIARY: { previousAccountId: null },
    })
  })
})
