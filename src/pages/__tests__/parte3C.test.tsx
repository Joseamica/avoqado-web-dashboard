/**
 * Parte 3-C: pantallas que afirmaban cosas sin haber leído sus datos.
 * La regla de cada fuente está en hastaCeroFalloDeCarga.test.tsx, de donde sale este arnés:
 * la pantalla y TanStack son de verdad; sólo se finge la red (`@/api`) y quién mira.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Ruta = [RegExp, unknown]

const red = vi.hoisted(() => {
  const venue = {
    id: 'v1',
    name: 'Mi negocio',
    slug: 'mi-negocio',
    organizationId: 'o1',
    role: 'OWNER',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    modules: [],
    features: [],
  }
  return {
    rutas: [] as Array<[RegExp, unknown]>,
    caida: null as RegExp | null,
    colgada: null as RegExp | null,
    estatus: 500,
    params: {} as Record<string, string>,
    puede: (() => true) as (permiso: string) => boolean,
    venue,
    t: (k: string, o?: unknown) => (typeof o === 'string' ? o : ((o as { defaultValue?: string } | undefined)?.defaultValue ?? k)),
    cuerpoVacio: { success: true, data: [], items: [], rows: [], events: [], staff: [], venues: [], stores: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string, config?: { params?: Record<string, unknown> }) => {
    const clave = config?.params ? `${url}?${new URLSearchParams(config.params as Record<string, string>)}` : url
    if (red.colgada?.test(clave)) return new Promise(() => {})
    if (red.caida?.test(clave)) throw Object.assign(new Error('caída'), { response: { status: red.estatus, data: {} } })
    const ruta = red.rutas.find(([patron]) => patron.test(clave))
    return { data: ruta ? ruta[1] : red.cuerpoVacio }
  }
  const cliente = { get: responder, post: responder, put: responder, patch: responder, delete: responder, interceptors: { request: { use() {} }, response: { use() {} } } }
  return { default: cliente, publicApi: cliente, getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }), subscribeToConnection: () => () => {} }
})
vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 'u1', role: 'SUPERADMIN', venues: [red.venue] },
    staffInfo: { id: 'u1', role: 'OWNER' },
    isAuthenticated: true,
    isLoading: false,
    activeVenue: red.venue,
    allVenues: [red.venue],
    checkFeatureAccess: () => true,
    checkModuleAccess: () => true,
    getVenueBySlug: () => red.venue,
  }),
}))
vi.mock('@/hooks/use-current-venue', async original => ({
  ...(await original<typeof import('@/hooks/use-current-venue')>()),
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-negocio', venue: red.venue, fullBasePath: '/venues/mi-negocio', basePath: '/venues/mi-negocio', isLoading: false }),
}))
vi.mock('@/hooks/use-access', async original => ({
  ...(await original<typeof import('@/hooks/use-access')>()),
  useAccess: () => ({ role: 'OWNER', can: (p: string) => red.puede(p), canAny: () => true, canAll: () => true, getDataScope: () => 'venue', isLoading: false }),
}))
vi.mock('@/hooks/use-tier-feature-access', async original => ({
  ...(await original<typeof import('@/hooks/use-tier-feature-access')>()),
  useTierFeatureAccess: () => ({ hasAccess: true, isLoading: false, requiredTier: null }),
  useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false }),
}))
vi.mock('@/context/BreadcrumbContext', async original => ({
  ...(await original<typeof import('@/context/BreadcrumbContext')>()),
  useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }),
}))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/pages/Customers/components/WalletPassCard', () => ({ default: () => null, WalletPassCard: () => null }))
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null, isConnected: false }), SocketProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('react-router-dom', async original => ({
  ...(await original<typeof import('react-router-dom')>()),
  useParams: () => red.params,
}))
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: red.t, i18n: { language: 'es', changeLanguage: () => {} } }),
  Trans: () => null,
}))

import SalesReport from '@/pages/playtelecom/Sales/SalesReport'
import OrganizationManagement from '@/pages/Superadmin/OrganizationManagement'
import VenuePricing from '@/pages/Superadmin/VenuePricing'
import TestingPayments from '@/pages/Superadmin/Testing/TestingPayments'
import Profitability from '@/pages/Inventory/Profitability'
import Payments from '@/pages/Payment/Payments'
import GiftCardsPage from '@/pages/GiftCards/GiftCardsPage'
import { IncidentsQueue } from '@/pages/AreaTickets/components/IncidentsQueue'
import { SettlementsQueue } from '@/pages/AreaTickets/components/SettlementsQueue'
import ExternalSettlements from '@/pages/AreaTickets/ExternalSettlements'
import { SendCampaignDialog } from '@/pages/Customers/components/SendCampaignDialog'
import { CreateTransferDialog } from '@/pages/Inventory/InterVenueTransfers/CreateTransferDialog'
import { InvoiceInventoryDialog } from '@/pages/Inventory/PurchaseOrders/components/InvoiceInventoryDialog'
import { QuickPriceEditDialog } from '@/pages/Inventory/components/profitability/QuickPriceEditDialog'
import { GroupExistingDialog } from '@/pages/Menu/Products/components/GroupExistingDialog'
import { StampRewardsSection } from '@/pages/Order/components/StampRewardsSection'
import CatalogItemPage from '@/pages/Organization/MasterCatalog/CatalogItemPage'
import { CreateReservationForm } from '@/pages/Reservations/CreateReservation'
import { EditAvailabilityDialog } from '@/pages/Reservations/components/EditAvailabilityDialog'
import { ReservationStaffConfiguration } from '@/pages/Reservations/components/ReservationStaffConfiguration'
import FloorPlanSettings from '@/pages/Settings/FloorPlan/FloorPlanPage'
import { ServiceCoursesContent } from '@/pages/Settings/ServiceCourses'
import { SimTimelineDrawer } from '@/pages/playtelecom/Organization/StockControl/components/SimTimelineDrawer'
import type { DerivedRow } from '@/pages/Inventory/types/profitability'
import type { PurchaseOrderInvoice } from '@/services/purchaseOrderInvoice.service'
import type { Order } from '@/types'

// Radix los pide y jsdom no los trae.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
} as unknown as typeof IntersectionObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 8_000 })

const SIN_DATOS = 'loadFailure.empty'
const CON_DATOS = 'loadFailure.partial'
const NO_EXISTE = 'loadFailure.notFound'
const seVe = (texto: RegExp | string) => (typeof texto === 'string' ? (document.body.textContent ?? '').includes(texto) : texto.test(document.body.textContent ?? ''))
const unaVueltaAlLazo = () => act(() => new Promise<void>(r => setTimeout(r, 30)))
const reintentar = () => screen.findByRole('button', { name: 'retry' })
const sinBotonDeReintentar = () => expect(screen.queryByRole('button', { name: /retry|reintentar/i })).toBeNull()
const esperando = () => expect(document.querySelector('.animate-pulse, .animate-spin')).not.toBeNull()
const nadaEsperando = () => expect(document.querySelector('.animate-pulse, .animate-spin')).toBeNull()

let client: QueryClient
function pintar(pantalla: ReactElement, opciones: { rutas?: Ruta[]; params?: Record<string, string> } = {}) {
  red.rutas = opciones.rutas ?? []
  red.params = opciones.params ?? {}
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{pantalla}</MemoryRouter>
    </QueryClientProvider>,
  )
}
const sinConsultasEnCamino = () => waitFor(() => expect(client.isFetching()).toBe(0))
async function recargaCaida(patron: RegExp) {
  await sinConsultasEnCamino()
  red.caida = patron
  await act(() => client.refetchQueries().catch(() => undefined))
}
async function recargaEnPausa() {
  await sinConsultasEnCamino()
  onlineManager.setOnline(false)
  void client.refetchQueries()
}
/** Ya falló; al reintentar la red se queda colgada: lo que se ve es el «reintentando». */
function reintentoColgado(patron: RegExp, boton = screen.getByRole('button', { name: 'retry' })) {
  red.caida = null
  red.colgada = patron
  fireEvent.click(boton)
  return unaVueltaAlLazo()
}
const elegirEnSelect = async (trigger: Element, opcion: string | RegExp) => {
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByRole('option', { name: opcion }))
}

