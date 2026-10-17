import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const q = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/hooks/use-gift-cards', () => ({ GIFT_CARDS_FEATURE: 'GIFT_CARDS', useGiftCardSettings: () => q.current }))
const access = vi.hoisted(() => ({ allowed: ['giftCards:read', 'giftCards:manage'] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// FeatureGate tiene su propia prueba; aquí sólo importa QUÉ queda dentro del cartel y con qué código.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: ReactNode }) => (
    <div data-testid="feature-gate" data-feature={feature}>
      {children}
    </div>
  ),
}))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('../components/giftCards/GiftCardsSwitch', () => ({ GiftCardsSwitch: () => <p>switch</p> }))
vi.mock('../components/giftCards/GiftCardRulesForm', () => ({ GiftCardRulesForm: () => <p>reglas</p> }))

import GiftCardSettings from '../GiftCardSettings'

const DATA = { enabled: false, hasCards: false, updatedAt: null }
const listo = (data: Record<string, unknown>) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
})
const fallido = (error: unknown, refetch = vi.fn()) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  isFetching: false,
  error,
  refetch,
})

beforeEach(() => {
  access.allowed = ['giftCards:read', 'giftCards:manage']
  q.current = listo(DATA)
})

describe('Configuración › Tarjetas de regalo', () => {
  it('apagado ⇒ la página entera vive dentro de <FeatureGate feature="GIFT_CARDS"> (sin plan se ve borrosa con el cartel)', () => {
    render(<GiftCardSettings />)
    expect(screen.getByTestId('feature-gate')).toHaveAttribute('data-feature', 'GIFT_CARDS')
    expect(screen.getByText('switch')).toBeInTheDocument()
    expect(screen.getByText('reglas')).toBeInTheDocument()
  })

  it('prendido ⇒ nunca detrás del cartel, aunque haya bajado de plan (la página explica y deja apagar)', () => {
    q.current = listo({ ...DATA, enabled: true })
    render(<GiftCardSettings />)
    expect(screen.queryByTestId('feature-gate')).not.toBeInTheDocument()
    expect(screen.getByText('switch')).toBeInTheDocument()
  })

  it('cargando ⇒ sin cartel y sin formulario', () => {
    q.current = { data: undefined, isLoading: true, isError: false, isFetching: true, error: null, refetch: vi.fn() }
    render(<GiftCardSettings />)
    expect(screen.queryByTestId('feature-gate')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('un error se dice con «Reintentar» (nunca un formulario vacío)', () => {
    const refetch = vi.fn()
    // Con `code`: el texto es del módulo y viene en español (nota 12).
    q.current = fallido({ response: { data: { code: 'ERROR_CON_CODIGO', message: 'Se cayó' } } }, refetch)
    render(<GiftCardSettings />)
    expect(screen.getByText('Se cayó')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'page.retry' }))
    expect(refetch).toHaveBeenCalled()
    expect(screen.queryByText('reglas')).not.toBeInTheDocument()
  })

  it('un error sin `code` (401/500 en inglés) se dice con el texto genérico, nunca el crudo (nota 12)', () => {
    q.current = fallido({ response: { status: 500, data: { message: 'Internal server error' } } })
    render(<GiftCardSettings />)
    expect(screen.getByText('errors.generic')).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
  })

  it('sin giftCards:manage ⇒ aviso de sólo lectura', () => {
    access.allowed = ['giftCards:read']
    render(<GiftCardSettings />)
    expect(screen.getByText('settings.readOnly')).toBeInTheDocument()
  })
})
