/**
 * «Activa tus cobros» reducida a lo que no viene en los documentos (founder, 26-sep): la dirección del
 * local y el acceso a subir los documentos. Nada de CLABE, banco, tipo de persona, RFC ni CURP.
 *
 * 🔴 La prueba que más importa es la del cuerpo: la versión anterior mandaba el SUBTIPO de persona
 * («SA_DE_CV») y el servidor lo rechazaba siempre, llevándose la dirección con él.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const get = vi.fn()
const updateProfile = vi.fn()
const navigate = vi.fn()

vi.mock('@/services/paymentActivation.service', () => ({
  paymentActivationService: { get: (...a: unknown[]) => get(...a), updateProfile: (...a: unknown[]) => updateProfile(...a) },
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue_1', fullBasePath: '/venues/hyper' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/components/address-autocomplete', () => ({
  // Como el componente REAL con Google cargado: teclear NO pasa por `onAddressSelect` (eso sólo ocurre al
  // elegir una sugerencia); lo tecleado sale por `onTextChange`. Así fallaba en el navegador: la calle se
  // veía escrita y la pantalla decía «escribe la dirección completa».
  AddressAutocomplete: ({ value, onTextChange }: { value: string; onTextChange?: (t: string) => void }) => {
    const [texto, setTexto] = React.useState(value)
    React.useEffect(() => setTexto(value), [value])
    return (
      <input
        aria-label="calle"
        value={texto}
        onChange={e => {
          setTexto(e.target.value)
          onTextChange?.(e.target.value)
        }}
      />
    )
  },
}))
const tEstable = (k: string, o?: any) => (typeof o?.defaultValue === 'string' ? o.defaultValue : k)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: tEstable }) }))

import PaymentActivationPage from '../PaymentActivationPage'

function estado(over: { venueAddress?: Record<string, string>; venueAddressPresent?: boolean; missing?: string[] } = {}) {
  return {
    data: {
      data: {
        profile: { venueAddressPresent: over.venueAddressPresent ?? false, venueAddress: over.venueAddress },
        documents: {
          required: ['ine', 'rfc', 'comprobanteDomicilio', 'caratulaBancaria'],
          uploaded: [],
          missing: over.missing ?? ['ine', 'rfc', 'comprobanteDomicilio', 'caratulaBancaria'],
        },
      },
    },
  }
}

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PaymentActivationPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  get.mockReset().mockResolvedValue(estado())
  updateProfile.mockReset().mockResolvedValue({})
  navigate.mockReset()
})

describe('«Activa tus cobros» sólo pide lo que no viene en los documentos', () => {
  it('no pide CLABE, banco, tipo de persona, RFC, CURP ni nombre comercial', async () => {
    pintar()
    await screen.findByText('Dirección de tu local')
    for (const pedido of [/CLABE/i, /Banco/i, /tipo de entidad/i, /RFC/, /CURP/, /Nombre comercial/i, /Titular/i]) {
      expect(screen.queryByLabelText(pedido)).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText(pedido)).not.toBeInTheDocument()
    }
  })

  it('🔴 guardar manda SÓLO la dirección: nunca el tipo de persona que el servidor rechazaba', async () => {
    const user = userEvent.setup()
    pintar()
    await user.type(await screen.findByLabelText('calle'), 'Av. Juárez 10')
    await user.type(screen.getByLabelText('Ciudad'), 'Querétaro')
    await user.type(screen.getByLabelText('Estado'), 'Querétaro')
    await user.type(screen.getByLabelText('Código postal'), '76000')
    await user.click(screen.getByRole('button', { name: 'Guardar dirección' }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1))
    expect(updateProfile).toHaveBeenCalledWith('venue_1', {
      venueAddress: { address: 'Av. Juárez 10', city: 'Querétaro', state: 'Querétaro', zipCode: '76000' },
    })
  })

  it('una dirección incompleta no se manda y dice qué falta', async () => {
    const user = userEvent.setup()
    pintar()
    await user.type(await screen.findByLabelText('calle'), 'Av. Juárez 10')
    await user.click(screen.getByRole('button', { name: 'Guardar dirección' }))
    expect(await screen.findByText('Escribe la dirección completa de tu local')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('si ya la había capturado, la dirección aparece llena (no se teclea dos veces)', async () => {
    get.mockResolvedValue(
      estado({ venueAddressPresent: true, venueAddress: { address: 'Av. Juárez 10', city: 'Querétaro', state: 'Qro', zipCode: '76000' } }),
    )
    pintar()
    await waitFor(() => expect(screen.getByLabelText('calle')).toHaveValue('Av. Juárez 10'))
    expect(screen.getByLabelText('Código postal')).toHaveValue('76000')
  })

  it('enumera los documentos y el botón lleva a subirlos', async () => {
    get.mockResolvedValue(estado({ missing: ['caratulaBancaria'] }))
    const user = userEvent.setup()
    pintar()
    expect(await screen.findByText('Falta lo más importante: tus documentos')).toBeInTheDocument()
    expect(screen.getByTestId('payment-activation-docs').querySelectorAll('li')).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: /Subir mis documentos/ }))
    expect(navigate).toHaveBeenCalledWith('/venues/hyper/settings/local/documents')
  })

  it('con los cuatro documentos arriba, lo dice y el botón pasa a «Ver mis documentos»', async () => {
    get.mockResolvedValue(estado({ missing: [] }))
    pintar()
    expect(await screen.findByText('Ya tenemos tus documentos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver mis documentos/ })).toBeInTheDocument()
  })
})