beforeEach(() => {
  onlineManager.setOnline(true)
  red.caida = null
  red.colgada = null
  red.estatus = 500
  red.puede = () => true
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

describe('Artículo del catálogo maestro', () => {
  const ARTICULO = /\/items\/i1/
  const REFERENCIAS = /\/catalogs\//
  const ERROR = 'No se pudo cargar el artículo o sus catálogos de referencia.'
  const rutas: Ruta[] = [
    [REFERENCIAS, { success: true, data: { items: [], nextCursor: null } }],
    [
      ARTICULO,
      {
        success: true,
        data: {
          id: 'i1',
          name: 'Café en grano',
          sku: 'CAF-1',
          brand: { id: 'b1', name: 'Marca' },
          manufacturer: { id: 'm1', name: 'Fábrica' },
          family: { id: 'f1', name: 'Familia', parent: { id: 'f0', name: 'Raíz' } },
          businessTypes: ['RESTAURANT'],
          organizationValues: [],
        },
      },
    ],
  ]
  const params = { orgId: 'o1', catalogItemId: 'i1' }

  it('sin internet: el aviso con reintento, no el esqueleto eterno', async () => {
    onlineManager.setOnline(false)
    pintar(<CatalogItemPage />, { rutas, params })
    await screen.findByText(ERROR)
    expect(await reintentar()).toBeInTheDocument()
    nadaEsperando()
  })

  it('caído: ofrece reintentar y al reintentar llega', async () => {
    red.caida = ARTICULO
    pintar(<CatalogItemPage />, { rutas, params })
    fireEvent.click(await reintentar())
    red.caida = null
    fireEvent.click(await reintentar())
    await screen.findByText('Café en grano')
  })

  it('reintentando sin datos: esqueleto, sin el error', async () => {
    red.caida = REFERENCIAS
    pintar(<CatalogItemPage />, { rutas, params })
    await reintentoColgado(REFERENCIAS, await reintentar())
    esperando()
    expect(seVe(ERROR)).toBe(false)
  })

  it('un 404 dice que no existe, sin reintentar', async () => {
    red.caida = ARTICULO
    red.estatus = 404
    pintar(<CatalogItemPage />, { rutas, params })
    await screen.findByText(NO_EXISTE)
    sinBotonDeReintentar()
    expect(seVe(ERROR)).toBe(false)
  })

  it('leído, cae la recarga: el artículo sigue, con aviso', async () => {
    pintar(<CatalogItemPage />, { rutas, params })
    await screen.findByText('Café en grano')
    await recargaCaida(ARTICULO)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Café en grano')).toBeInTheDocument()
  })
})

describe('Enviar campaña', () => {
  const VISTA = /campaigns\/c1\/preview/
  const rutas: Ruta[] = [[VISTA, { totalDestinatarios: 12, token: 't', expiraEn: 'x' }]]
  const abrir = () => pintar(<SendCampaignDialog venueId="v1" campaignId="c1" onClose={() => {}} onSent={() => {}} />, { rutas })
  const CONFIRMAR = 'campaigns.sendDialog.confirm'

  it('sin internet: avisa con reintento, no un diálogo en blanco ni «Enviar a 0»', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText('campaigns.sendDialog.countError')
    expect(await reintentar()).toBeInTheDocument()
    expect(seVe(CONFIRMAR)).toBe(false)
    expect(screen.getByTestId('send-confirm')).toBeDisabled()
  })

  it('caído: ofrece reintentar y al reintentar llega el conteo', async () => {
    red.caida = VISTA
    abrir()
    const boton = await reintentar()
    red.caida = null
    fireEvent.click(boton)
    expect(await screen.findByTestId('send-recipient-count')).toHaveTextContent('12')
    expect(screen.getByTestId('send-confirm')).toBeEnabled()
  })

  it('reintentando sin datos: «contando», sin el error', async () => {
    red.caida = VISTA
    abrir()
    await reintentoColgado(VISTA, await reintentar())
    expect(seVe('campaigns.sendDialog.counting')).toBe(true)
    expect(seVe('campaigns.sendDialog.countError')).toBe(false)
  })

  it('leído, cae la recarga: el conteo sigue, con aviso, y no se puede confirmar', async () => {
    abrir()
    await screen.findByTestId('send-recipient-count')
    await recargaCaida(VISTA)
    await screen.findByText('campaigns.sendDialog.countError')
    expect(screen.getByTestId('send-recipient-count')).toHaveTextContent('12')
    expect(screen.getByTestId('send-confirm')).toBeDisabled()
  })

  it('leído, sin internet: tampoco se confirma un conteo que no se pudo refrescar', async () => {
    abrir()
    await screen.findByTestId('send-recipient-count')
    await recargaEnPausa()
    await screen.findByText('campaigns.sendDialog.countError')
    expect(screen.getByTestId('send-confirm')).toBeDisabled()
  })
})

describe('Tiempos de servicio', () => {
  const TIEMPOS = /service-courses/
  const rutas: Ruta[] = [
    [
      TIEMPOS,
      {
        data: {
          schemaVersion: 1,
          venueId: 'v1',
          venueName: 'Roma',
          organizationId: 'o1',
          organizationName: 'La Mesa',
          source: 'ORGANIZATION',
          revision: 'r1',
          hasOwnConfiguration: false,
          enabled: true,
          courses: [{ id: 'i', label: 'Inmediato', kind: 'IMMEDIATE' }],
          limits: { maxCourses: 32, maxLabelLength: 60 },
        },
      },
    ],
  ]
  const abrir = () => pintar(<ServiceCoursesContent scope={{ kind: 'venue', id: 'v1' }} canManage />, { rutas })

  it('sin internet: avisa con reintento, no una página en blanco', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText('loadError')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('reintentando sin datos: «cargando», sin el error', async () => {
    red.caida = TIEMPOS
    abrir()
    await reintentoColgado(TIEMPOS, await reintentar())
    expect(seVe('loading')).toBe(true)
    expect(seVe('loadError')).toBe(false)
  })

  it('leído, sin internet: lo leído sigue, con aviso', async () => {
    abrir()
    await screen.findByText('La Mesa · Roma')
    await recargaEnPausa()
    await screen.findByText('loadError')
    expect(screen.getByText('La Mesa · Roma')).toBeInTheDocument()
  })

  it('sin permiso: no ofrece reintentar', async () => {
    red.caida = TIEMPOS
    red.estatus = 403
    abrir()
    await screen.findByText('loadError')
    sinBotonDeReintentar()
  })
})

describe('Historial del SIM', () => {
  const EVENTOS = /sim-custody\/events/
  const ERROR = 'No se pudo cargar el historial. Intenta de nuevo.'
  const SIN_EVENTOS = 'Este SIM no tiene eventos registrados todavía.'
  const rutas: Ruta[] = [[EVENTOS, { serialNumber: '89', events: [] }]]
  const abrir = () => pintar(<SimTimelineDrawer open onOpenChange={() => {}} orgId="o1" serialNumber="89" />, { rutas })

  it('sin internet: avisa con reintento, no un panel en blanco', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(ERROR)
    expect(await reintentar()).toBeInTheDocument()
    expect(seVe(SIN_EVENTOS)).toBe(false)
  })

  it('caído: ofrece reintentar y al reintentar llega', async () => {
    red.caida = EVENTOS
    abrir()
    const boton = await reintentar()
    red.caida = null
    fireEvent.click(boton)
    await screen.findByText(SIN_EVENTOS)
    expect(seVe(ERROR)).toBe(false)
  })

  it('reintentando sin datos: el spinner, sin el error', async () => {
    red.caida = EVENTOS
    abrir()
    await reintentoColgado(EVENTOS, await reintentar())
    esperando()
    expect(seVe(ERROR)).toBe(false)
  })
})

describe('Crear reservación: selector de personal', () => {
  const MAPEO = /products\/p1\/staff/
  const EQUIPO = /venues\/v1\/team/
  const rutas: Ruta[] = [
    [MAPEO, { explicit: true, staffVenueIds: [], staff: [] }],
    [/venues\/v1\/products/, [{ id: 'p1', name: 'Corte', active: true, type: 'APPOINTMENTS_SERVICE', duration: 30, price: 100 }]],
    [/reservations\/settings/, { scheduling: { capacityMode: 'per_staff' }, publicBooking: { showStaffPicker: true } }],
    [EQUIPO, { data: [{ id: 's1', firstName: 'Ana', lastName: 'López', email: 'ana@x.mx', active: true }], total: 1 }],
  ]
  const elegirServicio = async () => {
    await sinConsultasEnCamino()
    fireEvent.click(screen.getByPlaceholderText('Buscar servicio por nombre...'))
    fireEvent.click(await screen.findByRole('option', { name: /Corte/ }))
  }

  it('mapeo caído: su error ofrece reintentar', async () => {
    red.caida = MAPEO
    pintar(<CreateReservationForm />, { rutas })
    await elegirServicio()
    await screen.findByText('form.staffMappingLoadError')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('mapeo sin internet: avisa, no un selector vacío en silencio', async () => {
    pintar(<CreateReservationForm />, { rutas })
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    await elegirServicio()
    await screen.findByText('form.staffMappingLoadError')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('equipo caído: lo dice, con reintento', async () => {
    red.caida = EQUIPO
    pintar(<CreateReservationForm />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(await reintentar()).toBeInTheDocument()
  })

  it('equipo sin internet: también lo dice', async () => {
    onlineManager.setOnline(false)
    pintar(<CreateReservationForm />, { rutas })
    await screen.findAllByText(SIN_DATOS)
  })
})

describe('Configuración de personal de reservas', () => {
  const EQUIPO = /venues\/v1\/team/
  const SERVICIOS = /venues\/v1\/products/
  const MAPEO = /reservations\/products\/p1\/staff/
  const HORARIO = /reservations\/staff\/s1\/schedule/
  const rutas: Ruta[] = [
    [MAPEO, { explicit: false, staffVenueIds: [], staff: [] }],
    [HORARIO, { weekly: null, exceptions: [] }],
    [SERVICIOS, [{ id: 'p1', name: 'Corte', active: true, type: 'APPOINTMENTS_SERVICE' }]],
    [EQUIPO, { data: [{ id: 's1', firstName: 'Ana', lastName: 'López', email: 'ana@x.mx', active: true }], total: 1 }],
  ]
  const abrir = () => pintar(<ReservationStaffConfiguration venueId="v1" venueHours={null} />, { rutas })
  const select = (id: string) => document.getElementById(id)
  const elegirServicio = async () => {
    await waitFor(() => expect(select('staff-service')).not.toBeNull())
    await elegirEnSelect(select('staff-service')!, 'Corte')
  }
  const elegirProfesional = async () => {
    await waitFor(() => expect(select('schedule-staff')).not.toBeNull())
    await elegirEnSelect(select('schedule-staff')!, /Ana/)
  }

  it('equipo caído: aviso con reintento, sin selects vacíos que digan que no hay nadie', async () => {
    red.caida = EQUIPO
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(await reintentar()).toBeInTheDocument()
    expect(select('staff-service')).toBeNull()
    expect(select('schedule-staff')).toBeNull()
  })

  it('servicios caídos: aviso; el horario, que no depende de ellos, sigue', async () => {
    red.caida = SERVICIOS
    abrir()
    await screen.findByText(SIN_DATOS)
    await waitFor(() => expect(select('schedule-staff')).not.toBeNull())
    expect(select('staff-service')).toBeNull()
  })

  it('sin internet: los dos avisos, sin spinner ni selects vacíos', async () => {
    onlineManager.setOnline(false)
    abrir()
    expect(await screen.findAllByText(SIN_DATOS)).toHaveLength(2)
    nadaEsperando()
    expect(select('staff-service')).toBeNull()
    expect(select('schedule-staff')).toBeNull()
  })

  it('reintentando sin datos: spinner en la región', async () => {
    red.caida = EQUIPO
    abrir()
    await reintentoColgado(EQUIPO, await reintentar())
    esperando()
    expect(select('schedule-staff')).toBeNull()
  })

  it('leídos, cae la recarga: los selects siguen, con aviso', async () => {
    abrir()
    await waitFor(() => expect(select('staff-service')).not.toBeNull())
    await recargaCaida(EQUIPO)
    await screen.findByText(CON_DATOS)
    expect(select('staff-service')).not.toBeNull()
    expect(select('schedule-staff')).not.toBeNull()
  })

  it('sin permiso: dice su razón, sin aviso ni spinner eterno', async () => {
    red.puede = () => false
    abrir()
    await screen.findByText('settings.staffing.mappingReadPermission')
    nadaEsperando()
    expect(seVe(SIN_DATOS)).toBe(false)
  })

  it('profesionistas de un servicio caídos: su error ofrece reintentar', async () => {
    red.caida = MAPEO
    abrir()
    await elegirServicio()
    await screen.findByText('settings.staffing.mappingLoadError')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('profesionistas de un servicio sin internet: avisa, no una región en blanco', async () => {
    abrir()
    await sinConsultasEnCamino()
    await waitFor(() => expect(select('staff-service')).not.toBeNull())
    onlineManager.setOnline(false)
    await elegirServicio()
    await screen.findByText('settings.staffing.mappingLoadError')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('horario caído: su error ofrece reintentar', async () => {
    red.caida = HORARIO
    abrir()
    await elegirProfesional()
    await screen.findByText('settings.staffing.scheduleLoadError')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('horario sin internet: avisa, no una región en blanco', async () => {
    abrir()
    await sinConsultasEnCamino()
    await waitFor(() => expect(select('schedule-staff')).not.toBeNull())
    onlineManager.setOnline(false)
    await elegirProfesional()
    await screen.findByText('settings.staffing.scheduleLoadError')
    expect(await reintentar()).toBeInTheDocument()
  })
})

describe('Editar disponibilidad', () => {
  const AJUSTES = /reservations\/settings/
  const dia = { enabled: true, ranges: [{ open: '09:00', close: '17:00' }] }
  const rutas: Ruta[] = [
    [AJUSTES, { operatingHours: { monday: dia, tuesday: dia, wednesday: dia, thursday: dia, friday: dia, saturday: dia, sunday: dia } }],
  ]
  const abrir = () => pintar(<EditAvailabilityDialog open onOpenChange={() => {}} />, { rutas })

  it('caído: aviso con reintento, no un spinner eterno', async () => {
    red.caida = AJUSTES
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(await reintentar()).toBeInTheDocument()
    nadaEsperando()
  })

  it('sin internet: lo mismo', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    nadaEsperando()
  })

  it('leído, cae la recarga: los horarios siguen, con aviso', async () => {
    abrir()
    await screen.findByText('Cambio único')
    await recargaCaida(AJUSTES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Cambio único')).toBeInTheDocument()
  })
})

describe('Benchmark de mercado', () => {
  const BENCHMARK = /market-benchmark/
  const ERROR = 'No se pudo generar el benchmark'
  const row = { productId: 'p1', name: 'Latte', category: null, type: 'RECIPE', price: 50, cost: 10, marginPct: 0.8, marginAmount: 40, costPct: 0.2, status: 'EXCELLENT', costDrift: false } as unknown as DerivedRow
  const abrir = () => {
    pintar(<QuickPriceEditDialog open onOpenChange={() => {}} row={row} />, {
      rutas: [[BENCHMARK, { data: { confidence: 'high', medianEstimate: 55, rangeLow: 50, rangeHigh: 60, comparablesFound: 7, cached: false, comparableVenues: [], rationale: '' } }]],
    })
    fireEvent.click(screen.getByRole('button', { name: /Ver benchmark de mercado/ }))
  }

  it('sin internet: avisa con reintento, no un recuadro en blanco', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(ERROR)
    expect(await reintentar()).toBeInTheDocument()
  })

  it('caído: ofrece reintentar y al reintentar llega', async () => {
    red.caida = BENCHMARK
    abrir()
    const boton = await reintentar()
    red.caida = null
    fireEvent.click(boton)
    await waitFor(() => expect(seVe('7 lugares cercanos')).toBe(true))
    expect(seVe(ERROR)).toBe(false)
  })

  it('reintentando sin datos: el spinner, sin el error', async () => {
    red.caida = BENCHMARK
    abrir()
    await reintentoColgado(BENCHMARK, await reintentar())
    expect(seVe('Analizando lugares cercanos')).toBe(true)
    expect(seVe(ERROR)).toBe(false)
  })
})

describe('Recibir factura en inventario', () => {
  const REVISION = /supplier-invoices\/i1\/inventory/
  const ERROR = 'invoices.receipt.loadError'
  const invoice = { id: 'i1', iepsCents: 0 } as PurchaseOrderInvoice
  const rutas: Ruta[] = [
    [
      REVISION,
      { action: 'PREPARE', confirmationToken: 'a', supplier: 'Proveedor Uno', subtotal: '900', total: '1044', iva: '144', ieps: '0', includeIepsInCost: false, lines: [] },
    ],
  ]
  const abrir = () => pintar(<InvoiceInventoryDialog venueId="v1" invoice={invoice} onClose={() => {}} />, { rutas })
  const confirmar = () => screen.getByRole('button', { name: 'invoices.receipt.confirmPrepare' })

  it('sin internet: avisa con reintento, sin decir qué va a pasar con una factura que no leyó', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(ERROR)
    expect(await reintentar()).toBeInTheDocument()
    expect(seVe('invoices.receipt.prepareHint')).toBe(false)
    expect(confirmar()).toBeDisabled()
  })

  it('caído: ofrece reintentar y al reintentar llega', async () => {
    red.caida = REVISION
    abrir()
    const boton = await reintentar()
    red.caida = null
    fireEvent.click(boton)
    await screen.findByText('Proveedor Uno')
    expect(seVe(ERROR)).toBe(false)
  })

  it('reintentando sin datos: «cargando», sin el error', async () => {
    red.caida = REVISION
    abrir()
    await reintentoColgado(REVISION, await reintentar())
    expect(seVe('common:loading')).toBe(true)
    expect(seVe(ERROR)).toBe(false)
  })

  it('leída, sin internet: la revisión sigue, con aviso, y no se confirma', async () => {
    abrir()
    await screen.findByText('Proveedor Uno')
    await recargaEnPausa()
    await screen.findByText(ERROR)
    expect(screen.getByText('Proveedor Uno')).toBeInTheDocument()
    expect(confirmar()).toBeDisabled()
  })
})

describe('Agrupar productos', () => {
  const CATEGORIAS = /menucategories/
  const VISTA = /shopify-proposals\/g1\/preview/
  const inicial = {
    name: 'Tenis',
    optionNames: ['Talla'],
    members: [
      { productId: 'p1', name: 'Tenis 26', sku: 'T26', values: ['26'] },
      { productId: 'p2', name: 'Tenis 27', sku: 'T27', values: ['27'] },
    ],
  }
  const agrupar = () => pintar(<GroupExistingDialog open onClose={() => {}} venueId="v1" inicial={inicial} onDone={() => {}} />, { rutas: [[CATEGORIAS, [{ id: 'c1', name: 'Calzado' }]]] })
  const desdeShopify = () =>
    pintar(
      <GroupExistingDialog open onClose={() => {}} venueId="v1" inicial={inicial} onDone={() => {}} shopify={{ shopifyProductId: 'g1', mode: 'CREATE', groupName: null }} />,
      { rutas: [[CATEGORIAS, [{ id: 'c1', name: 'Calzado' }]]] },
    )

  it('categorías sin internet: avisa con reintento, no un selector vacío en silencio', async () => {
    onlineManager.setOnline(false)
    agrupar()
    await screen.findByText('agrupar.errorCategorias')
    expect(await reintentar()).toBeInTheDocument()
  })

  it('categorías sin permiso: no ofrece reintentar', async () => {
    red.caida = CATEGORIAS
    red.estatus = 403
    agrupar()
    await screen.findByText('agrupar.errorCategorias')
    sinBotonDeReintentar()
  })

  it('categorías leídas, cae la recarga: el selector sigue, con aviso', async () => {
    agrupar()
    await waitFor(() => expect(client.getQueryData(['menu-categories', 'v1'])).toBeDefined())
    await recargaCaida(CATEGORIAS)
    await screen.findByText(CON_DATOS)
    expect(document.querySelector('[data-tour="group-existing-category"] input')).not.toBeNull()
  })

  it('vista previa de Shopify sin internet: avisa con reintento, no en blanco', async () => {
    onlineManager.setOnline(false)
    desdeShopify()
    await screen.findByText('variants:errors.network')
    expect(screen.getAllByRole('button', { name: 'retry' }).length).toBeGreaterThan(0)
  })

  it('vista previa de Shopify reintentando: «preparando», sin el error', async () => {
    red.caida = VISTA
    desdeShopify()
    await screen.findByText('variants:errors.generic')
    await reintentoColgado(VISTA)
    expect(seVe('shopify.cargandoVista')).toBe(true)
    expect(seVe('variants:errors.generic')).toBe(false)
  })

  it('vista previa de Shopify sin permiso: no ofrece reintentar', async () => {
    red.caida = VISTA
    red.estatus = 403
    desdeShopify()
    await screen.findByText('variants:errors.noPermission')
    sinBotonDeReintentar()
  })
})

describe('Cobros externos', () => {
  const AREAS = /area-tickets$/
  const rutas: Ruta[] = [
    [/external-(settlements|incidents)/, { data: { items: [], nextCursor: null } }],
    [AREAS, { data: { areas: [{ id: 'a1', name: 'Cremería' }] } }],
  ]
  const pestanas = () => screen.getAllByRole('tab')

  it('áreas caídas: las colas siguen a la vista, con el aviso y su reintento', async () => {
    red.caida = AREAS
    pintar(<ExternalSettlements />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(await reintentar()).toBeInTheDocument()
    expect(pestanas()).toHaveLength(2)
    expect(seVe('areaTickets.externalSettlements.filters.area')).toBe(true)
  })

  it('áreas sin internet: el filtro vacío no queda sin explicar', async () => {
    onlineManager.setOnline(false)
    pintar(<ExternalSettlements />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(pestanas()).toHaveLength(2)
  })

  it('áreas en camino: las colas no esperan por el filtro', async () => {
    red.colgada = AREAS
    pintar(<ExternalSettlements />, { rutas })
    await unaVueltaAlLazo()
    expect(pestanas()).toHaveLength(2)
    expect(seVe(SIN_DATOS)).toBe(false)
  })

  it('áreas leídas, cae la recarga: las colas siguen, con aviso', async () => {
    pintar(<ExternalSettlements />, { rutas })
    await sinConsultasEnCamino()
    await recargaCaida(AREAS)
    await screen.findByText(CON_DATOS)
    expect(pestanas()).toHaveLength(2)
  })
})

describe('Premios por cobrar en la cuenta', () => {
  const CARTILLA = /stamp-card/
  const ERROR = 'card.redeem.loadError'
  const order = { id: 'o1', paymentStatus: 'PENDING', orderCustomers: [{ isPrimary: true, customerId: 'c1' }] } as unknown as Order
  const conPremio: Ruta[] = [[CARTILLA, { rewardsToClaim: [{ id: 'r1', rewardLabel: 'Café gratis', createdAt: '2026-10-01T12:00:00Z' }] }]]

  it('caído: lo dice con reintento, y al reintentar aparece el premio', async () => {
    red.caida = CARTILLA
    pintar(<StampRewardsSection order={order} />, { rutas: conPremio })
    await screen.findByText(ERROR)
    const boton = await reintentar()
    red.caida = null
    fireEvent.click(boton)
    await screen.findByText('Café gratis')
    expect(seVe(ERROR)).toBe(false)
  })

  it('sin internet: lo dice, no esconde los premios en silencio', async () => {
    onlineManager.setOnline(false)
    pintar(<StampRewardsSection order={order} />, { rutas: conPremio })
    await screen.findByText(ERROR)
  })

  it('leído, cae la recarga: el premio sigue, con aviso', async () => {
    pintar(<StampRewardsSection order={order} />, { rutas: conPremio })
    await screen.findByText('Café gratis')
    await recargaCaida(CARTILLA)
    await screen.findByText(ERROR)
    expect(screen.getByText('Café gratis')).toBeInTheDocument()
  })

  it('sin permiso, o leído y sin premios: la sección no sale', async () => {
    red.caida = CARTILLA
    red.estatus = 403
    pintar(<StampRewardsSection order={order} />)
    await sinConsultasEnCamino()
    await unaVueltaAlLazo()
    expect(seVe(ERROR)).toBe(false)
    cleanup()
    red.caida = null
    pintar(<StampRewardsSection order={order} />, { rutas: [[CARTILLA, { rewardsToClaim: [] }]] })
    await sinConsultasEnCamino()
    await unaVueltaAlLazo()
    expect(seVe(ERROR)).toBe(false)
  })
})

describe('Plano de mesas', () => {
  const PLANO = /floor-plan$/
  const vacio = { fingerprint: '0000000000000000', areas: [], tables: [], elements: [], limits: { areas: 30, tables: 500, elements: 1500 }, overLimit: false }
  const rutas: Ruta[] = [[PLANO, { data: vacio }]]

  it('leído y vacío, cae la recarga: el vacío sigue, con aviso', async () => {
    pintar(<FloorPlanSettings />, { rutas })
    await screen.findByText('page.emptyTitle')
    await recargaCaida(PLANO)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('page.emptyTitle')).toBeInTheDocument()
    expect(seVe('page.loadError')).toBe(false)
  })

  it('reintentando sin datos: esqueleto, sin el error', async () => {
    red.caida = PLANO
    pintar(<FloorPlanSettings />, { rutas })
    await screen.findByText('page.loadError')
    await reintentoColgado(PLANO, screen.getByTestId('floor-plan-retry'))
    expect(screen.getByTestId('floor-plan-loading')).toBeInTheDocument()
    expect(seVe('page.loadError')).toBe(false)
  })
})

describe('Crear transferencia entre sucursales', () => {
  const INSUMOS = /inventory\/raw-materials/
  const rutas: Ruta[] = [[INSUMOS, { data: [] }]]
  const abrir = () => pintar(<CreateTransferDialog open onClose={() => {}} onCreated={() => {}} />, { rutas })

  it('insumos caídos: aviso con reintento en lugar de un select vacío en silencio', async () => {
    red.caida = INSUMOS
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(await reintentar()).toBeInTheDocument()
  })

  it('insumos sin internet: también avisa', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
  })

  it('insumos de origen caídos (modo enviar): también avisa', async () => {
    abrir()
    await sinConsultasEnCamino()
    red.caida = INSUMOS
    await elegirEnSelect(screen.getAllByRole('combobox')[0], 'interVenueTransfers.modes.PUSH')
    await screen.findByText(SIN_DATOS)
  })

  it('leídos, cae la recarga: aviso de que pueden estar viejos', async () => {
    abrir()
    await recargaCaida(INSUMOS)
    await screen.findByText(CON_DATOS)
  })
})

describe('Cobros externos: el filtro «Área» conoce su lectura', () => {
  const fuente = (estado: object) => ({ isError: false, isFetching: false, isPaused: false, error: null, refetch: vi.fn(), ...estado })
  const abrir = async () => fireEvent.click(await screen.findByRole('button', { name: /filters\.area/ }))

  it.each([
    ['Incidencias', IncidentsQueue],
    ['Cobros por confirmar', SettlementsQueue],
  ])('%s: sin leer las áreas no dice «No hay áreas»; leídas y vacías, sí', async (_n, Cola) => {
    red.colgada = /external-/
    pintar(<Cola venueId="v1" areas={[]} areasQuery={fuente({ isError: true, error: new Error('caída') })} />)
    await abrir()
    await screen.findByText('loadFailure.empty')
    expect(document.body.textContent).not.toContain('filters.noAreas')
    cleanup()
    pintar(<Cola venueId="v1" areas={[]} areasQuery={fuente({ data: { areas: [] } })} />)
    await abrir()
    await screen.findByText(/filters\.noAreas/)
  })
})

describe('Tarjetas de regalo: con las lecturas caídas no truena', () => {
  it.each([[500], [403]])('estatus %i', async estatus => {
    red.caida = /gift-cards|giftcards|gift_cards/
    red.estatus = estatus
    pintar(<GiftCardsPage />)
    await screen.findByText('page.settingsError')
    await sinConsultasEnCamino()
  })
})

describe('Lo que encontró el robot en navegador real', () => {
  it('Tarifas de venues: sin leer, aviso y no «No se encontraron venues»', async () => {
    red.caida = /venues/
    pintar(<VenuePricing />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('No se encontraron venues')).toBe(false)
    expect(seVe('0 venues')).toBe(false)
  })

  it('Tarifas de venues: esperando la lista, el contador no dice «0 venues» (Codex p3-r4)', async () => {
    red.colgada = /venues/
    pintar(<VenuePricing />)
    await unaVueltaAlLazo()
    expect(seVe('0 venues')).toBe(false)
  })

  it('Pagos de prueba: sin leer, el encabezado no dice «Mostrando 0 pruebas»; leído y vacío, sí', async () => {
    red.caida = /testing\/payments/
    pintar(<TestingPayments />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('showingTests')).toBe(false)
    cleanup()
    red.caida = null
    red.colgada = /testing\/payments/
    pintar(<TestingPayments />)
    await unaVueltaAlLazo()
    expect(seVe('showingTests')).toBe(false)
    cleanup()
    red.colgada = null
    pintar(<TestingPayments />)
    await screen.findByText('noTests')
    expect(seVe('showingTests')).toBe(true)
  })

  it('Organizaciones: sin leer, aviso, «—» y no «Sin organizaciones»', async () => {
    red.caida = /organizations/
    pintar(<OrganizationManagement />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('Sin organizaciones')).toBe(false)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('Rentabilidad: sin leer no dice «0 de 0»', async () => {
    red.colgada = /profitab|margin/
    pintar(<Profitability />)
    await unaVueltaAlLazo()
    expect(seVe('0 de 0')).toBe(false)
  })

  it('Reporte de ventas: sin leer el pie no dice «Mostrando 0 de 0»', async () => {
    red.colgada = /sale-verifications/
    pintar(<SalesReport />)
    await unaVueltaAlLazo()
    expect(seVe('Mostrando')).toBe(false)
  })

  it('Pagos: sin leer no dice «0 de 0 pagos»', async () => {
    red.colgada = /payments/
    pintar(<Payments />)
    await unaVueltaAlLazo()
    expect(seVe('filters.of')).toBe(false)
  })
})
