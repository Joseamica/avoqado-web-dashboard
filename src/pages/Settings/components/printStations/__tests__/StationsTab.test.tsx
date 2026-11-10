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
  createMock: vi.fn(),
  updateMock: vi.fn(),
  toast: vi.fn(),
  configShouldError: false,
}))

vi.mock('@/services/printStations.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/printStations.service')>()),
  getPrintStationsConfig: () => (h.configShouldError ? Promise.reject(new Error('network')) : Promise.resolve(h.config)),
  getPrinters: () => Promise.resolve([]),
  setPrintStationKitchenDisplay: (...a: unknown[]) => h.setMock(...a),
  createPrintStation: (...a: unknown[]) => h.createMock(...a),
  updatePrintStation: (...a: unknown[]) => h.updateMock(...a),
  getRouting: () =>
    Promise.resolve({
      categories: [],
      products: [{ id: 'pr1', name: 'Taco', categoryId: null, printStationId: null }],
      unroutedCategories: 0,
      hasDefault: true,
    }),
}))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => p === 'printers:manage', role: h.role }),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: h.hasAccess, requiredTier: 'PRO', isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/alpha' }) }))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (k: string) => k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }), toast: h.toast }))

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
const tienda: PrintStation = { ...barra, id: 's3', name: 'Tienda', sendsComanda: false, displayOrder: 2 }
const AVISO_CAJAS_VIEJAS = /Las cajas sin actualizar siguen mandando la comanda de estos productos\./

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
  h.createMock.mockReset()
  h.createMock.mockResolvedValue({})
  h.updateMock.mockReset()
  h.updateMock.mockResolvedValue({})
  h.toast.mockReset()
  h.configShouldError = false
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

  it('sólo pantalla: no dice que imprime en la caja, dice que el papel es respaldo', async () => {
    h.config = { stations: [cocina, { ...barra, hasKitchenDisplay: true }], kitchenDisplayOpenToClients: true }
    pintar()
    const tarjeta = await screen.findByTestId('station-card-s2')
    expect(within(tarjeta).getByText('Sin impresora propia: sale en papel sólo si la pantalla no contesta')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Llega a: Pantalla')).toBeInTheDocument()
  })

  it('una estación inactiva no promete destino: no recibe comandas', async () => {
    h.config = { stations: [cocina, { ...barra, hasKitchenDisplay: true, active: false }], kitchenDisplayOpenToClients: true }
    pintar()
    const tarjeta = await screen.findByTestId('station-card-s2')
    expect(within(tarjeta).getByText('No recibe comandas')).toBeInTheDocument()
    expect(within(tarjeta).queryByText(/Llega a:/)).not.toBeInTheDocument()
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
      screen.getAllByRole('switch', { name: 'Pantalla de cocina de Barra', hidden: true }).forEach(s => expect(s).toBeChecked()),
    )
    expect(screen.getByRole('heading', { name: 'Editar estación' })).toBeInTheDocument()
  })

  it('«Probar» abre el simulador sobre las estaciones del negocio', async () => {
    pintar()
    await screen.findByTestId('station-card-s1')
    await userEvent.click(screen.getByRole('button', { name: 'Probar' }))
    expect(await screen.findByText('Simular una comanda')).toBeInTheDocument()
  })

  // M-3: un fallo de red al cargar se ve distinto de «aún no hay estaciones» — y se puede reintentar.
  it('M-3: un error al cargar se distingue del vacío y permite reintentar', async () => {
    h.configShouldError = true
    pintar()
    expect(await screen.findByText('No se pudieron cargar las estaciones')).toBeInTheDocument()
    expect(screen.queryByText('Aún no hay estaciones. Crea la primera para empezar a rutear comandas.')).not.toBeInTheDocument()

    h.configShouldError = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('station-card-s1')).toBeInTheDocument()
  })

  // M-9: con cero estaciones «Probar» aparece deshabilitado — debe decir por qué.
  it('M-9: «Probar» deshabilitado explica por qué', async () => {
    h.config = { stations: [], kitchenDisplayOpenToClients: true }
    pintar()
    await screen.findByText('Aún no hay estaciones. Crea la primera para empezar a rutear comandas.')
    const boton = screen.getByRole('button', { name: 'Probar' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'Crea una estación primero')
  })
})

