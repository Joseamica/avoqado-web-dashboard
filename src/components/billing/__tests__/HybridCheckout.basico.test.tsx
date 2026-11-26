/**
 * «Ver ofertas» y el Básico retirado por la versión del editor (planes editables, B2, b2-r8 #8 y b2-r9 #6 y #9).
 *
 * 🔴 Lo que fija:
 *  - el enlace al Básico (`definition.basicPlan === true`) cuyo detalle dice `purchaseAvailable: false` no se antepone ni se
 *    elige; cualquier OTRA oferta deshabilitada se sigue anteponiendo con el botón apagado, como hoy;
 *  - la lista, el detalle y la restauración del carrito se vuelven a leer al abrirse (una lectura de hace menos de 60 s en la
 *    caché ya no basta), y nada se elige ni se revisa con la lectura vieja.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hybridBilling, type HybridOffer } from '@/services/hybridBilling.service'
import { saveHybridDraft } from '@/lib/hybridIntent'
import { HybridCheckout } from '../HybridCheckout'

vi.mock('@/services/hybridBilling.service', () => ({
  hybridBilling: Object.fromEntries(
    ['offers', 'offer', 'current', 'purchase', 'quote', 'accept', 'resume', 'cancel', 'replacements'].map(k => [k, vi.fn()]),
  ),
}))
vi.mock('@/api', () => ({
  getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }),
  subscribeToConnection: () => () => {},
}))
vi.mock('../FeatureCatalogBrowser', () => ({ FeatureCatalogBrowser: () => <div>Full catalog</div> }))
vi.mock('react-i18next', async () => {
  const { default: d } = await import('@/locales/en/billing.json')
  return {
    useTranslation: () => ({
      i18n: { language: 'en' },
      t: (k: string, p: Record<string, unknown> = {}) =>
        String(k.split('.').reduce((v: any, s) => v?.[s], d) ?? k).replace(/\{\{(\w+)\}\}/g, (_, s) => String(p[s])),
    }),
  }
})

const terms = {
  currency: 'MXN',
  interval: 'MONTHLY',
  price: 578.84,
  taxIncluded: true,
  promotionCycles: null,
  renewal: { kind: 'SAME_PRICE' },
} as const

function basico(purchaseAvailable: boolean): HybridOffer {
  return {
    id: 'pub_basico',
    name: 'Plan Básico',
    slug: 'plan-basico',
    definition: { schemaVersion: 1, kind: 'FEATURES', featureCodes: ['RESERVATIONS'], basicPlan: true, terms } as HybridOffer['definition'],
    includedFeatureCodes: ['RESERVATIONS'],
    purchaseAvailable,
    placesRemaining: null,
    endsAt: null,
  }
}

const OTRA: HybridOffer = {
  id: 'pub_otra',
  name: 'Invoicing',
  slug: 'invoicing',
  definition: { schemaVersion: 1, kind: 'FEATURES', featureCodes: ['CFDI'], terms },
  includedFeatureCodes: ['CFDI'],
  purchaseAvailable: true,
  placesRemaining: 5,
  endsAt: '2030-01-01T00:00:00.000Z',
}

const pagina = (items: HybridOffer[]) => ({ items, total: items.length, page: 1, pageSize: 6 })

/** Una tarjeta de oferta por su nombre. */
const tarjetaDe = (nombre: string) => screen.queryByRole('heading', { name: nombre })?.closest('article') ?? null

function nuevoCliente() {
  // gcTime por defecto (5 min): lo que se leyó sigue en la caché al cerrar y volver a abrir, como en la app.
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function montar(client: QueryClient, initialSlug?: string) {
  return render(
    <QueryClientProvider client={client}>
      <HybridCheckout venueId="venue" initialSlug={initialSlug} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  })
  vi.mocked(hybridBilling.offers)
    .mockReset()
    .mockResolvedValue(pagina([OTRA]) as any)
  vi.mocked(hybridBilling.offer).mockReset()
  vi.mocked(hybridBilling.current).mockReset().mockResolvedValue(null)
  vi.mocked(hybridBilling.replacements)
    .mockReset()
    .mockResolvedValue({ items: [], total: 0, standaloneFeatureCodes: ['CHATBOT'] })
})

