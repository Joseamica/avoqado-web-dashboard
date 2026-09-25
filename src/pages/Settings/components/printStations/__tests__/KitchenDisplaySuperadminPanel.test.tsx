import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { StaffRole } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { KitchenDisplaySuperadminPanel } from '../KitchenDisplaySuperadminPanel'
import type { PrintStation } from '@/services/printStations.service'

const setMock = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/printStations.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/printStations.service')>()),
  setPrintStationKitchenDisplay: (...a: unknown[]) => setMock(...a),
}))

// Radix pide pointer capture; funciones simples (mockReset borraría un vi.fn).
beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  await i18n.changeLanguage('es')
})

const estacion = (over: Partial<PrintStation> = {}): PrintStation => ({
  id: 's1',
  venueId: 'v1',
  name: 'Cocina',
  printerId: null,
  copies: 1,
  isDefault: true,
  isPacking: false,
  active: true,
  displayOrder: 0,
  hasKitchenDisplay: false,
  printer: null,
  ...over,
})

function pintar(role: StaffRole, stations: PrintStation[] = [estacion()]) {
  vi.mocked(useAuth).mockReturnValue({ staffInfo: { role } } as never)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <KitchenDisplaySuperadminPanel venueId="v1" stations={stations} />
    </QueryClientProvider>,
  )
}

describe('KitchenDisplaySuperadminPanel', () => {
  it('no se pinta para el dueño', () => {
    pintar(StaffRole.OWNER)
    expect(screen.queryByText(/Pantalla de cocina · Superadmin/)).not.toBeInTheDocument()
  })

  it('SUPERADMIN ve el panel con el aviso de que no está lista para clientes', () => {
    pintar(StaffRole.SUPERADMIN)
    expect(screen.getByText(/Pantalla de cocina · Superadmin/)).toBeInTheDocument()
    expect(screen.getByText(/todavía no está lista para clientes/)).toBeInTheDocument()
  })

  it('prender la casilla llama al servicio con venue, estación y true', async () => {
    setMock.mockResolvedValue(estacion({ hasKitchenDisplay: true }))
    pintar(StaffRole.SUPERADMIN)
    await userEvent.click(screen.getByRole('switch', { name: /Cocina/ }))
    await waitFor(() => expect(setMock).toHaveBeenCalledWith('v1', 's1', true))
  })

  it('una estación ya prendida se ve prendida', () => {
    pintar(StaffRole.SUPERADMIN, [estacion({ hasKitchenDisplay: true })])
    expect(screen.getByRole('switch', { name: /Cocina/ })).toHaveAttribute('data-state', 'checked')
  })
})
