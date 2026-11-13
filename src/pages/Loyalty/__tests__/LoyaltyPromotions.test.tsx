import { act, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import commonEs from '@/locales/es/common.json'
import loyaltyEs from '@/locales/es/loyalty.json'
import type { LoyaltyConfig, LoyaltyPromotion, LoyaltyPromotionStatus } from '@/types/customer'
import LoyaltyPromotions from '../LoyaltyPromotions'

/**
 * La página con el servidor fingido. Funciones normales en los mocks (no `vi.fn()`): la config trae `mockReset: true`.
 * El estado de cada prueba vive en `h`.
 */
const h = vi.hoisted(() => ({
  puedeEditar: true,
  config: null as unknown,
  listas: {} as Record<string, unknown>,
  terminadas: [] as string[],
  terminarFalla: false,
  toasts: [] as Array<{ title?: string; description?: string; variant?: string }>,
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'cvenue000000000000000000', fullBasePath: '/venues/cafe' }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatDate: (d: string) => d }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (t: (typeof h.toasts)[number]) => h.toasts.push(t) }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) => (
    <>{h.puedeEditar ? children : fallback}</>
  ),
}))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('@/services/loyalty.service', () => ({ default: { getConfig: async () => h.config } }))
vi.mock('@/services/loyaltyPromotion.service', () => ({
  loyaltyPromotionService: {
    list: async (_v: string, p: { status: LoyaltyPromotionStatus }) => h.listas[p.status] ?? { items: [], total: 0, page: 1, pageSize: 20 },
    create: () => new Promise(() => {}),
    update: () => new Promise(() => {}),
    end: async (_v: string, id: string) => {
      h.terminadas.push(id)
      if (h.terminarFalla) throw { response: { data: { message: 'La promoción no existe' } } }
      return {}
    },
  },
}))

const CONFIG: LoyaltyConfig = {
  id: 'ccfg0000000000000000000000',
  venueId: 'cvenue000000000000000000',
  pointsPerDollar: 1,
  pointsPerVisit: 0,
  redemptionRate: 0.01,
  minPointsRedeem: 100,
  pointsExpireDays: null,
  active: true,
  stampsEnabled: true,
  stampsRequired: 10,
  maxStampsPerDay: 1,
  stampRewardType: 'FREE_PRODUCT',
  stampRewardValue: null,
  stampRewardProductId: null,
  stampRewardLabel: 'Café gratis',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const programada: LoyaltyPromotion = {
  id: 'cpromo00000000000000000000',
  name: 'Buen Fin',
  kind: 'MULTIPLY',
  multiplier: 2,
  extraStamps: null,
  extraPoints: null,
  status: 'SCHEDULED',
  startsAt: '2099-11-13T06:00:00.000Z',
  endsAt: null,
  endedAt: null,
  startDate: '2099-11-13',
  endDate: null,
  daysOfWeek: [],
  timeFrom: null,
  timeUntil: null,
  productIds: [],
  categoryIds: [],
  products: [],
  categories: [],
  minSpend: null,
  limit: 'NONE',
  createdAt: '2026-11-12T18:00:00.000Z',
  updatedAt: '2026-11-12T18:00:00.000Z',
}

async function pintar() {
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng: 'es',
    ns: ['loyalty', 'common'],
    defaultNS: 'loyalty',
    resources: { es: { loyalty: loyaltyEs, common: commonEs } },
    interpolation: { escapeValue: false },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <LoyaltyPromotions />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

beforeEach(() => {
  h.puedeEditar = true
  h.config = CONFIG
  h.listas = {}
  h.terminadas = []
  h.terminarFalla = false
  h.toasts = []
})

describe('LoyaltyPromotions', () => {
  it('con el programa apagado, los dos botones llevan a Lealtad, donde está el interruptor', async () => {
    h.config = { ...CONFIG, active: false }
    await pintar()
    const aviso = await screen.findByTestId('loyalty-promo-program-off')
    expect(within(aviso).getByRole('link', { name: 'Prender sellos' })).toHaveAttribute('href', '/venues/cafe/loyalty')
    expect(within(aviso).getByRole('link', { name: 'Prender puntos' })).toHaveAttribute('href', '/venues/cafe/loyalty')
  })

  it('con el programa prendido pero sin sellos ni puntos, «Prender sellos» lleva a la tarjeta digital', async () => {
    h.config = { ...CONFIG, stampsEnabled: false, pointsPerDollar: 0 }
    await pintar()
    const aviso = await screen.findByTestId('loyalty-promo-program-off')
    expect(within(aviso).getByRole('link', { name: 'Prender sellos' })).toHaveAttribute('href', '/venues/cafe/loyalty/card')
    expect(within(aviso).getByRole('link', { name: 'Prender puntos' })).toHaveAttribute('href', '/venues/cafe/loyalty')
  })

  it('vacío: «Crea una…» sólo a quien puede crear; a los demás, una frase neutra', async () => {
    await pintar()
    expect(await screen.findByText(/^Crea una para dar el doble/)).toBeInTheDocument()
  })

  it('vacío sin permiso de editar: no le pide crear', async () => {
    h.puedeEditar = false
    await pintar()
    expect(await screen.findByText('Aún no tienes promociones de lealtad')).toBeInTheDocument()
    expect(screen.queryByText(/^Crea una/)).not.toBeInTheDocument()
    expect(screen.getByText('Cuando alguien con permiso cree una, aparecerá aquí.')).toBeInTheDocument()
  })

  it('si «Terminar ahora» falla, el aviso dice que no se pudo terminar, con el mensaje del servidor', async () => {
    h.listas = { SCHEDULED: { items: [programada], total: 1, page: 1, pageSize: 20 } }
    h.terminarFalla = true
    await pintar()
    const fila = await screen.findByRole('button', { name: 'Terminar ahora' })
    act(() => fila.click())
    act(() => within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Terminar ahora' }).click())
    await waitFor(() => expect(h.toasts).toHaveLength(1))
    expect(h.toasts[0]).toMatchObject({
      title: 'No se pudo terminar la promoción',
      description: 'La promoción no existe',
      variant: 'destructive',
    })
  })

  it('dos clics en el mismo instante en «Terminar ahora» la terminan UNA vez', async () => {
    h.listas = { SCHEDULED: { items: [programada], total: 1, page: 1, pageSize: 20 } }
    await pintar()
    const fila = await screen.findByRole('button', { name: 'Terminar ahora' })
    act(() => fila.click())
    const confirmar = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Terminar ahora' })
    act(() => {
      confirmar.click()
      confirmar.click()
    })
    await waitFor(() => expect(h.toasts).toHaveLength(1))
    expect(h.terminadas).toEqual([programada.id])
  })
})
