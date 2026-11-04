/**
 * Parte 3-A: pantallas que afirmaban cosas sin haber leído sus datos.
 *  - falló o en pausa, sin datos: aviso, nunca «no hay…», «no encontrado» ni el valor por omisión;
 *  - falló o en pausa, con datos: los datos siguen, con el aviso de ESA consulta;
 *  - un formulario que se llena de una lectura nunca ofrece guardar si esa lectura no llegó;
 *  - 404 de un registro: «no existe», sin «Reintentar»;
 *  - respuesta buena y vacía: lo de siempre, sin aviso.
 *
 * La pantalla y TanStack son de verdad: sólo se finge la red (`@/api`) y quién mira. Mismo arnés que `hastaCeroFalloDeCarga.test.tsx`.
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
    cuerpoError: {} as unknown,
    params: {} as Record<string, string>,
    venue,
    t: (k: string, o?: unknown) => (typeof o === 'string' ? o : ((o as { defaultValue?: string } | undefined)?.defaultValue ?? k)),
    cuerpoVacio: { success: true, data: [], items: [], rows: [], events: [], staff: [], venues: [], stores: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string, config?: { params?: Record<string, unknown> }) => {
    const clave = config?.params ? `${url}?${new URLSearchParams(config.params as Record<string, string>)}` : url
    if (red.colgada?.test(clave)) return new Promise(() => {})
    if (red.caida?.test(clave)) throw Object.assign(new Error('caída'), { response: { status: red.estatus, data: red.cuerpoError } })
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
  useAccess: () => ({ role: 'OWNER', can: () => true, canAny: () => true, canAll: () => true, getDataScope: () => 'venue', isLoading: false }),
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
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null, isConnected: false }), SocketProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    setImageUrl: () => {},
    initializeWithExistingUrl: () => {},
    resetImage: () => {},
  }),
}))
vi.mock('react-router-dom', async original => ({
  ...(await original<typeof import('react-router-dom')>()),
  useParams: () => red.params,
}))
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: red.t, i18n: { language: 'es', changeLanguage: () => {} } }),
  Trans: () => null,
}))
vi.mock('@/firebase', () => ({ storage: {}, buildStoragePath: (p: string) => p }))
// Las pestañas viven dentro de VenueEditLayout, que aquí no importa: lo que se prueba es lo que pintan.
vi.mock('@/pages/Venue/VenueEditLayout', () => ({ useVenueEditActions: () => ({ setActions: () => {} }) }))
// El editor del aviso lee por su cuenta (tiene sus pruebas).
vi.mock('@/pages/Customers/components/PrivacyNoticeModal', () => ({ PrivacyNoticeModal: () => null }))

import { NotificationProvider } from '@/context/NotificationContext'
import CustomerForm from '@/pages/Customers/components/CustomerForm'
import { PricingPolicyDialog } from '@/pages/Inventory/components/PricingPolicyDialog'
import { ProductWizardDialog } from '@/pages/Inventory/components/ProductWizardDialog'
import { SuperadminFeatureDialogs } from '@/pages/Settings/Billing/components/SuperadminFeatureDialogs'
import { PaymentMethodsSection } from '@/pages/Settings/components/PaymentMethodsSection'
import { TpvSettingsForm } from '@/pages/Settings/components/TpvSettingsForm'
import CreditAssessment from '@/pages/Superadmin/CreditAssessment'
import MasterTotpSetup from '@/pages/Superadmin/MasterTotpSetup'
import Step1Setup from '@/pages/Superadmin/WhiteLabelBuilder/steps/Step1Setup'
import AggregatorDetailSheet from '@/pages/Superadmin/components/AggregatorDetailSheet'
import BulkVenueCreationDialog from '@/pages/Superadmin/components/BulkVenueCreationDialog'
import SuperadminHeader from '@/pages/Superadmin/components/SuperadminHeader'
import { DeviceCompatibilityBanner } from '@/pages/Superadmin/components/merchant-accounts/DeviceCompatibilityBanner'
import { DiscoveredMerchantsSubsection } from '@/pages/Superadmin/components/merchant-accounts/DiscoveredMerchantsSubsection'
import BasicInfo from '@/pages/Venue/Edit/BasicInfo'
import ContactImages from '@/pages/Venue/Edit/ContactImages'
import Documents from '@/pages/Venue/Edit/Documents'
import PrivacyNotice from '@/pages/Venue/Edit/PrivacyNotice'
import { BankAccountsSection } from '@/pages/Venue/Edit/components/BankAccountsSection'
import { APIKeysDialog } from '@/pages/Venue/components/APIKeysDialog'
import { BankConnectWizard } from '@/pages/Venue/components/BankConnectWizard'
import { BulkUploadDialog } from '@/pages/playtelecom/Stock/components/BulkUploadDialog'
import type { EcommerceMerchant } from '@/services/ecommerceMerchant.service'

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
const SIN_PERMISO = 'loadFailure.forbidden'
const seVe = (texto: RegExp | string) => (typeof texto === 'string' ? (document.body.textContent ?? '').includes(texto) : texto.test(document.body.textContent ?? ''))
/** Lo que se ve sólo mientras la lectura sigue en camino: `findBy` no aplica porque no llega nada. */
const unaVueltaAlLazo = () => act(() => new Promise<void>(r => setTimeout(r, 30)))
const reintentar = () => screen.findByRole('button', { name: 'retry' })
const sinReintentar = () => expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
/** Que «no dice nada» no pase por una pantalla en blanco: la región está esperando. */
const esperando = () => expect(document.querySelector('.animate-pulse, .animate-spin')).not.toBeNull()
/** Radix Select abre con el teclado sin depender del puntero. */
const abrirSelect = (selector: HTMLElement) => fireEvent.keyDown(selector, { key: 'Enter' })

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

