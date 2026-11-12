import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import loyaltyEs from '@/locales/es/loyalty.json'
import WalletCardDesigner from '../WalletCardDesigner'

const m = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  maxStampsPerDay: 1 as number,
  venue: { venueId: 'v1', venueSlug: 'mi-negocio', fullBasePath: '/venues/mi-negocio', venue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City' } },
}))
vi.mock('@/api', () => ({ default: { get: m.get, put: m.put, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => m.venue }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('../components/CounterPosterCard', () => ({ default: () => null }))
vi.mock('../components/WalletCardPreview', () => ({ WalletCardPreview: () => null }))
vi.mock('@/firebase', () => ({ storage: {}, buildStoragePath: (p: string) => p }))

async function pintar(maxStampsPerDay: number) {
  m.get.mockReset()
  m.put.mockReset()
  m.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: /loyalty\/config/.test(url)
        ? { active: true, stampsEnabled: true, stampsRequired: 7, stampRewardType: 'FREE_PRODUCT', stampRewardValue: null, stampRewardLabel: 'Café', maxStampsPerDay }
        : { backgroundColor: '#112233', foregroundColor: '#ffffff', labelColor: '#ffffff', stampShape: 'CIRCLE' },
    }),
  )
  m.put.mockResolvedValue({ data: {} })
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({ lng: 'es', ns: ['loyalty'], defaultNS: 'loyalty', resources: { es: { loyalty: loyaltyEs } }, interpolation: { escapeValue: false } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WalletCardDesigner />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return screen.findByLabelText('Visitas con sello por cliente al día') as Promise<HTMLInputElement>
}

describe('Tope diario de sellos', () => {
  it('muestra el valor guardado', async () => {
    const campo = await pintar(3)
    expect(campo.value).toBe('3')
  })

  it('elegir «Sin límite» manda maxStampsPerDay 0', async () => {
    await pintar(1)
    fireEvent.click(screen.getByRole('switch', { name: 'Sin límite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar programa' }))
    await waitFor(() => expect(m.put).toHaveBeenCalled())
    expect(m.put.mock.calls[0][1]).toMatchObject({ maxStampsPerDay: 0, stampsRequired: 7 })
  })

  it('un valor guardado en 0 se ve como «Sin límite»', async () => {
    await pintar(0)
    expect(screen.getByRole('switch', { name: 'Sin límite' })).toBeChecked()
  })
})