describe('HybridCheckout — el Básico retirado por la versión del editor', () => {
  it('🔴 b2-r8 #8 (el caso de Codex): un enlace guardado al Básico (definition.basicPlan true) cuyo detalle dice purchaseAvailable false → no se antepone a la lista ni se puede elegir; con purchaseAvailable true, como hoy', async () => {
    vi.mocked(hybridBilling.offer).mockResolvedValue(basico(false))
    const retirado = montar(nuevoCliente(), 'plan-basico')
    expect(await screen.findByRole('heading', { name: 'Invoicing' })).toBeInTheDocument()
    await waitFor(() => expect(hybridBilling.offer).toHaveBeenCalledWith('plan-basico', expect.anything()))
    // Apagado se dice: el enlace ya no está disponible.
    expect(
      await screen.findByText('This campaign has ended or is unavailable. Your selection remains available to review.'),
    ).toBeInTheDocument()
    expect(tarjetaDe('Plan Básico')).toBeNull()
    expect(screen.queryByText('From your link')).not.toBeInTheDocument()
    retirado.unmount()

    // Con el Básico a la venta: se antepone con «De tu enlace» y se puede agregar, como hoy.
    vi.mocked(hybridBilling.offer).mockResolvedValue(basico(true))
    montar(nuevoCliente(), 'plan-basico')
    await waitFor(() => expect(tarjetaDe('Plan Básico')).not.toBeNull())
    const tarjeta = tarjetaDe('Plan Básico')!
    expect(within(tarjeta).getByText('From your link')).toBeInTheDocument()
    await waitFor(() => expect(within(tarjeta).getByRole('button', { name: 'Add offer' })).toBeEnabled())
  })

  it('🔴 b2-r9 #9 (el caso de Codex, sin versión del editor): el enlace a una promoción normal deshabilitada (purchaseAvailable false, sin basicPlan) que no sale en la página de la lista → se antepone y su botón está apagado, como hoy', async () => {
    const promocion: HybridOffer = { ...OTRA, id: 'pub_promo', name: 'Promo pausada', slug: 'promo-pausada', purchaseAvailable: false }
    vi.mocked(hybridBilling.offer).mockResolvedValue(promocion)
    montar(nuevoCliente(), 'promo-pausada')
    await waitFor(() => expect(tarjetaDe('Promo pausada')).not.toBeNull())
    const tarjeta = tarjetaDe('Promo pausada')!
    expect(within(tarjeta).getByText('From your link')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'Add offer' })).toBeDisabled()
    // Y se antepone a la lista: va primero.
    const titulos = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(titulos.slice(0, 2)).toEqual(['Promo pausada', 'Invoicing'])
  })

  it('🔴 b2-r9 #6 (el caso de Codex): con el mismo QueryClient, se abre con el detalle y la lista del Básico disponibles (en la caché); el servidor pasa a responder purchaseAvailable false (se publica la v2); se cierra y se vuelve a abrir antes de 60 s → se vuelven a pedir los dos, el Básico no se antepone y no se puede elegir', async () => {
    const client = nuevoCliente()
    vi.mocked(hybridBilling.offer).mockResolvedValue(basico(true))
    vi.mocked(hybridBilling.offers).mockResolvedValue(pagina([basico(true), OTRA]) as any)
    const primera = montar(client, 'plan-basico')
    await waitFor(() => expect(within(tarjetaDe('Plan Básico')!).getByRole('button', { name: 'Add offer' })).toBeEnabled())
    primera.unmount()

    // Se publica la v2: el detalle dice que el Básico ya no se compra y la lista ya no lo trae. Las respuestas tardan.
    let soltarDetalle: (o: HybridOffer) => void = () => {}
    let soltarLista: (p: unknown) => void = () => {}
    vi.mocked(hybridBilling.offer).mockImplementation(() => new Promise(r => (soltarDetalle = r)))
    vi.mocked(hybridBilling.offers).mockImplementation(() => new Promise(r => (soltarLista = r)) as any)
    montar(client, 'plan-basico')

    // Se vuelven a pedir los dos al abrir, aunque la caché tenga menos de 60 s.
    await waitFor(() => expect(hybridBilling.offer).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(hybridBilling.offers).toHaveBeenCalledTimes(2))
    // Mientras se lee, la lectura vieja que se ve no deja elegir.
    const vieja = tarjetaDe('Plan Básico')
    expect(vieja).not.toBeNull()
    expect(within(vieja!).getByRole('button', { name: 'Add offer' })).toBeDisabled()

    soltarDetalle(basico(false))
    soltarLista(pagina([OTRA]))
    await waitFor(() => expect(tarjetaDe('Plan Básico')).toBeNull())
    await waitFor(() => expect(within(tarjetaDe('Invoicing')!).getByRole('button', { name: 'Add offer' })).toBeEnabled())
  })

  it('🔴 b2-r9 #6: un carrito guardado con el Básico y su lectura vieja en la caché; al abrir, la restauración vuelve a leer el detalle (purchaseAvailable false) y el Básico no vuelve al carrito', async () => {
    const client = nuevoCliente()
    saveHybridDraft('venue', { lines: [{ id: 'pub_basico', slug: 'plan-basico', codes: [] }], replace: [], drop: [] })
    vi.mocked(hybridBilling.offer).mockResolvedValue(basico(true))
    const primera = montar(client)
    // La primera vez se restaura: el Básico está en el carrito.
    expect(await screen.findByRole('heading', { name: 'Your selection' })).toBeInTheDocument()
    primera.unmount()

    vi.mocked(hybridBilling.offer).mockResolvedValue(basico(false))
    const user = userEvent.setup()
    montar(client)
    await waitFor(() => expect(hybridBilling.offer).toHaveBeenCalledTimes(2))
    // La lectura fresca dice que cambió: no se restaura con la vieja.
    expect(
      await screen.findByText(
        'An offer in your saved selection changed or is no longer available. Retry or select again before requesting a quote.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your selection' })).not.toBeInTheDocument()
    // «Volver» deja elegir de nuevo, sin el Básico en el carrito.
    await user.click(screen.getByRole('button', { name: 'Change selection' }))
    await screen.findByRole('heading', { name: 'Invoicing' })
    expect(screen.queryByRole('heading', { name: 'Your selection' })).not.toBeInTheDocument()
  })
})