beforeEach(() => {
  onlineManager.setOnline(true)
  red.caida = null
  red.colgada = null
  red.estatus = 500
  red.cuerpoError = {}
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

// ─── ALTA: formularios que se llenan de una lectura ───
describe('ProductWizardDialog · editar un producto', () => {
  const RUTAS: Ruta[] = [
    [/\/products\/p1$/, { data: { id: 'p1', name: 'Café real', price: 50, type: 'REGULAR', categoryId: 'c1', description: '', modifierGroups: [], ivaTratamiento: 'IVA_16' } }],
    [/wizard\/progress/, { data: { inventoryMethod: null, details: null } }],
    [/products\/p1\/recipe/, { data: null }],
    [/menucategories/, []],
    [/modifier-groups/, []],
    [/should-use-inventory/, { data: { shouldUse: false } }],
  ]
  const abrir = () => pintar(<ProductWizardDialog open onOpenChange={() => {}} mode="edit" productId="p1" />, { rutas: RUTAS })
  const guardar = () => screen.findByRole('button', { name: 'save' })

  it('sin internet: aviso, sin formulario, y «Guardar» bloqueado', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(await guardar()).toBeDisabled()
    expect(document.querySelector('form#step1-form')).toBeNull()
  })

  it('el producto no llegó (500): aviso con «Reintentar», «Guardar» bloqueado, y al reintentar sale lo real', async () => {
    red.caida = /\/products\/p1$/
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(await guardar()).toBeDisabled()
    red.caida = null
    fireEvent.click(await reintentar())
    await waitFor(() => expect(screen.getByDisplayValue('Café real')).toBeInTheDocument())
    expect(await guardar()).toBeEnabled()
  })

  it('un fallo de la receta no pasa por «sin receta»: aviso y «Guardar» bloqueado', async () => {
    red.caida = /products\/p1\/recipe/
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(await guardar()).toBeDisabled()
    expect(document.querySelector('form#step1-form')).toBeNull()
  })

  it('sin plan o permiso de inventario (403 en progreso y receta): nombre y precio se siguen pudiendo editar', async () => {
    red.caida = /wizard\/progress|products\/p1\/recipe/
    red.estatus = 403
    abrir()
    await waitFor(() => expect(screen.getByDisplayValue('Café real')).toBeInTheDocument())
    expect(await guardar()).toBeEnabled()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  describe('un producto con receta', () => {
    const CON_RECETA: Ruta[] = [[/wizard\/progress/, { data: { inventoryMethod: 'RECIPE', details: null } }], ...RUTAS.filter(([r]) => !String(r).includes('progress'))]
    const abrirConReceta = () => pintar(<ProductWizardDialog open onOpenChange={() => {}} mode="edit" productId="p1" />, { rutas: CON_RECETA })
    const LINEA = { rawMaterialId: 'rm1', rawMaterial: { name: 'Harina' }, quantity: 2, unit: 'KILOGRAM', isOptional: false, substituteNotes: null }
    const RECETA = { data: { portionYield: 1, prepTime: null, cookTime: null, notes: '', lowStockThreshold: null, lines: [LINEA] } }

    it('receta en camino: no dice «sin receta» ni deja agregar ingredientes (guardar reemplazaría la real)', async () => {
      red.colgada = /products\/p1\/recipe/
      abrirConReceta()
      await waitFor(() => expect(screen.getByDisplayValue('Café real')).toBeInTheDocument())
      const agregar = await screen.findByText('recipes.addIngredient')
      expect(agregar.closest('button')).toBeDisabled()
      expect(seVe('recipes.messages.noRecipe')).toBe(false)
      esperando()
    })

    it('insumos caídos: los ingredientes se ven, pero el costo total es «—», no $0, y avisa', async () => {
      red.caida = /raw-materials/
      pintar(<ProductWizardDialog open onOpenChange={() => {}} mode="edit" productId="p1" />, { rutas: [[/products\/p1\/recipe/, RECETA], ...CON_RECETA] })
      await screen.findByText(SIN_DATOS)
      await screen.findByText(/Harina/)
      expect(screen.getByText(/recipes\.totalCost|Costo total/).parentElement?.textContent).toContain('—')
      expect(seVe('$0')).toBe(false)
    })
  })

  it('la receta en camino: el formulario ya se ve, pero «Guardar» espera a que llegue', async () => {
    red.colgada = /products\/p1\/recipe/
    abrir()
    await waitFor(() => expect(screen.getByDisplayValue('Café real')).toBeInTheDocument())
    expect(await guardar()).toBeDisabled()
  })

  it('un 404 de la receta sí es «sin receta»: el formulario se ofrece', async () => {
    red.caida = /products\/p1\/recipe/
    red.estatus = 404
    abrir()
    await waitFor(() => expect(screen.getByDisplayValue('Café real')).toBeInTheDocument())
    expect(await guardar()).toBeEnabled()
    expect(seVe(SIN_DATOS)).toBe(false)
  })

  it('404 del producto: «no existe», sin «Reintentar» y sin guardar', async () => {
    red.caida = /\/products\/p1$/
    red.estatus = 404
    abrir()
    await screen.findByText(NO_EXISTE)
    sinReintentar()
    expect(await guardar()).toBeDisabled()
  })

  it('leído, y la recarga cae: lo leído sigue, con su aviso', async () => {
    abrir()
    await waitFor(() => expect(screen.getByDisplayValue('Café real')).toBeInTheDocument())
    await recargaCaida(/\/products\/p1$/)
    await screen.findByText(CON_DATOS)
    expect(screen.getByDisplayValue('Café real')).toBeInTheDocument()
  })
})

describe('PricingPolicyDialog', () => {
  const PRODUCTO = { id: 'p1', name: 'Café', price: 50 }
  const POLITICA = /pricing-policy/
  const CON_POLITICA: Ruta[] = [[POLITICA, { data: { pricingStrategy: 'AUTO_MARKUP', targetMarkupPercentage: 150, minimumPrice: 0 } }]]
  const abrir = (rutas: Ruta[] = CON_POLITICA) => pintar(<PricingPolicyDialog open onOpenChange={() => {}} product={PRODUCTO} />, { rutas })
  const sinOfrecerGuardar = () => {
    expect(screen.queryByRole('button', { name: 'save' })).toBeNull()
    expect(seVe('pricing.createPolicy')).toBe(false)
    expect(seVe('pricing.strategies.MANUAL')).toBe(false)
  }

  it('la primera lectura en camino no dice «Crear política» ni ofrece guardar', async () => {
    red.colgada = POLITICA
    abrir()
    await unaVueltaAlLazo()
    sinOfrecerGuardar()
    esperando()
  })

  it('sin internet: aviso, y no «Crear política» con MANUAL/30/200', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    sinOfrecerGuardar()
  })

  it('falló (500): aviso con «Reintentar»; al reintentar sale la política que sí tenía', async () => {
    red.caida = POLITICA
    abrir()
    await screen.findByText(SIN_DATOS)
    sinOfrecerGuardar()
    red.caida = null
    fireEvent.click(await reintentar())
    await screen.findByText('pricing.updatePolicy')
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
  })

  it('un 404 sí es «no tiene política»: crear se ofrece', async () => {
    red.caida = POLITICA
    red.estatus = 404
    abrir()
    await screen.findByText('pricing.createPolicy')
    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
  })

  it('leída, y la recarga cae: sigue «Actualizar», con su aviso', async () => {
    abrir()
    await screen.findByText('pricing.updatePolicy')
    await recargaCaida(POLITICA)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('pricing.updatePolicy')).toBeInTheDocument()
  })
})

describe('CustomerForm · consentimiento y aviso de privacidad', () => {
  const AVISO = /privacy-notice/
  const abrir = (rutas: Ruta[] = []) => pintar(<CustomerForm venueId="v1" groups={[]} onSuccess={() => {}} />, { rutas })
  const SIN_AVISO: Ruta[] = [[AVISO, { data: { notice: { content: null, esPlantilla: true } } }]]

  it('un 500 no le pide publicar el aviso que ya puede tener', async () => {
    red.caida = AVISO
    abrir()
    await screen.findByText('form.consentNoticeFailed')
    await reintentar()
    expect(seVe('form.consentNeedsNotice')).toBe(false)
  })

  it('sin internet, igual', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText('form.consentNoticeFailed')
    expect(seVe('form.consentNeedsNotice')).toBe(false)
  })

  it('un 403 sigue diciendo que no se pudo verificar, sin «Reintentar»', async () => {
    red.caida = AVISO
    red.estatus = 403
    abrir()
    await screen.findByText('form.consentNoticeUnknown')
    sinReintentar()
    expect(seVe('form.consentNoticeFailed')).toBe(false)
  })

  it('leído sin aviso, y la recarga cae: el dato sigue, con su aviso', async () => {
    abrir(SIN_AVISO)
    await screen.findByRole('button', { name: 'form.consentNeedsNoticeLink' })
    await recargaCaida(AVISO)
    await screen.findByText('form.consentNoticeFailed')
    expect(seVe('form.consentNeedsNotice')).toBe(true)
  })
})

