/**
 * «Configuración de Pagos» del negocio con la configuración HEREDADA de su organización (encargo e12dc4, 13-nov-2026).
 *
 * El negocio no tiene configuración propia: el SERVIDOR le devuelve la de su organización con `configSource: 'organization'`.
 * Antes la pantalla la editaba como del negocio: «Modificar» hacía un PUT a una fila que no es suya (fallaba) y «Eliminar»
 * intentaba borrarla. Ahora: aviso + etiqueta «heredada», sin «Eliminar», y guardar CREA la propia del negocio con las
 * cuentas que se ven. Al crearla se vuelven a leer los costos y tarifas (Codex r1 #2: si no, los márgenes siguen con la
 * cuenta anterior). Con configuración propia todo sigue igual.
 * La pantalla, el diálogo y TanStack son de verdad: sólo se fingen los servicios y quién mira.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  creates: [] as Array<[string, Record<string, unknown>]>,
  updates: [] as Array<[string, string, Record<string, unknown>]>,
  lecturasDeCostos: 0,
  lecturasDeTarifas: 0,
  venue: { id: 'v1', name: 'Mi negocio', slug: 'mi-negocio', organizationId: 'o1', organization: { name: 'Mi org' } },
}))

vi.mock('@/services/paymentProvider.service', () => ({
  paymentProviderAPI: {
    getVenuePaymentConfigByVenueId: async () => red.config,
    getVenueCostStructuresByVenueId: async () => {
      red.lecturasDeCostos++
      return []
    },
    getVenuePricingStructuresByVenueId: async () => {
      red.lecturasDeTarifas++
      return []
    },
    getMerchantAccountsList: async () => [],
    createVenuePaymentConfigByVenueId: async (venueId: string, data: Record<string, unknown>) => {
      red.creates.push([venueId, data])
      red.config = { ...red.config, id: 'cfg-nueva', venueId, organizationId: undefined, configSource: 'venue' }
      return red.config
    },
    updateVenuePaymentConfigByVenueId: async (venueId: string, configId: string, data: Record<string, unknown>) => {
      red.updates.push([venueId, configId, data])
      return red.config
    },
    deleteVenuePaymentConfigByVenueId: async () => {},
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'SUPERADMIN' }, getVenueBySlug: () => red.venue }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('react-router-dom', async original => ({
  ...(await original<typeof import('react-router-dom')>()),
  useParams: () => ({ slug: 'mi-negocio' }),
}))
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es', changeLanguage: () => {} } }),
}))
vi.mock('../../Superadmin/components/merchant-accounts/PaymentSetupWizard', () => ({ PaymentSetupWizard: () => null }))

import VenuePaymentConfig from '../VenuePaymentConfig'

const cuenta = (id: string, nombre: string) => ({ id, displayName: nombre, provider: { name: 'Blumon' } })
const heredada = {
  id: 'cfg-org',
  organizationId: 'o1',
  configSource: 'organization',
  primaryAccountId: 'acc-org-1',
  secondaryAccountId: 'acc-org-2',
  tertiaryAccountId: null,
  preferredProcessor: 'AUTO',
  primaryAccount: cuenta('acc-org-1', 'Cuenta de la org'),
  secondaryAccount: cuenta('acc-org-2', 'Respaldo de la org'),
  tertiaryAccount: null,
}

let client: QueryClient
function pintar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VenuePaymentConfig />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const abrirAvanzada = () => fireEvent.click(screen.getByText('Configuración Avanzada'))

beforeEach(() => {
  red.creates.length = 0
  red.updates.length = 0
  red.lecturasDeCostos = 0
  red.lecturasDeTarifas = 0
})
afterEach(() => {
  cleanup()
  client?.clear()
})

describe('Configuración de Pagos · heredada de la organización', () => {
  it('lo dice, no ofrece «Eliminar» y el botón es «Crear configuración propia»', async () => {
    red.config = heredada
    pintar()
    expect(await screen.findByText('venuePaymentConfig.inheritedTitle')).toBeInTheDocument()
    expect(screen.getByText('venuePaymentConfig.inheritedBadge')).toBeInTheDocument()
    abrirAvanzada()
    expect(await screen.findByText('venuePaymentConfig.inheritedCreateOwn')).toBeInTheDocument()
    expect(screen.queryByText('Eliminar Configuración')).not.toBeInTheDocument()
    expect(screen.queryByText('Modificar Cuentas')).not.toBeInTheDocument()
  })

  it('guardar CREA la propia con las cuentas que se ven (no PUT) y vuelve a leer costos y tarifas', async () => {
    red.config = heredada
    pintar()
    await screen.findByText('venuePaymentConfig.inheritedTitle')
    await waitFor(() => expect(red.lecturasDeCostos).toBe(1))
    // Como si antes se hubiera abierto «Resumen de Ventas» con la cuenta heredada (sin `gcTime` la caché sin pantalla se borra).
    client.setQueryDefaults(['venueMerchantAccounts'], { gcTime: Infinity })
    client.setQueryDefaults(['venueSettlementInfo'], { gcTime: Infinity })
    client.setQueryData(['venueMerchantAccounts', 'v1'], [{ id: 'acc-org-1' }])
    client.setQueryData(['venueSettlementInfo', 'v1'], { primaryAccountId: 'acc-org-1' })
    const costosAntes = red.lecturasDeCostos
    const tarifasAntes = red.lecturasDeTarifas

    fireEvent.click(screen.getByText('Cuenta de la org'))
    expect(await screen.findByText('venuePaymentConfig.inheritedDialogTitle')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common:save' }))
    })

    await waitFor(() => expect(red.creates).toHaveLength(1))
    expect(red.updates).toHaveLength(0)
    expect(red.creates[0][0]).toBe('v1')
    expect(red.creates[0][1]).toMatchObject({ primaryAccountId: 'acc-org-1', secondaryAccountId: 'acc-org-2', tertiaryAccountId: null })
    await waitFor(() => expect(red.lecturasDeCostos).toBeGreaterThan(costosAntes))
    expect(red.lecturasDeTarifas).toBeGreaterThan(tarifasAntes)
    // Lo que «Resumen de Ventas» guardó de la cuenta anterior queda vencido (Codex r2).
    for (const clave of [
      ['venueMerchantAccounts', 'v1'],
      ['venueSettlementInfo', 'v1'],
    ])
      expect(client.getQueryState(clave)?.isInvalidated).toBe(true)
    // Ya es del negocio: el aviso de heredada se va.
    await waitFor(() => expect(screen.queryByText('venuePaymentConfig.inheritedTitle')).not.toBeInTheDocument())
  })
})

describe('Configuración de Pagos · propia del negocio (regresión)', () => {
  it('sin aviso, con «Eliminar», y guardar actualiza con PUT', async () => {
    red.config = { ...heredada, id: 'cfg-venue', venueId: 'v1', organizationId: undefined, configSource: 'venue' }
    pintar()
    await screen.findByText('Cuenta de la org')
    expect(screen.queryByText('venuePaymentConfig.inheritedTitle')).not.toBeInTheDocument()
    abrirAvanzada()
    expect(await screen.findByText('Eliminar Configuración')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cuenta de la org'))
    expect(await screen.findByText('venuePaymentConfig.editConfig')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common:save' }))
    })
    await waitFor(() => expect(red.updates).toHaveLength(1))
    expect(red.creates).toHaveLength(0)
    expect(red.updates[0].slice(0, 2)).toEqual(['v1', 'cfg-venue'])
  })
})
