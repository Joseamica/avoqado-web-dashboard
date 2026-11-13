/**
 * «Asignar cuenta a venue» con la configuración HEREDADA de la organización (encargo e12dc4, 13-nov-2026).
 *
 * El venue no tiene configuración propia: el SERVIDOR le devuelve la de su organización con `configSource: 'organization'`.
 * Antes la pantalla mandaba un PUT (que fallaba: esa fila no es del venue). Ahora avisa que es heredada y CREA la propia del
 * venue con las mismas cuentas de la organización y la nueva en la posición elegida. Con una propia, sigue el PUT de siempre.
 * La pantalla y TanStack son de verdad: sólo se fingen los servicios.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  creates: [] as Array<Record<string, unknown>>,
  updates: [] as Array<[string, Record<string, unknown>]>,
  avisos: [] as Array<{ title?: string; variant?: string }>,
}))

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (t: { title?: string }) => red.avisos.push(t) }) }))

vi.mock('@/services/paymentProvider.service', () => ({
  paymentProviderAPI: {
    getVenueConfigsByMerchantAccount: async () => [],
    getVenuePaymentConfig: async () => red.config,
    updateVenuePaymentConfig: async (venueId: string, data: Record<string, unknown>) => {
      red.updates.push([venueId, data])
      return { id: 'cfg-venue' }
    },
    createVenuePaymentConfig: async (data: Record<string, unknown>) => {
      red.creates.push(data)
      return { id: 'cfg-nueva' }
    },
  },
}))
vi.mock('@/services/superadmin.service', () => ({
  getAllVenues: async () => [{ id: 'v1', name: 'Venue Uno', slug: 'venue-uno', status: 'ACTIVE' }],
}))
// Radix no abre su menú en jsdom: los selectores van como <select> nativos.
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { AssignAccountToVenueDialog } from '../AssignAccountToVenueDialog'

const cuenta = { id: 'acc-nueva', displayName: 'Cuenta nueva', provider: { code: 'BLUMON', name: 'Blumon' } } as never

const configDeLaOrganizacion = {
  id: 'cfg-org',
  organizationId: 'o1',
  configSource: 'organization',
  primaryAccountId: 'acc-org-1',
  secondaryAccountId: 'acc-org-2',
  tertiaryAccountId: null,
  primaryAccount: { id: 'acc-org-1', displayName: 'Cuenta org 1' },
  secondaryAccount: { id: 'acc-org-2', displayName: 'Cuenta org 2' },
  tertiaryAccount: null,
}

async function abrirElegirVenue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AssignAccountToVenueDialog open onOpenChange={() => {}} account={cuenta} />
    </QueryClientProvider>,
  )
  const [venue] = await screen.findAllByRole('combobox')
  await screen.findByRole('option', { name: 'v1' })
  fireEvent.change(venue, { target: { value: 'v1' } })
}

async function asignar() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))
  })
}

describe('AssignAccountToVenueDialog · configuración heredada de la organización', () => {
  beforeEach(() => {
    red.config = null
    red.creates.length = 0
    red.updates.length = 0
    red.avisos.length = 0
  })

  it('heredada: lo dice y CREA la propia del venue con las cuentas de la organización y la nueva en su posición', async () => {
    red.config = configDeLaOrganizacion
    await abrirElegirVenue()
    expect(await screen.findByText(/usa la configuración de su organización \(heredada\)/)).toBeInTheDocument()

    await asignar()

    await waitFor(() => expect(red.creates).toHaveLength(1))
    expect(red.updates).toHaveLength(0)
    expect(red.creates[0]).toMatchObject({
      venueId: 'v1',
      primaryAccountId: 'acc-nueva',
      secondaryAccountId: 'acc-org-2',
    })
    expect(red.creates[0]).not.toHaveProperty('tertiaryAccountId')
    // El candado recibe lo que la pantalla vio: las cuentas heredadas.
    expect(red.creates[0].positionConfirmations).toEqual({
      PRIMARY: { previousAccountId: 'acc-org-1' },
      SECONDARY: { previousAccountId: 'acc-org-2' },
      TERTIARY: { previousAccountId: null },
    })
    await waitFor(() => expect(red.avisos.map(a => a.title)).toEqual(['Asignación exitosa']))
  })

  // Regresión: con configuración propia sigue el PUT de siempre y no sale el aviso de heredada.
  it('propia del venue: sigue actualizando con PUT y sin aviso de heredada', async () => {
    red.config = { ...configDeLaOrganizacion, id: 'cfg-venue', venueId: 'v1', organizationId: undefined, configSource: 'venue' }
    await abrirElegirVenue()
    expect(await screen.findByText('Este slot está ocupado')).toBeInTheDocument()
    expect(screen.queryByText(/\(heredada\)/)).not.toBeInTheDocument()

    await asignar()

    await waitFor(() => expect(red.updates).toHaveLength(1))
    expect(red.creates).toHaveLength(0)
    expect(red.updates[0][0]).toBe('v1')
    expect(red.updates[0][1]).toMatchObject({ primaryAccountId: 'acc-nueva' })
  })
})