describe('Venue/Edit · PrivacyNotice', () => {
  const AVISO = /privacy-notice/
  const PUBLICADO: Ruta[] = [[AVISO, { data: { notice: { id: 'n1', content: 'Texto', createdAt: '2026-10-01T18:00:00.000Z', esPlantilla: false } } }]]

  it('sin internet: no dice «no publicado» ni ofrece «Escribir»', async () => {
    onlineManager.setOnline(false)
    pintar(<PrivacyNotice />)
    await screen.findByText('edit.privacy.loadFailed')
    await reintentar()
    expect(seVe('edit.privacy.notPublished')).toBe(false)
    expect(screen.queryByRole('button', { name: 'edit.privacy.write' })).toBeNull()
  })

  it('un 500: su texto, con «Reintentar» y sin «Escribir»', async () => {
    red.caida = AVISO
    pintar(<PrivacyNotice />)
    await screen.findByText('edit.privacy.loadFailed')
    await reintentar()
    expect(screen.queryByRole('button', { name: 'edit.privacy.write' })).toBeNull()
  })

  it('leído, y la recarga cae: lo leído sigue, con su aviso', async () => {
    pintar(<PrivacyNotice />, { rutas: PUBLICADO })
    await screen.findByRole('button', { name: 'edit.privacy.edit' })
    await recargaCaida(AVISO)
    await screen.findByText(CON_DATOS)
    expect(screen.getByRole('button', { name: 'edit.privacy.edit' })).toBeInTheDocument()
  })
})

