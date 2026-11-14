import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DeliveryChannelLink } from '@/types/delivery'
import { DeliveryPrintingTab } from '../DeliveryPrintingTab'

const h = vi.hoisted(() => ({
  channels: [] as unknown[],
  locked: false,
  manage: true,
  read: true,
  error: false,
  retry: vi.fn(),
  statusArgs: [] as unknown[],
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-delivery-status', () => ({
  useDeliveryStatus: (...a: unknown[]) => {
    h.statusArgs = a
    return {
      state: h.locked ? 'LOCKED' : 'LIVE',
      channels: h.locked ? [] : h.channels,
      activationRequest: null,
      isLoading: false,
      channelsError: h.error,
      retryChannels: h.retry,
    }
  },
}))
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: React.ReactNode }) =>
    h.locked ? <div data-testid="gate">{feature}</div> : <>{children}</>,
}))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({
    can: (p: string) => (p === 'delivery-channels:manage' && h.manage) || (p === 'delivery-channels:read' && h.read),
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/alpha' }) }))
vi.mock('@/pages/Delivery/components/ImpresionDelCanalEditor', () => ({
  ImpresionDelCanalEditor: (p: { channel: { id: string }; canEdit: boolean }) => (
    <div data-testid="editor">{`${p.channel.id}|${p.canEdit}`}</div>
  ),
}))

const ch = (id: string, status: DeliveryChannelLink['status']) => ({ id, status, provider: 'RAPPI' }) as DeliveryChannelLink

const renderTab = () =>
  render(
    <MemoryRouter>
      <DeliveryPrintingTab venueId="v1" />
    </MemoryRouter>,
  )

describe('DeliveryPrintingTab', () => {
  beforeEach(() => {
    h.channels = []
    h.locked = false
    h.manage = true
    h.read = true
    h.error = false
    h.retry.mockClear()
  })

  it('un editor por canal conectado; los desconectados no salen', () => {
    h.channels = [ch('a', 'ACTIVE'), ch('b', 'DISABLED'), ch('c', 'PAUSED'), ch('d', 'PENDING')]
    renderTab()
    expect(screen.getAllByTestId('editor').map(e => e.textContent)).toEqual(['a|true', 'c|true', 'd|true'])
  })

  it('lee los canales con el hook de la página de Delivery (misma llave de consulta)', () => {
    renderTab()
    expect(h.statusArgs).toEqual(['v1'])
  })

  it('sin canales: invita a conectar con liga a Delivery', () => {
    renderTab()
    expect(screen.getByText('impresion.tab.sinCanales')).toBeInTheDocument()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/venues/alpha/delivery')
  })

  it('si falla la carga de canales dice el error con Reintentar, no invita a conectar', () => {
    h.error = true
    renderTab()
    expect(screen.getByText('impresion.tab.errorCanales')).toBeInTheDocument()
    expect(screen.queryByText('impresion.tab.sinCanales')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'impresion.reintentar' }))
    expect(h.retry).toHaveBeenCalledTimes(1)
  })

  it('si falla y no tiene delivery-channels:read, dice que no tiene permiso', () => {
    h.error = true
    h.read = false
    renderTab()
    expect(screen.getByText('impresion.tab.sinPermiso')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('impresion.tab.sinCanales')).toBeNull()
  })

  it('sin el plan DELIVERY_CHANNELS muestra la explicación del plan, no se esconde', () => {
    h.locked = true
    renderTab()
    expect(screen.getByTestId('gate').textContent).toBe('DELIVERY_CHANNELS')
  })

  it('canEdit sale de delivery-channels:manage', () => {
    h.channels = [ch('a', 'ACTIVE')]
    h.manage = false
    renderTab()
    expect(screen.getByTestId('editor').textContent).toBe('a|false')
  })
})
