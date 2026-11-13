/**
 * D18 (13-nov-2026): el «Wizard de Pagos» reescribía tarifas, costos y plazos en cada «Guardar» aunque nada cambiara (cerraba
 * la tarifa de la organización y creaba otra idéntica, volvía a escribir la del negocio y, como el prellenado no traía el IVA,
 * lo mandaba en `null`). Promesa: `docs/audit/2026-11-13-d17-d18-d20/promesa.md` del workspace.
 * Ahora: sólo se escribe lo que cambió contra lo que se cargó; lo que no existía sólo si la persona vio ese paso.
 * El asistente, TanStack y el paso «Costos» son de verdad (lee el costo del servidor por su cuenta); se fingen los servicios
 * y los demás pasos (con botones que hacen lo que haría la persona).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => ({
  llamadas: [] as Array<[string, ...unknown[]]>,
  resumen: null as unknown,
  costos: {} as Record<string, unknown[]>,
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
      getPaymentSetupSummary: async () => red.resumen,
      getMerchantAccountsList: async () => [
        { id: 'acc-1', displayName: 'Cuenta 1' },
        { id: 'acc-2', displayName: 'Cuenta 2' },
      ],
      getProviderCostStructures: async ({ merchantAccountId }: { merchantAccountId: string }) => red.costos[merchantAccountId] ?? [],
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
  setOrganizationPaymentConfig: async (...args: unknown[]) => {
    red.llamadas.push(['setOrganizationPaymentConfig', ...args])
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
vi.mock('../wizard-steps/MerchantStep', () => ({
  MerchantStep: ({ dispatch, allMerchants }: any) =>
    allMerchants.map((m: any) => (
      <button
        key={m.id}
        onClick={() => dispatch({ type: 'SET_PRIMARY_MERCHANT', merchant: { mode: 'existing', merchantId: m.id, merchant: m } })}
      >
        principal {m.id}
      </button>
    )),
}))
vi.mock('../wizard-steps/TerminalStep', () => ({ TerminalStep: () => null }))
vi.mock('../wizard-steps/VenuePricingStep', () => ({
  VenuePricingStep: ({ state, dispatch }: any) => (
    <button onClick={() => dispatch({ type: 'SET_PRICING', slot: 'PRIMARY', data: { ...state.pricing.PRIMARY, creditRate: 2.6 } })}>
      subir crédito
    </button>
  ),
}))
vi.mock('../wizard-steps/SettlementStep', () => ({ SettlementStep: () => null }))
vi.mock('../wizard-steps/VenueOverridesStep', () => ({
  // Iguala las tasas de la sucursal A a las de la organización (sin tocar su IVA).
  VenueOverridesStep: ({ state, dispatch }: any) => (
    <button
      onClick={() => {
        const org = state.pricing.PRIMARY
        const a = state.venueOverrides['v-a'].pricing
        dispatch({ type: 'SET_VENUE_PRICING', venueId: 'v-a', data: { ...a, debitRate: org.debitRate, creditRate: org.creditRate } })
      }}
    >
      igualar A
    </button>
  ),
}))
vi.mock('../wizard-steps/SummaryStep', () => ({ SummaryStep: () => null }))

import { PaymentSetupWizard, mismaTarifa, DEFAULT_PRICING } from '../PaymentSetupWizard'

const tarifa = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  accountType: 'PRIMARY',
  debitRate: '0.022',
  creditRate: '0.025',
  amexRate: '0.035',
  internationalRate: '0.038',
  includesTax: false,
  taxRate: '0.16',
  fixedFeePerTransaction: null,
  monthlyServiceFee: null,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  ...extra,
})
const plazo = (cardType: string, settlementDays: number) => ({
  cardType,
  settlementDays,
  settlementDayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
})

/** Organización ya configurada: costo, tarifa de organización (la vigente y una vieja todavía activa), plazos y una
 * sucursal con tarifa propia PRIMARY; otra sucursal sólo tiene tarifa SECONDARY (más reciente). */