describe.each([
  ['BasicInfo', () => <BasicInfo />],
  ['ContactImages', () => <ContactImages />],
])('Venue/Edit · %s', (_nombre, pantalla) => {
  const NEGOCIO = /venues\/v1$/
  const RUTAS: Ruta[] = [[NEGOCIO, { id: 'v1', name: 'Mi negocio real', slug: 'mi-negocio', timezone: 'America/Mexico_City', currency: 'MXN', type: 'RESTAURANT', status: 'ACTIVE', phone: '5512345678', email: 'a@b.mx' }]]

  it('sin internet: no dice «negocio no encontrado»', async () => {
    onlineManager.setOnline(false)
    pintar(pantalla(), { rutas: RUTAS })
    await screen.findByText(SIN_DATOS)
    expect(seVe('edit.notFound')).toBe(false)
    expect(document.querySelector('form')).toBeNull()
  })

  it('un 500: aviso con «Reintentar», sin formulario', async () => {
    red.caida = NEGOCIO
    pintar(pantalla(), { rutas: RUTAS })
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('edit.notFound')).toBe(false)
    expect(document.querySelector('form')).toBeNull()
  })

  it('un 404 sí es «no encontrado», sin «Reintentar»', async () => {
    red.caida = NEGOCIO
    red.estatus = 404
    pintar(pantalla(), { rutas: RUTAS })
    await screen.findByText('edit.notFound')
    sinReintentar()
  })

  it('leído, y la recarga cae: el formulario sigue, con su aviso', async () => {
    pintar(pantalla(), { rutas: RUTAS })
    await waitFor(() => expect(document.querySelector('form')).not.toBeNull())
    await recargaCaida(NEGOCIO)
    await screen.findByText(CON_DATOS)
    expect(document.querySelector('form')).not.toBeNull()
  })
})

// ─── ALTA: «no hay…» que nadie leyó ───
describe('APIKeysDialog', () => {
  const COMERCIO = { id: 'm1', channelName: 'Web' } as unknown as EcommerceMerchant
  const LLAVES = /ecommerce-merchants\/m1\/keys/
  const abrir = () => pintar(<APIKeysDialog open onOpenChange={() => {}} merchant={COMERCIO} venueId="v1" />, { rutas: [[LLAVES, { data: { publicKey: 'pk_real', secretKey: 'sk_****', sandboxMode: false } }]] })
  const regenerar = () => screen.getByRole('button', { name: /Regenerar Claves/ })

  it('sin internet: no pinta «Modo Live» con llaves vacías ni deja regenerar', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(seVe('Modo Live')).toBe(false)
    expect(regenerar()).toBeDisabled()
  })

  it('un 500 ofrece «Reintentar»', async () => {
    red.caida = LLAVES
    abrir()
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(regenerar()).toBeDisabled()
  })

  it('leídas, y la recarga cae: las llaves siguen, con su aviso', async () => {
    abrir()
    await screen.findByText('pk_real')
    await recargaCaida(LLAVES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('pk_real')).toBeInTheDocument()
  })
})

describe('BankAccountsSection', () => {
  const CUENTAS = /financial-connections/

  it('sin internet: su texto con «Reintentar», y no «sin cuentas»', async () => {
    onlineManager.setOnline(false)
    pintar(<BankAccountsSection />)
    await screen.findByText('section.loadError')
    await reintentar()
    expect(seVe('section.empty')).toBe(false)
  })

  it('un 500 ofrece «Reintentar»', async () => {
    red.caida = CUENTAS
    pintar(<BankAccountsSection />)
    await screen.findByText('section.loadError')
    await reintentar()
  })

  it('apagada por plan (`enabled` false): no afirma «sin cuentas» ni se queda en esqueleto', async () => {
    pintar(<BankAccountsSection enabled={false} />)
    await unaVueltaAlLazo()
    expect(seVe('section.empty')).toBe(false)
    expect(seVe('section.loadError')).toBe(false)
    expect(document.querySelector('.animate-pulse')).toBeNull()
  })

  it('leídas y vacías, y la recarga cae: el vacío sigue, con su aviso', async () => {
    pintar(<BankAccountsSection />, { rutas: [[CUENTAS, { data: [] }]] })
    await screen.findByText('section.empty')
    await recargaCaida(CUENTAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('section.empty')).toBeInTheDocument()
  })
})

