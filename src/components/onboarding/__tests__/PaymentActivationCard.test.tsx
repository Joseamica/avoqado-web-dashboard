/**
 * La tarjeta «Activa tus cobros» del Home (§4.2).
 *
 * 🔴 Lo que fija: no se puede DESCARTAR (a diferencia del checklist normal), cada ítem se marca
 * con la respuesta del servidor y no con una casilla local, y la compra de terminal aparece
 * DESHABILITADA con su motivo mientras el KYC no esté enviado (D5) — apagado se ve y se explica,
 * nunca desaparece.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const navigate = vi.fn()
let venueActual: Record<string, unknown> = { role: 'OWNER', kycStatus: 'NOT_SUBMITTED' }

vi.mock('@/services/paymentActivation.service', () => ({ paymentActivationService: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: venueActual.role } }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ fullBasePath: '/venues/mi-negocio', venueId: 'venue_1', venue: venueActual }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => {
      const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
      return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
    },
  }),
}))

import { PaymentActivationCard } from '../PaymentActivationCard'

function respuesta(over: Record<string, unknown> = {}) {
  return {
    data: {
      data: {
        kycStatus: 'NOT_SUBMITTED',
        entityType: null,
        profile: { complete: false, rfcMasked: null, clabeLast4: null, bankName: null, curpPresent: false, legalAddressPresent: false },
        documents: { required: [], uploaded: [] },
        terminalsCount: 0,
        onlinePaymentsConnected: false,
        ...over,
      },
    },
  }
}

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PaymentActivationCard />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  venueActual = { role: 'OWNER', kycStatus: 'NOT_SUBMITTED' }
  get.mockReset().mockResolvedValue(respuesta())
  navigate.mockReset()
  Object.defineProperty(window, 'localStorage', {
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    writable: true,
    configurable: true,
  })
})

describe('cuándo aparece', () => {
  it('con KYC sin verificar y rol OWNER se muestra', async () => {
    pintar()
    expect(await screen.findByText(/Activa tus cobros/i)).toBeInTheDocument()
  })

  it('con el KYC VERIFICADO desaparece: ya no hay nada que activar', async () => {
    venueActual = { role: 'OWNER', kycStatus: 'VERIFIED' }
    get.mockResolvedValue(respuesta({ kycStatus: 'VERIFIED' }))
    const { container } = pintar()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('a un cajero no se le enseña: no es quien captura los datos fiscales', async () => {
    venueActual = { role: 'CASHIER', kycStatus: 'NOT_SUBMITTED' }
    const { container } = pintar()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(get).not.toHaveBeenCalled()
  })

  it('🔴 NO tiene botón de descartar — sin esto el negocio no cobra', async () => {
    pintar()
    await screen.findByText(/Activa tus cobros/i)
    expect(screen.queryByRole('button', { name: /descartar|dismiss|no mostrar/i })).not.toBeInTheDocument()
  })

  it('se puede CONTRAER, que es distinto de descartar', async () => {
    pintar()
    await screen.findByText(/Activa tus cobros/i)
    expect(screen.getByText(/Datos fiscales/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { expanded: true }))
    expect(screen.queryByText(/Datos fiscales/i)).not.toBeInTheDocument()
  })
})

describe('cada ítem se marca con lo que dice el servidor', () => {
  it('el perfil se marca hecho con `profile.complete`, no con un clic', async () => {
    get.mockResolvedValue(respuesta({ profile: { complete: true } }))
    pintar()
    await waitFor(() => expect(screen.getByText(/1 de 4 listos/)).toBeInTheDocument())
  })

  it('los documentos cuentan como hechos cuando el KYC ya está en revisión', async () => {
    get.mockResolvedValue(respuesta({ kycStatus: 'IN_REVIEW' }))
    pintar()
    await waitFor(() => expect(screen.getByText(/1 de 4 listos/)).toBeInTheDocument())
  })

  it('los cobros en línea se marcan con la señal del servidor', async () => {
    get.mockResolvedValue(respuesta({ onlinePaymentsConnected: true }))
    pintar()
    await waitFor(() => expect(screen.getByText(/1 de 4 listos/)).toBeInTheDocument())
  })

  it('la terminal se marca cuando el local ya tiene una', async () => {
    get.mockResolvedValue(respuesta({ kycStatus: 'PENDING_REVIEW', terminalsCount: 1 }))
    pintar()
    await waitFor(() => expect(screen.getByText(/2 de 4 listos/)).toBeInTheDocument())
  })
})

describe('la compra de terminal conserva su candado (D5)', () => {
  it('sin KYC enviado el botón está DESHABILITADO y explicado', async () => {
    pintar()
    await screen.findByText(/Activa tus cobros/i)
    expect(screen.getByText(/Disponible cuando envíes tus documentos/i)).toBeInTheDocument()
    const botones = screen.getAllByRole('button', { name: /Empezar/i })
    expect(botones.some(b => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('con el KYC ya enviado se puede comprar', async () => {
    get.mockResolvedValue(respuesta({ kycStatus: 'PENDING_REVIEW' }))
    pintar()
    await screen.findByText(/Activa tus cobros/i)
    await waitFor(() => expect(screen.queryByText(/Disponible cuando envíes tus documentos/i)).not.toBeInTheDocument())
    const botones = screen.getAllByRole('button', { name: /Empezar/i })
    expect(botones.every(b => !(b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('el primer ítem lleva a «activar-cobros», la pantalla que captura todo', async () => {
    pintar()
    await screen.findByText(/Activa tus cobros/i)
    const fila = screen.getByText(/Datos fiscales/i).closest('li')!
    await userEvent.setup().click(fila.querySelector('button')!)
    expect(navigate).toHaveBeenCalledWith('/venues/mi-negocio/activar-cobros')
  })
})