const configurada = () => ({
  targetType: 'organization',
  targetId: 'org-1',
  config: {
    primaryAccountId: 'acc-1',
    secondaryAccountId: null,
    tertiaryAccountId: null,
    primaryAccount: {
      id: 'acc-1',
      costStructures: [
        {
          id: 'cs-1',
          debitRate: '0.015',
          creditRate: '0.018',
          amexRate: '0.03',
          internationalRate: '0.03',
          includesTax: false,
          taxRate: '0.16',
          fixedCostPerTransaction: null,
          monthlyFee: null,
        },
      ],
      settlementConfigs: [plazo('AMEX', 3), plazo('CREDIT', 1), plazo('DEBIT', 1), plazo('INTERNATIONAL', 3), plazo('OTHER', 2)],
    },
  },
  terminals: [{ id: 't1', assignedMerchantIds: ['acc-1'] }],
  // Del servidor: activas, de la más nueva a la más vieja.
  pricingStructures: [
    tarifa('org-vigente', { effectiveFrom: '2026-06-01T00:00:00.000Z' }),
    tarifa('org-vieja', { creditRate: '0.03', effectiveTo: '2026-05-31T00:00:00.000Z' }),
  ],
  venues: [
    { id: 'v-a', name: 'Sucursal A', slug: 'a' },
    { id: 'v-b', name: 'Sucursal B', slug: 'b' },
  ],
  venuePricingStructures: [
    tarifa('vp-b-secundaria', { accountType: 'SECONDARY', venueId: 'v-b', effectiveFrom: '2026-07-01T00:00:00.000Z' }),
    tarifa('vp-a', { venueId: 'v-a', creditRate: '0.027', includesTax: null }),
  ],
})

/** Organización con cuentas pero sin costo, tarifa ni plazos guardados. */
const sinNada = () => ({
  targetType: 'organization',
  targetId: 'org-1',
  config: {
    primaryAccountId: 'acc-1',
    secondaryAccountId: null,
    tertiaryAccountId: null,
    primaryAccount: { id: 'acc-1', costStructures: [], settlementConfigs: [] },
  },
  terminals: [],
  pricingStructures: [],
  venues: [],
  venuePricingStructures: [],
})