describe('BankConnectWizard', () => {
  const BANCOS = /financial-providers/
  const abrir = (rutas: Ruta[] = []) => pintar(<BankConnectWizard open onClose={() => {}} venueId="v1" resume={null} />, { rutas })

  it('sin internet: no dice «ningún banco disponible»', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(seVe('wizard.step1.none')).toBe(false)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    red.caida = BANCOS
    abrir()
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('wizard.step1.none')).toBe(false)
  })
})

describe('PaymentMethodsSection', () => {
  const METODOS = /payment-methods/
  const TARJETA = { id: 'pm1', isDefault: false, card: { brand: 'visa', last4: '4242', exp_month: 1, exp_year: 2030 } }

  it('sin internet: no dice «agrega el primero»', async () => {
    onlineManager.setOnline(false)
    pintar(<PaymentMethodsSection venueId="v1" />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('paymentMethods.noPaymentMethods')).toBe(false)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    red.caida = METODOS
    pintar(<PaymentMethodsSection venueId="v1" />)
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('paymentMethods.addFirst')).toBe(false)
  })

  it('leídas, y la recarga cae: las tarjetas siguen, con su aviso', async () => {
    pintar(<PaymentMethodsSection venueId="v1" />, { rutas: [[METODOS, { data: [TARJETA] }]] })
    await screen.findByText('paymentMethods.cardEnding')
    await recargaCaida(METODOS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('paymentMethods.cardEnding')).toBeInTheDocument()
  })
})

describe('AggregatorDetailSheet', () => {
  const AGREGADOR = /superadmin\/aggregators\/a1/
  const REPARTOS = /merchant-revenue-shares/
  const SALDO = /merchant-accounts\/m1\/balance/
  const COMERCIO = { id: 'm1', displayName: 'Comercio real', externalMerchantId: 'x1', active: true, financialAccount: { lastBalance: 10, connection: { provider: { name: 'Banco' } } } }
  const RUTAS: Ruta[] = [
    [AGREGADOR, { data: { id: 'a1', name: 'Agregador real', active: true, ivaRate: '0.16', merchants: [COMERCIO], venueCommissions: [] } }],
    [REPARTOS, { data: [] }],
    [SALDO, { data: { state: 'OK', amount: 123 } }],
  ]
  const abrir = () => pintar(<AggregatorDetailSheet open onOpenChange={() => {}} aggregatorId="a1" onEditAggregator={() => {}} />, { rutas: RUTAS })

  it('sin internet: no dice «No se encontró el agregador»', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(seVe('No se encontró')).toBe(false)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    red.caida = AGREGADOR
    abrir()
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('No se encontró')).toBe(false)
  })

  it('un 404 sí es «No se encontró», sin «Reintentar»', async () => {
    red.caida = AGREGADOR
    red.estatus = 404
    abrir()
    await screen.findByText('No se encontró el agregador.')
    sinReintentar()
  })

  it('con los repartos caídos no afirma «sin reparto» (100 % Avoqado): «—» y aviso', async () => {
    red.caida = REPARTOS
    abrir()
    await screen.findByText('Comercio real')
    await screen.findByText(SIN_DATOS)
    expect(seVe('sin reparto')).toBe(false)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Configurar/ })).toBeNull()
  })

  it('con los repartos leídos y vacíos sí es «sin reparto»', async () => {
    abrir()
    await screen.findByText('sin reparto')
  })

  it('«Consultar saldo» sin internet dice que no hay conexión', async () => {
    abrir()
    const consultar = await screen.findByRole('button', { name: 'Consultar saldo' })
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    fireEvent.click(consultar)
    await screen.findByText('Sin conexión')
  })
})

describe('DeviceCompatibilityBanner', () => {
  const TERMINALES = /superadmin\/terminals/
  const abrir = (avisar: (ok: boolean) => void, rutas: Ruta[] = []) => pintar(<DeviceCompatibilityBanner providerCode="ANGELPAY" venueId="v1" onCompatibilityChange={avisar} />, { rutas })

  it('sin internet: no dice «no tiene ninguna terminal» ni bloquea el alta', async () => {
    const avisar = vi.fn()
    onlineManager.setOnline(false)
    abrir(avisar)
    await screen.findByText(SIN_DATOS)
    expect(seVe('Sin terminales compatibles')).toBe(false)
    expect(avisar).toHaveBeenLastCalledWith(true)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    const avisar = vi.fn()
    red.caida = TERMINALES
    abrir(avisar)
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('Sin terminales compatibles')).toBe(false)
  })

  it('leídas y sin ninguna compatible, y la recarga cae: lo leído sigue, con su aviso', async () => {
    const avisar = vi.fn()
    abrir(avisar, [[TERMINALES, { data: [] }]])
    await screen.findByText('Sin terminales compatibles')
    expect(avisar).toHaveBeenLastCalledWith(false)
    await recargaCaida(TERMINALES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Sin terminales compatibles')).toBeInTheDocument()
  })
})