describe('StationsTab — estación «No lleva comanda»', () => {
  const abrirAlta = async () => {
    pintar()
    await screen.findByTestId('station-card-s1')
    await userEvent.click(screen.getByRole('button', { name: /Agregar estación/ }))
    await screen.findByRole('heading', { name: 'Nueva estación' })
  }
  const abrirEdicion = async (id: string) => {
    pintar()
    const tarjeta = await screen.findByTestId(`station-card-${id}`)
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Editar' }))
    await screen.findByRole('heading', { name: 'Editar estación' })
  }
  const camposDeComanda = () => [
    screen.queryByText('Impresora'),
    screen.queryByLabelText('Copias por comanda'),
    screen.queryByText('Estación por defecto'),
    screen.queryByText('Aquí se empaca'),
  ]

  it('crear_no_lleva_comanda_esconde_campos_y_manda_false', async () => {
    await abrirAlta()
    await userEvent.type(screen.getByLabelText('Nombre de la estación'), 'Tienda')
    camposDeComanda().forEach(campo => expect(campo).toBeInTheDocument())

    await userEvent.click(screen.getByRole('switch', { name: 'No lleva comanda' }))
    camposDeComanda().forEach(campo => expect(campo).not.toBeInTheDocument())
    expect(screen.queryByText('Guarda la estación para poder prender su pantalla de cocina.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(h.createMock).toHaveBeenCalledTimes(1))
    // Exacto: sin printerId, copies, isPacking ni isDefault (el servidor responde 400 si llegan).
    expect(h.createMock.mock.calls[0]).toStrictEqual(['v1', { name: 'Tienda', sendsComanda: false }])
  })

  it('crear una estación normal no manda sendsComanda (un servidor viejo lo rechazaría)', async () => {
    await abrirAlta()
    await userEvent.type(screen.getByLabelText('Nombre de la estación'), 'Cocina fría')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(h.createMock).toHaveBeenCalledTimes(1))
    expect(h.createMock.mock.calls[0][1]).toStrictEqual({
      name: 'Cocina fría',
      printerId: null,
      copies: 1,
      isDefault: false,
      isPacking: false,
    })
  })

  it('editar_sin_comanda_no_ofrece_impresora_ni_cambia_tipo', async () => {
    h.config = { stations: [cocina, barra, tienda], kitchenDisplayOpenToClients: true }
    await abrirEdicion('s3')
    expect(screen.getByText('Sin comanda · el tipo no se cambia; para quitarla, bórrala')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'No lleva comanda', hidden: true })).not.toBeInTheDocument()
    camposDeComanda().forEach(campo => expect(campo).not.toBeInTheDocument())
    // Ni en el formulario ni en la tarjeta: una estación sin comanda no tiene pantalla de cocina.
    expect(screen.queryByRole('switch', { name: 'Pantalla de cocina de Tienda', hidden: true })).not.toBeInTheDocument()

    const nombre = screen.getByLabelText('Nombre de la estación')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Abarrotes')
    await userEvent.click(screen.getByRole('switch', { name: 'Estación activa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(h.updateMock).toHaveBeenCalledTimes(1))
    expect(h.updateMock.mock.calls[0]).toStrictEqual(['v1', 's3', { name: 'Abarrotes', active: false }])
  })

  it('editar_normal_no_muestra_interruptor', async () => {
    await abrirEdicion('s1')
    expect(screen.queryByRole('switch', { name: 'No lleva comanda' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sin comanda · el tipo no se cambia; para quitarla, bórrala')).not.toBeInTheDocument()
    camposDeComanda().forEach(campo => expect(campo).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(h.updateMock).toHaveBeenCalledTimes(1))
    expect(h.updateMock.mock.calls[0][2]).toStrictEqual({
      name: 'Cocina',
      printerId: 'p1',
      copies: 1,
      isDefault: true,
      isPacking: false,
      active: true,
    })
  })

  it('estacion_sin_comanda_insignia_y_sin_pantalla', async () => {
    h.config = { stations: [cocina, tienda], kitchenDisplayOpenToClients: true }
    pintar()
    const tarjeta = await screen.findByTestId('station-card-s3')
    expect(within(tarjeta).getByText('Sin comanda')).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('switch', { name: /Pantalla de cocina de/ })).not.toBeInTheDocument()
    // La tarjeta no promete papel en la caja ni un destino que no existe.
    expect(within(tarjeta).queryByText(/Sin impresora propia/)).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText(/Llega a:/)).not.toBeInTheDocument()
    // La estación normal sigue igual.
    const normal = screen.getByTestId('station-card-s1')
    expect(within(normal).getByRole('switch', { name: 'Pantalla de cocina de Cocina' })).toBeInTheDocument()
    expect(within(normal).queryByText('Sin comanda')).not.toBeInTheDocument()
  })

  it('muestra_aviso_de_cajas_sin_actualizar', async () => {
    h.config = { stations: [cocina, barra, tienda], kitchenDisplayOpenToClients: true }
    await abrirAlta()
    expect(screen.getByText(AVISO_CAJAS_VIEJAS)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    const tarjeta = await screen.findByTestId('station-card-s3')
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Editar' }))
    await screen.findByRole('heading', { name: 'Editar estación' })
    expect(screen.getByText(AVISO_CAJAS_VIEJAS)).toBeInTheDocument()
  })

  it('un 400 ESTACION_SIN_COMANDA_INCOMPATIBLE se muestra con el mensaje del servidor', async () => {
    h.createMock.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'ESTACION_SIN_COMANDA_INCOMPATIBLE', message: 'Una estación sin comanda no lleva impresora.' },
      },
    })
    await abrirAlta()
    await userEvent.type(screen.getByLabelText('Nombre de la estación'), 'Tienda')
    await userEvent.click(screen.getByRole('switch', { name: 'No lleva comanda' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Una estación sin comanda no lleva impresora.', variant: 'destructive' }),
      ),
    )
  })
})