async function abrir({ esperarGuardar = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PaymentSetupWizard open onClose={() => {}} context={{ organizationId: 'org-1', orgName: 'Org Uno' }} />
    </QueryClientProvider>,
  )
  const guardar = await screen.findByRole('button', { name: /Guardar/ })
  if (esperarGuardar) await waitFor(() => expect(guardar).not.toBeDisabled())
}
/** El costo de la cuenta 1 tal como lo devuelve el servidor (el mismo que trae el resumen de `configurada`). */
const costoDeLaCuenta1 = () => configurada().config.primaryAccount.costStructures
async function guardar() {
  const antes = red.avisos.length
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }))
  })
  await waitFor(() => expect(red.avisos.length).toBe(antes + 1))
  expect(red.avisos[red.avisos.length - 1]?.title).toBe('Configuración guardada')
}
async function ir(paso: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${paso}`) }))
  })
}

const ESCRITURAS_DE_TARIFAS = [
  'updateProviderCostStructure',
  'createProviderCostStructure',
  'setOrganizationPricing',
  'bulkCreateSettlementConfigurations',
  'updateVenuePricingStructure',
  'createVenuePricingStructure',
  'deactivateVenuePricingStructure',
]
const tarifasEscritas = () => red.llamadas.filter(([n]) => ESCRITURAS_DE_TARIFAS.includes(n))

describe('PaymentSetupWizard · guardar sin cambios', () => {
  beforeEach(() => {
    red.llamadas.length = 0
    red.avisos.length = 0
    red.costos = { 'acc-1': costoDeLaCuenta1() }
  })

  it('organización configurada: «Guardar» sin cambios no escribe ninguna tarifa, costo ni plazo (tampoco tras ver todos los pasos)', async () => {
    red.resumen = configurada()
    await abrir()
    await guardar()
    expect(tarifasEscritas()).toEqual([])

    for (const paso of ['Terminales', 'Costos', 'Pricing', 'Liquidación', 'Sucursales', 'Resumen']) await ir(paso)
    await guardar()
    expect(tarifasEscritas()).toEqual([])
  })

  it('al cambiar la tarifa de la organización se manda la VIGENTE con el cambio y su IVA; un segundo «Guardar» ya no la reescribe', async () => {
    red.resumen = configurada()
    await abrir()
    await ir('Pricing')
    fireEvent.click(screen.getByRole('button', { name: 'subir crédito' }))
    await guardar()

    expect(tarifasEscritas().map(([n]) => n)).toEqual(['setOrganizationPricing'])
    expect(tarifasEscritas()[0][2]).toMatchObject({
      accountType: 'PRIMARY',
      // ÷100 en coma flotante, como siempre (Postgres guarda 4 decimales).
      debitRate: expect.closeTo(0.022, 10),
      creditRate: expect.closeTo(0.026, 10),
      amexRate: expect.closeTo(0.035, 10),
      internationalRate: expect.closeTo(0.038, 10),
      includesTax: false,
      taxRate: 0.16,
    })

    await guardar()
    expect(tarifasEscritas()).toHaveLength(1)
  })

  it('sin nada guardado: no crea costo en ceros, ni tarifa ni plazos de default que la persona no vio', async () => {
    red.resumen = sinNada()
    red.costos = {}
    await abrir()
    await ir('Costos')
    await guardar()
    expect(tarifasEscritas()).toEqual([])
  })

  it('sin nada guardado: si la persona vio la tarifa y los plazos, «Guardar» los crea como hoy', async () => {
    red.resumen = sinNada()
    red.costos = {}
    await abrir()
    await ir('Pricing')
    await ir('Liquidación')
    await guardar()
    expect(tarifasEscritas().map(([n]) => n)).toEqual(['setOrganizationPricing', 'bulkCreateSettlementConfigurations'])
  })
})

describe('PaymentSetupWizard · lo cargado es de la cuenta y la tarifa correctas (Codex r2)', () => {
  beforeEach(() => {
    red.llamadas.length = 0
    red.avisos.length = 0
    red.costos = { 'acc-1': costoDeLaCuenta1() }
  })

  it('sin configuración de cuentas: elegir la cuenta y ver Costos y Pricing no reescribe el costo ni la tarifa que ya existían', async () => {
    red.resumen = { ...configurada(), config: null, venues: [], venuePricingStructures: [] }
    await abrir({ esperarGuardar: false })
    fireEvent.click(await screen.findByRole('button', { name: 'principal acc-1' }))
    await ir('Costos')
    await screen.findByText('1 estructura') // el paso leyó el costo del servidor
    await ir('Pricing')
    await guardar()
    expect(tarifasEscritas()).toEqual([])
  })

  it('si la persona cambia la cuenta principal, los plazos que vio se crean para la NUEVA cuenta', async () => {
    red.resumen = configurada()
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'principal acc-2' }))
    await ir('Liquidación')
    await guardar()
    expect(tarifasEscritas().map(([n]) => n)).toEqual(['bulkCreateSettlementConfigurations'])
    expect(tarifasEscritas()[0][1]).toMatchObject({ merchantAccountId: 'acc-2' })
  })

  it('una sucursal «más IVA 8 %» con las mismas tasas que la organización «más IVA 16 %» no se desactiva: se actualiza con su IVA', async () => {
    const r = configurada()
    r.venuePricingStructures = r.venuePricingStructures.map(p =>
      p.id === 'vp-a' ? { ...p, includesTax: false, taxRate: '0.08' } : p,
    ) as typeof r.venuePricingStructures
    red.resumen = r
    await abrir()
    await ir('Sucursales')
    fireEvent.click(screen.getByRole('button', { name: 'igualar A' }))
    await guardar()
    expect(tarifasEscritas().map(([n]) => n)).toEqual(['updateVenuePricingStructure'])
    expect(tarifasEscritas()[0]).toEqual([
      'updateVenuePricingStructure',
      'vp-a',
      expect.objectContaining({ creditRate: expect.closeTo(0.025, 10), includesTax: false, taxRate: 0.08 }),
    ])
  })
})

describe('mismaTarifa', () => {
  it('el IVA cuenta: «sin definir» no es lo mismo que «incluido» ni que «más IVA»', () => {
    const base = { ...DEFAULT_PRICING, includesTax: null }
    expect(mismaTarifa(base, { ...base })).toBe(true)
    expect(mismaTarifa(base, { ...base, includesTax: true })).toBe(false)
    expect(mismaTarifa(base, { ...base, includesTax: false })).toBe(false)
    expect(mismaTarifa({ ...base, includesTax: undefined }, base)).toBe(true)
    expect(mismaTarifa(base, { ...base, taxRate: 0.08 })).toBe(false)
    expect(mismaTarifa(base, undefined)).toBe(false)
  })
})
