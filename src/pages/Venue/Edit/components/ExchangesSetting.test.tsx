import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExchangesSetting, StoreCreditSetting } from './ExchangesSetting'
import es from '@/locales/es/venue.json'

const mockPut = vi.fn()
const mockToast = vi.fn()
const mockCan = vi.fn()
vi.mock('@/api', () => ({ default: { put: (...args: unknown[]) => mockPut(...args) } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: mockCan }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').reduce((value: any, part) => value?.[part], es) ?? key }),
}))

function renderSetting(effective = false) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const view = render(
    <QueryClientProvider client={client}>
      <ExchangesSetting venueId="venue-1" effective={effective} />
    </QueryClientProvider>,
  )
  return { ...view, invalidate }
}

describe('ExchangesSetting', () => {
  beforeEach(() => {
    mockCan.mockImplementation((permission: string) => permission === 'venues:update')
    mockPut.mockResolvedValue({ data: {} })
  })

  it.each([false, true])('renders the effective value and its explanation (%s)', effective => {
    renderSetting(effective)
    expect(screen.getByRole('switch', { name: 'Cambios de producto' })).toHaveAttribute('aria-checked', String(effective))
    expect(
      screen.getByText(
        effective
          ? 'Las cajeras pueden cambiar la talla o el producto de una venta ya cobrada desde el POS.'
          : 'El botón "Cambio" no aparece en el POS.',
      ),
    ).toBeInTheDocument()
  })

  it.each([false, true])('toggling sends PUT settings and invalidates get-venue-data (%s)', effective => {
    const { invalidate } = renderSetting(effective)
    fireEvent.click(screen.getByRole('switch'))
    return waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', { exchangesEnabled: !effective })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['get-venue-data', 'venue-1'] })
    })
  })

  it('rolls back and shows the server message on error', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 400, data: { message: 'No se pudo guardar este ajuste.' } } })
    renderSetting()
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'No se pudo guardar este ajuste.', variant: 'destructive' }),
      ),
    )
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('shows a dedicated permission message for 403', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 403, data: {} } })
    renderSetting()
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'No tienes permiso para cambiar esta configuración.' }),
      ),
    )
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('is read-only without venues:update', () => {
    mockCan.mockReturnValue(false)
    renderSetting()
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('switch'))
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('blocks repeated toggles while saving', async () => {
    mockPut.mockReturnValue(new Promise(() => {}))
    renderSetting()
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))
  })
})

describe('StoreCreditSetting', () => {
  beforeEach(() => {
    mockCan.mockImplementation((permission: string) => permission === 'venues:update')
    mockPut.mockResolvedValue({ data: {} })
  })
  const renderCredit = (props: { storeCreditOnly?: boolean; available?: boolean }) => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    return render(
      <QueryClientProvider client={client}>
        <StoreCreditSetting venueId="venue-1" storeCreditOnly={props.storeCreditOnly ?? false} available={props.available as boolean} />
      </QueryClientProvider>,
    )
  }

  it('available: shows the texts and a usable switch', () => {
    renderCredit({ available: true })
    expect(screen.getByText('Saldo a favor')).toBeInTheDocument()
    expect(screen.getByText(/ya no podrás devolver dinero sin la venta original/)).toBeInTheDocument()
    expect(screen.getByText('Defecto y cobro por error siempre se devuelven como se pagó')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Sólo saldo a favor' })).toBeEnabled()
    expect(screen.queryByText('Pide a Avoqado que active el saldo a favor')).not.toBeInTheDocument()
  })

  it.each([false, undefined])('unavailable (%s): shown, greyed out with the reason, no PUT', available => {
    renderCredit({ available })
    expect(screen.getByText('Saldo a favor')).toBeInTheDocument()
    expect(screen.getByText('Pide a Avoqado que active el saldo a favor')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('switch'))
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('D-1: prendido en el servidor pero SIN llaves: se ve prendido, se puede apagar y no se puede volver a prender', async () => {
    const a = renderCredit({ available: false, storeCreditOnly: true })
    const sw = screen.getByRole('switch')
    expect(sw).toBeChecked()
    expect(sw).toBeEnabled()
    expect(screen.getByText('Pide a Avoqado que active el saldo a favor')).toBeInTheDocument()
    fireEvent.click(sw)
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', { storeCreditOnly: false }))
    a.unmount()
    mockPut.mockClear()
    renderCredit({ available: false, storeCreditOnly: false })
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('switch'))
    expect(mockPut).not.toHaveBeenCalled()
  })

  it.each([false, true])('toggling sends PUT with storeCreditOnly (%s)', async only => {
    renderCredit({ available: true, storeCreditOnly: only })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/settings', { storeCreditOnly: !only }),
    )
  })

  it('rolls back on error', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 403, data: {} } })
    renderCredit({ available: true })
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
    expect(screen.getByRole('switch')).not.toBeChecked()
  })
})