describe('DiscoveredMerchantsSubsection', () => {
  const PROVEEDORES = /superadmin\/payment-providers/
  const PENDIENTES = /superadmin\/merchant-accounts/
  const CONFIG = /venue-pricing\/config/
  const RUTAS: Ruta[] = [
    [PROVEEDORES, { data: [{ id: 'pv1', code: 'ANGELPAY' }] }],
    [PENDIENTES, { data: [] }],
    [CONFIG, { data: { primaryAccount: { displayName: 'Cuenta principal real' } } }],
    [/superadmin\/terminals/, { data: [] }],
  ]
  const abrir = (avisar: (n: number) => void, rutas: Ruta[] = RUTAS) => pintar(<DiscoveredMerchantsSubsection venueId="v1" onPendingCountChange={avisar} />, { rutas })
  const noAfirma = (avisar: ReturnType<typeof vi.fn>) => {
    expect(seVe('Sin merchants descubiertos')).toBe(false)
    expect(avisar).not.toHaveBeenCalledWith(0)
  }

  it('los proveedores en camino: esperando, sin «Sin merchants» ni un 0 al padre', async () => {
    const avisar = vi.fn()
    red.colgada = PROVEEDORES
    abrir(avisar)
    await unaVueltaAlLazo()
    esperando()
    noAfirma(avisar)
  })

  it('sin internet: no dice «Sin merchants» ni reporta 0 al padre, y tampoco «sin configuración»', async () => {
    const avisar = vi.fn()
    onlineManager.setOnline(false)
    abrir(avisar)
    await screen.findAllByText(SIN_DATOS)
    noAfirma(avisar)
    expect(seVe('aún no tiene configuración')).toBe(false)
  })

  it('con los proveedores caídos, igual', async () => {
    const avisar = vi.fn()
    red.caida = PROVEEDORES
    abrir(avisar)
    await screen.findByText(SIN_DATOS)
    noAfirma(avisar)
  })

  it('con los pendientes caídos: aviso con «Reintentar»', async () => {
    const avisar = vi.fn()
    red.caida = PENDIENTES
    abrir(avisar)
    await screen.findByText(SIN_DATOS)
    await reintentar()
    noAfirma(avisar)
  })

  it('con la configuración caída no dice «aún no tiene configuración»', async () => {
    red.caida = CONFIG
    abrir(vi.fn())
    await screen.findByText(SIN_DATOS)
    expect(seVe('aún no tiene configuración')).toBe(false)
  })

  it('leído y vacío: «Sin merchants» y 0 al padre', async () => {
    const avisar = vi.fn()
    abrir(avisar)
    await screen.findByText('Sin merchants descubiertos aún')
    expect(avisar).toHaveBeenLastCalledWith(0)
  })

  it('con los proveedores leídos y sin AngelPay activo, ese vacío también es verdad', async () => {
    const avisar = vi.fn()
    abrir(avisar, [[PROVEEDORES, { data: [] }]])
    await screen.findByText('Sin merchants descubiertos aún')
    expect(avisar).toHaveBeenLastCalledWith(0)
  })
})

describe('CreditAssessment', () => {
  const RESUMEN = /credit\/summary/
  const LISTA = /credit\/assessments/
  const VACIA: Ruta = [LISTA, { data: [], pagination: { totalPages: 1 } }]

  it('sin internet: no dice «No se encontraron evaluaciones», y el aviso sustituye al resumen', async () => {
    onlineManager.setOnline(false)
    pintar(<CreditAssessment />)
    expect((await screen.findAllByText(SIN_DATOS)).length).toBe(2)
    expect(seVe('No se encontraron evaluaciones')).toBe(false)
  })

  it('un 500 de la lista: aviso con «Reintentar», y los filtros siguen', async () => {
    red.caida = LISTA
    pintar(<CreditAssessment />, { rutas: [[RESUMEN, { data: { totalAssessments: 3, eligibilityDistribution: {}, gradeDistribution: {}, totalEligibleCredit: 0, pendingOffers: 0 } }]] })
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('No se encontraron evaluaciones')).toBe(false)
    expect(screen.getByPlaceholderText('Buscar venue...')).toBeInTheDocument()
  })

  it('un 500 del resumen dice que no llegó, y la lista vacía leída sigue', async () => {
    red.caida = RESUMEN
    pintar(<CreditAssessment />, { rutas: [VACIA] })
    await screen.findByText(SIN_DATOS)
    await screen.findByText('No se encontraron evaluaciones')
  })
})

