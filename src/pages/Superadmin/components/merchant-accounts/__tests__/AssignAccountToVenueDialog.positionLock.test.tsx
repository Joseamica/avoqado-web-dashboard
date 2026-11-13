/**
 * Candado de posiciones (tarifa al comercio, paso 1) en «Asignar cuenta a venue»: el primer envío lleva las cuentas que la
 * pantalla tiene a la vista; si el SERVIDOR contesta 400 `CONFIRMAR_POSICION`, sale el diálogo y, al confirmar, se reenvía
 * la MISMA petición con la huella de la tarifa y las terminales. Cancelar no reenvía ni muestra un error.
 * La pantalla, el diálogo y TanStack son de verdad: sólo se fingen los servicios.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => ({
  updates: [] as Array<[string, Record<string, unknown>]>,
  respuestas: [] as Array<'candado' | 'ok'>,
  avisos: [] as Array<{ title?: string; variant?: string }>,
}))

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (t: { title?: string }) => red.avisos.push(t) }) }))

vi.mock('@/services/paymentProvider.service', () => ({
  paymentProviderAPI: {
    getVenueConfigsByMerchantAccount: async () => [],
    getVenuePaymentConfig: async () => ({
      id: 'cfg-1',
      venueId: 'v1',
      primaryAccountId: 'acc-vieja',
      secondaryAccountId: null,
      tertiaryAccountId: null,
      primaryAccount: { id: 'acc-vieja', displayName: 'Cuenta vieja' },
      secondaryAccount: null,
      tertiaryAccount: null,
    }),
    updateVenuePaymentConfig: async (venueId: string, data: Record<string, unknown>) => {
      red.updates.push([venueId, data])
      if (red.respuestas.shift() === 'candado') throw errorDelCandado()
      return { id: 'cfg-1' }
    },
    createVenuePaymentConfig: async () => ({ id: 'cfg-1' }),
  },
}))
vi.mock('@/services/superadmin.service', () => ({
  getAllVenues: async () => [{ id: 'v1', name: 'Venue Uno', slug: 'venue-uno', status: 'ACTIVE' }],
}))
// Radix no abre su menú en jsdom: los selectores van como <select> nativos.
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

import { AssignAccountToVenueDialog } from '../AssignAccountToVenueDialog'

function errorDelCandado() {
  return new AxiosError('400', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {
      code: 'CONFIRMAR_POSICION',
      message: 'Antes de guardar, confirma la tarifa que tendrá la cuenta y las terminales que usan esta posición.',
      details: {
        positions: [
          {
            slot: 'PRIMARY',
            label: 'Principal',
            accountChanges: true,
            currentAccount: { id: 'acc-vieja', name: 'Cuenta vieja', providerCode: 'BLUMON' },
            nextAccount: { id: 'acc-nueva', name: 'Cuenta nueva', providerCode: 'BLUMON' },
            pricing: {
              id: 'pr-1',
              source: 'venue',
              effectiveFrom: '2026-01-01T06:00:00.000Z',
              debitRate: 0.025,
              creditRate: 0.03,
              amexRate: 0.035,
              internationalRate: 0.04,
              includesTax: true,
              taxRate: 0.16,
              fixedFeePerTransaction: null,
              monthlyServiceFee: null,
            },
            pricingFingerprint: 'huella-1',
            inheritingTerminals: { total: 2, byBrand: { PAX: 2 }, losingAccount: 0 },
            needs: { previousAccountId: true, nextAccountId: false, rate: true, inheritingTerminals: true },
            problems: ['FALTA_TARIFA', 'FALTA_TERMINALES'],
          },
        ],
      },
    },
  })
}

const cuenta = { id: 'acc-nueva', displayName: 'Cuenta nueva', provider: { code: 'BLUMON', name: 'Blumon' } } as never

async function abrirYAsignar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AssignAccountToVenueDialog open onOpenChange={() => {}} account={cuenta} />
    </QueryClientProvider>,
  )
  const [venue] = await screen.findAllByRole('combobox')
  await screen.findByRole('option', { name: 'v1' })
  fireEvent.change(venue, { target: { value: 'v1' } })
  // El aviso de siempre se queda: la posición Principal ya tiene otra cuenta.
  expect(await screen.findByText('Este slot está ocupado')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }))
  })
}

describe('AssignAccountToVenueDialog · candado de posiciones', () => {
  beforeEach(() => {
    red.updates.length = 0
    red.respuestas.length = 0
    red.avisos.length = 0
  })

  it('400 del candado ⇒ diálogo; al confirmar se reenvía la misma petición con tarifa y terminales confirmadas', async () => {
    red.respuestas.push('candado', 'ok')
    await abrirYAsignar()

    // Con el diálogo abierto, Radix esconde el de «Asignar» a los lectores (aria-hidden): los roles son sólo los del candado.
    expect(await screen.findByText('Confirma el cambio de cuenta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tarifas del negocio' })).toHaveAttribute('href', '/venues/venue-uno/payment-config')
    fireEvent.click(screen.getByLabelText('La tarifa es la correcta'))
    fireEvent.click(screen.getByLabelText('Entiendo lo de las terminales'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('position-confirm-ok'))
    })

    await waitFor(() => expect(red.updates).toHaveLength(2))
    expect(red.updates[0]).toEqual([
      'v1',
      {
        primaryAccountId: 'acc-nueva',
        positionConfirmations: {
          PRIMARY: { previousAccountId: 'acc-vieja' },
          SECONDARY: { previousAccountId: null },
          TERTIARY: { previousAccountId: null },
        },
      },
    ])
    expect(red.updates[1][1].positionConfirmations).toEqual({
      PRIMARY: { previousAccountId: 'acc-vieja', rate: { mode: 'KEEP', fingerprint: 'huella-1' }, inheritingTerminals: 2 },
      SECONDARY: { previousAccountId: null },
      TERTIARY: { previousAccountId: null },
    })
    await waitFor(() => expect(red.avisos.map(a => a.title)).toEqual(['Asignación exitosa']))
  })

  it('cancelar el diálogo no reenvía ni muestra un error', async () => {
    red.respuestas.push('candado')
    await abrirYAsignar()

    expect(await screen.findByText('Confirma el cambio de cuenta')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    })

    await waitFor(() => expect(screen.queryByText('Confirma el cambio de cuenta')).not.toBeInTheDocument())
    expect(red.updates).toHaveLength(1)
    expect(red.avisos).toEqual([])
  })
})
