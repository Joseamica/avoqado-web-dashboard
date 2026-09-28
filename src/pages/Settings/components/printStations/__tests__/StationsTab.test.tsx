import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import type { PrintStation, PrintStationsConfig } from '@/services/printStations.service'
import { StationsTab } from '../StationsTab'

const h = vi.hoisted(() => ({
  config: { stations: [], kitchenDisplayOpenToClients: true } as unknown as PrintStationsConfig,
  role: 'OWNER' as string,
  hasAccess: true,
  setMock: vi.fn(),
}))

vi.mock('@/services/printStations.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/printStations.service')>()),
  getPrintStationsConfig: () => Promise.resolve(h.config),
  getPrinters: () => Promise.resolve([]),
  setPrintStationKitchenDisplay: (...a: unknown[]) => h.setMock(...a),
}))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => p === 'printers:manage', role: h.role }),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: h.hasAccess, requiredTier: 'PRO', isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/alpha' }) }))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (k: string) => k }) }))

const cocina: PrintStation = {
  id: 's1',
  venueId: 'v1',
  name: 'Cocina',
  printerId: 'p1',
  copies: 1,
  isDefault: true,
  isPacking: false,
  hasKitchenDisplay: false,
  active: true,
  displayOrder: 0,
  printer: { id: 'p1', name: 'Epson Cocina', active: true, lastStatus: null },
}
const barra: PrintStation = { ...cocina, id: 's2', name: 'Barra', printerId: null, printer: null, isDefault: false, displayOrder: 1 }

beforeAll(async () => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  h.config = { stations: [cocina, barra], kitchenDisplayOpenToClients: true }
  h.role = 'OWNER'
  h.hasAccess = true
  h.setMock.mockReset()
})

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StationsTab venueId="v1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StationsTab — tarjetas por estación (diseño A)', () => {
  it('una tarjeta por estación: a dónde imprime y a dónde llega su comanda', async () => {
    pintar()
    const tarjetaCocina = await screen.findByTestId('station-card-s1')
    expect(within(tarjetaCocina).getByText('Imprime en Epson Cocina')).toBeInTheDocument()
    expect(within(tarjetaCocina).getByText('Llega a: Papel')).toBeInTheDocument()
    const tarjetaBarra = screen.getByTestId('station-card-s2')
    expect(within(tarjetaBarra).getByText(/Sin impresora propia/)).toBeInTheDocument()
    expect(within(tarjetaBarra).getByText('Llega a: Papel en la caja')).toBeInTheDocument()
  })

  it('después del lanzamiento, con Pro, cada tarjeta trae su casilla de pantalla', async () => {
    pintar()
    expect(await screen.findAllByRole('switch', { name: /Pantalla de cocina de/ })).toHaveLength(2)
  })

  it('antes del lanzamiento el dueño no ve ninguna casilla de pantalla', async () => {
    h.config = { stations: [cocina, barra], kitchenDisplayOpenToClients: false }
    pintar()
    await screen.findByTestId('station-card-s1')
    expect(screen.queryByRole('switch', { name: /Pantalla de cocina de/ })).not.toBeInTheDocument()
  })

  it('bajó de plan con la pantalla prendida: la tarjeta no promete la pantalla', async () => {
    h.hasAccess = false
    h.config = { stations: [{ ...cocina, hasKitchenDisplay: true }], kitchenDisplayOpenToClients: true }
    pintar()
    const tarjeta = await screen.findByTestId('station-card-s1')
    expect(within(tarjeta).getByText('Llega a: Papel')).toBeInTheDocument()
  })

  it('el panel de superadmin de la etapa 1 ya no existe', async () => {
    h.role = 'SUPERADMIN'
    pintar()
    await screen.findByTestId('station-card-s1')
    expect(screen.queryByText(/Pantalla de cocina · Superadmin/)).not.toBeInTheDocument()
  })

  it('una estación nueva pide guardarla antes de prender su pantalla', async () => {
    pintar()
    await screen.findByTestId('station-card-s1')
    await userEvent.click(screen.getByRole('button', { name: /Agregar estación/ }))
    expect(await screen.findByText('Guarda la estación para poder prender su pantalla de cocina.')).toBeInTheDocument()
  })

  it('prender la pantalla desde el formulario: el formulario y la tarjeta la ven prendida sin cerrar', async () => {
    h.setMock.mockImplementation(async (_venueId: string, stationId: string, enabled: boolean) => {
      h.config = {
        ...h.config,
        stations: h.config.stations.map(s => (s.id === stationId ? { ...s, hasKitchenDisplay: enabled } : s)),
      }
      return {}
    })
    pintar()
    const tarjeta = await screen.findByTestId('station-card-s2')
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Editar' }))
    // FullScreenModal repite el título en un `<h2>` y en su descripción sr-only: se apunta al heading para no ambigüar.
    expect(await screen.findByRole('heading', { name: 'Editar estación' })).toBeInTheDocument()
    // `hidden: true`: el formulario es un Radix Dialog modal y marca el fondo (la tarjeta) con aria-hidden.
    const casillas = screen.getAllByRole('switch', { name: 'Pantalla de cocina de Barra', hidden: true })
    expect(casillas.length).toBe(2) // la de la tarjeta y la del formulario (la del formulario va al final: portal)
    await userEvent.click(casillas[casillas.length - 1])
    await userEvent.click(screen.getByRole('button', { name: 'Prender pantalla' }))
    await waitFor(() =>
      screen
        .getAllByRole('switch', { name: 'Pantalla de cocina de Barra', hidden: true })
        .forEach(s => expect(s).toBeChecked()),
    )
    expect(screen.getByRole('heading', { name: 'Editar estación' })).toBeInTheDocument()
  })
})