describe('SuperadminFeatureDialogs', () => {
  const FUNCIONES = /superadmin\/features/
  const abrir = (estado?: unknown, rutas: Ruta[] = []) =>
    pintar(
      <SuperadminFeatureDialogs
        venueId="v1"
        featuresStatus={estado as never}
        formatCurrency={() => '$1'}
        showGrantTrialDialog
        setShowGrantTrialDialog={() => {}}
        showEnableFeatureDialog={false}
        setShowEnableFeatureDialog={() => {}}
        disablingFeatureCode={null}
        setDisablingFeatureCode={() => {}}
      />,
      { rutas },
    )
  const selector = () => screen.findByRole('combobox', { name: /selectFeature|Select Feature/ })

  it('sin internet: aviso, y al abrir la lista no dice «no hay funciones»', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    abrirSelect(await selector())
    await unaVueltaAlLazo()
    expect(seVe('superadmin.noFeaturesAvailable')).toBe(false)
  })

  it('un 500 con el respaldo del negocio: avisa que la lista puede estar incompleta', async () => {
    red.caida = FUNCIONES
    abrir({ activeFeatures: [], availableFeatures: [{ id: 'f1', code: 'X', name: 'Función de respaldo', monthlyPrice: 10 }] })
    await screen.findByText(CON_DATOS)
    await reintentar()
    abrirSelect(await selector())
    await screen.findByText(/Función de respaldo/)
  })

  it('leída y vacía: «no hay funciones»', async () => {
    abrir(undefined, [[FUNCIONES, { data: [] }]])
    await sinConsultasEnCamino()
    abrirSelect(await selector())
    await screen.findByText('superadmin.noFeaturesAvailable')
    expect(seVe(SIN_DATOS)).toBe(false)
  })
})

describe('WhiteLabel · Step1Setup', () => {
  const NEGOCIOS = /superadmin\/venues/
  const abrir = (rutas: Ruta[] = []) =>
    pintar(
      <Step1Setup venueId="" venueName="" preset={null} theme={{ primaryColor: '#000000', brandName: '' }} onVenueChange={() => {}} onPresetChange={() => {}} onThemeChange={() => {}} errors={[]} />,
      { rutas },
    )
  const selector = () => screen.findByRole('combobox', { name: 'whiteLabelWizard.setup.selectVenue' })

  it('sin internet: aviso, y la lista no dice «sin negocios»', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    abrirSelect(await selector())
    await unaVueltaAlLazo()
    expect(seVe('whiteLabelWizard.setup.noVenues')).toBe(false)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    red.caida = NEGOCIOS
    abrir()
    await screen.findByText(SIN_DATOS)
    await reintentar()
    abrirSelect(await selector())
    await unaVueltaAlLazo()
    expect(seVe('whiteLabelWizard.setup.noVenues')).toBe(false)
  })

  it('leída y vacía: «sin negocios»', async () => {
    abrir([[NEGOCIOS, { data: [] }]])
    await sinConsultasEnCamino()
    abrirSelect(await selector())
    await screen.findByText('whiteLabelWizard.setup.noVenues')
  })
})

describe('SuperadminHeader · notificaciones', () => {
  const AVISOS = /dashboard\/notifications/
  const AVISO = { id: 'n1', title: 'Aviso real', message: 'm', isRead: false, priority: 'NORMAL', createdAt: '2026-10-01T18:00:00.000Z' }
  const abrir = async (rutas: Ruta[] = []) => {
    pintar(
      <NotificationProvider>
        <SuperadminHeader />
      </NotificationProvider>,
      { rutas },
    )
    const campana = await waitFor(() => {
      const icono = document.querySelector('svg.lucide-bell')
      expect(icono).not.toBeNull()
      return icono!.closest('button') as HTMLElement
    })
    fireEvent.keyDown(campana, { key: 'Enter' })
    await screen.findByText('header.notifications')
  }

  it('la primera lectura en camino: esqueleto, y no «Sin notificaciones»', async () => {
    red.colgada = AVISOS
    await abrir()
    await unaVueltaAlLazo()
    expect(seVe('header.noNotifications')).toBe(false)
    expect(document.querySelector('[role="menu"] .animate-pulse')).not.toBeNull()
  })

  it('sin internet: su texto con «Reintentar», y no «Sin notificaciones»', async () => {
    onlineManager.setOnline(false)
    await abrir()
    await screen.findByText('header.notificationsError')
    await reintentar()
    expect(seVe('header.noNotifications')).toBe(false)
  })

  it('leídas, y la recarga cae: la lista sigue, con su aviso', async () => {
    await abrir([[AVISOS, { data: { notifications: [AVISO], unreadCount: 1 } }]])
    await screen.findByText('Aviso real')
    await recargaCaida(AVISOS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Aviso real')).toBeInTheDocument()
    expect(seVe('header.notificationsError')).toBe(false)
  })
})

describe('playtelecom · BulkUploadDialog', () => {
  const CATEGORIAS = /stock\/item-categories/
  const PISTA = 'Primero debes crear una categoría'
  const abrir = (rutas: Ruta[] = []) => pintar(<BulkUploadDialog open onOpenChange={() => {}} />, { rutas })

  it('sin internet: no pide crear una categoría', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText(SIN_DATOS)
    expect(seVe(PISTA)).toBe(false)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    red.caida = CATEGORIAS
    abrir()
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe(PISTA)).toBe(false)
  })

  it('leídas y vacías: la pista de siempre, sin aviso', async () => {
    abrir([[CATEGORIAS, { data: { categories: [] } }]])
    await screen.findByText(PISTA)
    expect(seVe(SIN_DATOS)).toBe(false)
  })
})

// ─── MEDIA ───
describe('Venue/Edit · Documents', () => {
  const NEGOCIO = /venues\/v1$/

  it('un 500: su texto, con «Reintentar»', async () => {
    red.caida = NEGOCIO
    pintar(<Documents />)
    await screen.findByText('Could not load venue information')
    await reintentar()
  })

  it('sin internet: su texto, con «Reintentar»', async () => {
    onlineManager.setOnline(false)
    pintar(<Documents />)
    await screen.findByText('Could not load venue information')
    await reintentar()
  })

  it('un 404: «no existe», sin «Reintentar»', async () => {
    red.caida = NEGOCIO
    red.estatus = 404
    pintar(<Documents />)
    await screen.findByText(NO_EXISTE)
    sinReintentar()
    expect(seVe('Could not load venue information')).toBe(false)
  })

  it('leído, y la recarga cae: los documentos siguen, con su aviso', async () => {
    pintar(<Documents />, { rutas: [[NEGOCIO, { id: 'v1', name: 'Mi negocio', entityType: 'PERSONA_FISICA', kycStatus: 'NOT_SUBMITTED' }]] })
    await screen.findByText('Documentación Fiscal')
    await recargaCaida(NEGOCIO)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Documentación Fiscal')).toBeInTheDocument()
  })
})

describe('TpvSettingsForm', () => {
  const AJUSTES = /tpv\/t1\/settings/
  const abrir = () => pintar(<TpvSettingsForm tpvId="t1" compact />, { rutas: [[AJUSTES, { tipSuggestions: [10, 15] }]] })
  const seOfrecenLosAjustes = () => screen.findByPlaceholderText('tpvSettings.tipPlaceholder')

  it('sin internet: su texto con «Reintentar», sin ajustes que guardar', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText('tpvSettings.loadError')
    await reintentar()
    expect(screen.queryByPlaceholderText('tpvSettings.tipPlaceholder')).toBeNull()
  })

  it('un 500 ofrece «Reintentar», y al reintentar salen los ajustes', async () => {
    red.caida = AJUSTES
    abrir()
    await screen.findByText('tpvSettings.loadError')
    red.caida = null
    fireEvent.click(await reintentar())
    await seOfrecenLosAjustes()
  })

  it('un 404: «no existe», sin «Reintentar»', async () => {
    red.caida = AJUSTES
    red.estatus = 404
    abrir()
    await screen.findByText(NO_EXISTE)
    sinReintentar()
  })

  it('leídos, y la recarga cae: los ajustes siguen, con su aviso', async () => {
    abrir()
    await seOfrecenLosAjustes()
    await recargaCaida(AJUSTES)
    await screen.findByText(CON_DATOS)
    await seOfrecenLosAjustes()
    expect(seVe('tpvSettings.loadError')).toBe(false)
  })
})

describe('MasterTotpSetup', () => {
  const TOTP = /master-totp\/setup/
  const DATOS = { uri: 'otpauth://totp/x', issuer: 'Emisor real', label: 'L', digits: 8, period: 60, algorithm: 'SHA1' }

  it('un fallo cualquiera no culpa a TOTP_MASTER_SECRET: aviso con «Reintentar»', async () => {
    red.caida = TOTP
    pintar(<MasterTotpSetup />)
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('TOTP_MASTER_SECRET')).toBe(false)
  })

  it('sin internet: aviso, y no tarjetas vacías', async () => {
    onlineManager.setOnline(false)
    pintar(<MasterTotpSetup />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('Escanea con Google Authenticator')).toBe(false)
  })

  it('cuando el servidor dice que falta el secreto, sí lo dice, con «Reintentar»', async () => {
    red.caida = TOTP
    red.cuerpoError = { message: 'TOTP Master not configured. Add TOTP_MASTER_SECRET to environment.' }
    pintar(<MasterTotpSetup />)
    await screen.findByText('Error de configuracion')
    await reintentar()
  })

  it('un 403 dice que no tiene permiso, sin «Reintentar»', async () => {
    red.caida = TOTP
    red.estatus = 403
    pintar(<MasterTotpSetup />)
    await screen.findByText(SIN_PERMISO)
    sinReintentar()
  })

  it('leído, y la recarga cae: el QR sigue, con su aviso', async () => {
    pintar(<MasterTotpSetup />, { rutas: [[TOTP, { data: DATOS }]] })
    await screen.findByText('Emisor real')
    await recargaCaida(TOTP)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Emisor real')).toBeInTheDocument()
  })

  it('leído, y en pausa: igual', async () => {
    pintar(<MasterTotpSetup />, { rutas: [[TOTP, { data: DATOS }]] })
    await screen.findByText('Emisor real')
    await recargaEnPausa()
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Emisor real')).toBeInTheDocument()
  })
})

describe('BulkVenueCreationDialog', () => {
  it('sin internet: el select vacío se explica', async () => {
    onlineManager.setOnline(false)
    pintar(<BulkVenueCreationDialog open onOpenChange={() => {}} />)
    await screen.findByText(SIN_DATOS)
  })

  it('un 500: aviso con «Reintentar»', async () => {
    red.caida = /organizations\/list/
    pintar(<BulkVenueCreationDialog open onOpenChange={() => {}} />)
    await screen.findByText(SIN_DATOS)
    await reintentar()
  })
})
