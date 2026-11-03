/**
 * Grupo «con exigencia» del D4: pantallas donde hay que teclear algo para pisar, pero igual se pierde lo que había (RFC,
 * categorías del menú, precio en Stripe, texto legal). Sin la lectura no hay formulario ni guardado; `null` sí es un dato
 * (no hay registro) y crear sigue igual. Corre con TanStack de verdad: sólo se finge la red.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CreditPackFormModal from '../CreditPacks/CreditPackForm'
import { CampaignEditorModal } from '../Customers/components/CampaignEditorModal'
import { PrivacyNoticeModal } from '../Customers/components/PrivacyNoticeModal'
import MenuId from '../Menu/Menus/menuId'
import { ModifiersManagerDialog } from '../Menu/Modifiers/components/ModifiersManagerDialog'
import { ServiceFormDialog } from '../Menu/Services/ServiceFormDialog'
import OrganizationSettings from '../Organization/OrganizationSettings'
import PaymentActivationPage from '../PaymentActivation/PaymentActivationPage'
import CreatePaymentLinkDialog from '../PaymentLinks/CreatePaymentLinkDialog'
import DiscountForm from '../Promotions/DiscountForm'
import { GatewayTab } from '../Settings/components/printStations/GatewayTab'
import CampaignEditor from '../Superadmin/Marketing/CampaignEditor'
import { PaymentConfigDialog } from '../Superadmin/OrganizationManagement'
import FiscalProfile from '../Venue/Edit/FiscalProfile'
import VenuePaymentConfig from '../Venue/VenuePaymentConfig'

const m = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  sinNada: () => {},
  usuario: { id: 'u1', role: 'SUPERADMIN', organizationMemberships: [{ organizationId: 'org1', role: 'OWNER' }], venues: [] },
}))
vi.mock('@/api', () => ({ default: { get: m.get, put: m.put, post: m.post, patch: m.patch, delete: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { id: 'v1', name: 'Negocio' }, fullBasePath: '/venues/negocio' }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: m.usuario, activeVenue: { id: 'v1', timezone: 'UTC' }, getVenueBySlug: () => ({ id: 'v1', name: 'Negocio' }) }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: m.t, i18n: { language: 'es' } }),
  Trans: () => null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
// Cascarones que aquí no aportan nada (Google, Firebase, TipTap, arrastrar): lo que se prueba es qué pasa con la lectura.
vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: ({ value }: { value: string }) => <input aria-label="calle" value={value} readOnly />,
}))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    setImageUrl: m.sinNada,
    initializeWithExistingUrl: m.sinNada,
  }),
}))
vi.mock('@/components/draggable-multi-select', () => ({ default: () => null }))
vi.mock('../Superadmin/Marketing/components/RichTextEditor', () => ({ RichTextEditor: () => null }))
vi.mock('../PaymentLinks/components/PaymentLinkPreview', () => ({ PaymentLinkPreview: () => null }))
vi.mock('../PaymentLinks/components/DonationPreview', () => ({ DonationPreview: () => null }))
vi.mock('../PaymentLinks/components/ItemPreview', () => ({ ItemPreview: () => null }))
vi.mock('../PaymentLinks/components/ItemFormSection', () => ({ ItemFormSection: () => null }))
vi.mock('../PaymentLinks/components/ShareActions', () => ({ ShareActions: () => null }))

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const TASAS = { debitRate: 0.02, creditRate: 0.03, amexRate: 0.04, internationalRate: 0.05 }
const CONFIG_DE_PAGOS = { id: 'cfg1', primaryAccount: { id: 'a1', displayName: 'Cuenta', provider: { name: 'Blumon' } } }
const LECTURAS: [RegExp, unknown][] = [
  [/pricing-structures/, { data: [{ id: 'ps1', accountType: 'PRIMARY', active: true, fixedFeePerTransaction: 1, ...TASAS }] }],
  [/cost-structures/, { data: [{ id: 'cs1', accountType: 'PRIMARY', ...TASAS }] }],
  [/venues\/v1\/payment-config$/, { data: CONFIG_DE_PAGOS }],
  [/organizations\/org1$/, { id: 'org1', name: 'Org Real', email: 'org@real.mx', phone: '5551234567', taxId: 'RFC123', billingEmail: 'fac@real.mx' }],
  [
    /menus\/m1/,
    {
      id: 'm1',
      name: 'Menú Real',
      active: true,
      type: 'REGULAR',
      availableFrom: '08:00',
      availableUntil: '12:00',
      availableDays: ['MON'],
      appliesToDevices: true,
      appliesToOnline: true,
      categories: [{ categoryId: 'cat1', category: { name: 'Bebidas' } }],
    },
  ],
  [/menucategories/, []],
  [
    /credit-packs\/p1/,
    { name: 'Paquete Real', description: '', price: 500, currency: 'MXN', displayOrder: 0, active: true, items: [{ productId: 'prod1', quantity: 2 }] },
  ],
  [/discounts\/d1/, { name: 'Descuento Real', type: 'PERCENTAGE', value: 10, scope: 'ORDER', active: true, isAutomatic: false, priority: 0, applyBeforeTax: true, isStackable: false, stackPriority: 0 }],
  [/\/discounts/, { data: [], meta: {} }],
  [/products\/svc1/, { id: 'svc1', name: 'Servicio Real', type: 'APPOINTMENTS_SERVICE', price: 200, categoryId: 'cat1', active: true, imageUrl: null, description: '' }],
  [/modifier-groups\/g1/, { id: 'g1', name: 'Extras Reales', description: '', required: true, minSelections: 1, maxSelections: 3, modifiers: [] }],
  [/\/products/, []],
  [
    /payment-links\/l1/,
    { success: true, data: { id: 'l1', title: 'Liga Real', description: '', amountType: 'FIXED', amount: 100, isReusable: false, redirectUrl: 'https://real.mx', purpose: 'PAYMENT', shortCode: 'abc' } },
  ],
  [/venues\/v1\/campaigns\/c1/, { id: 'c1', name: 'Campaña Real', subject: 'Asunto Real', status: 'DRAFT', audience: 'ALL_CONSENTED', contentBlocks: [{ type: 'paragraph', text: 'Hola' }] }],
  [/privacy-notice/, { data: { notice: { id: 'n1', content: 'Aviso real', language: 'es', contentHash: 'h', createdAt: '2026-01-01' } } }],
  [/gateway/, { data: { terminalId: 'TERM-REAL', address: '1.2.3.4', active: true, lastHeartbeat: null } }],
  [
    /payment-activation/,
    {
      data: {
        profile: { venueAddressPresent: true, venueAddress: { address: 'Calle Real 1', city: 'CDMX', state: 'CDMX', zipCode: '01000' } },
        documents: { required: ['ine'], uploaded: [], missing: ['ine'] },
      },
    },
  ],
  [
    /organizations\/o1\/payment-config/,
    { paymentConfig: { primaryAccountId: 'a1', secondaryAccountId: null, tertiaryAccountId: null, preferredProcessor: 'AUTO' }, pricingStructures: [], venueInheritance: [] },
  ],
  [/merchant-accounts\/list/, { data: [{ id: 'a1', displayName: 'Cuenta Real', alias: 'real', provider: { name: 'Blumon' } }] }],
  [
    /marketing\/campaigns\/mc1/,
    { campaign: { id: 'mc1', name: 'Campaña Super', subject: 'Asunto Super', bodyHtml: '<p>Hola</p>', templateId: null, targetAllVenues: true, targetVenueIds: [], includeStaff: false, targetStaffRoles: [] } },
  ],
  [/marketing\/templates/, { templates: [], total: 0 }],
  [/superadmin\/venues\/list/, { data: [] }],
  [/fiscal-profile/, { data: { rfc: 'XAXX010101000', razonSocial: 'RAZON REAL', regimenFiscal: '601', codigoPostal: '01000', email: 'f@real.mx', validationStatus: 'VALID', validatedAt: null } }],
  [/customers/, { data: [], meta: {} }],
]
function lecturaSana(url: string) {
  const hit = LECTURAS.find(([re]) => re.test(url))
  return Promise.resolve({ data: hit ? hit[1] : {} })
}
const leeAsi = (lectura: RegExp, respuesta: () => Promise<unknown>) =>
  m.get.mockImplementation((url: string) => (lectura.test(url) ? respuesta() : lecturaSana(url)))

/** El texto del aviso común, y el propio del perfil fiscal. Otros `role="alert"` de estas pantallas son avisos informativos. */
const AVISO = /loadFailure\.|edit\.fiscal\.loadError/
const hayAviso = () => screen.findAllByText(AVISO)
const sinAviso = () => expect(screen.queryAllByText(AVISO)).toHaveLength(0)
const boton = (nombre: RegExp) => screen.queryByRole('button', { name: nombre })
const primerCampo = () => screen.queryAllByRole('textbox')[0] ?? null
const cambiar = (actual: string, nuevo: string) => fireEvent.change(screen.getByDisplayValue(actual), { target: { value: nuevo } })
const valor = (texto: string) => () => screen.findByDisplayValue(texto)

const cerrar = () => {}
const ORG = { id: 'o1', name: 'Org', type: 'RESTAURANT' } as never

type Caso = {
  nombre: string
  ui: ReactElement
  path?: string
  url?: string
  /** La lectura que llena el formulario. */
  lectura: RegExp
  /** Espera a ver el dato real en la pantalla. */
  dato: () => Promise<unknown>
  guardar: () => HTMLElement | null
  /** Lo que deja escribir: sin la lectura no debe estar. */
  formulario?: () => HTMLElement | null
  /** Lo mínimo para que se encienda un guardar que exige cambios. */
  tocar?: () => void
  /** Lo que ya estaba en caché al abrir. */
  cache?: [unknown[], unknown]
}

const CASOS: Caso[] = [
  {
    nombre: 'Tarifas del negocio',
    ui: <VenuePaymentConfig />,
    path: '/v/:slug',
    url: '/v/negocio',
    lectura: /pricing-structures/,
    // Las tarifas sólo se leen con la configuración de pagos a la mano: sin ella la pantalla ni llega a ofrecerlas.
    cache: [['venue-payment-config', 'v1'], CONFIG_DE_PAGOS],
    dato: () => screen.findByRole('button', { name: /Editar Tarifas/ }),
    guardar: () => boton(/Editar Tarifas/),
    formulario: () => boton(/Configurar Tarifas/),
  },
  {
    nombre: 'Datos de la organización',
    ui: <OrganizationSettings />,
    path: '/organizations/:orgId/settings',
    url: '/organizations/org1/settings',
    lectura: /organizations\/org1$/,
    dato: valor('Org Real'),
    guardar: () => boton(/settings\.save/),
    tocar: () => cambiar('Org Real', 'Org Nueva'),
  },
  {
    nombre: 'Menú',
    ui: <MenuId />,
    path: '/menus/:menuId',
    url: '/menus/m1',
    lectura: /menus\/m1/,
    dato: valor('Menú Real'),
    guardar: () => boton(/menuId\.buttons\.save/),
    tocar: () => cambiar('Menú Real', 'Menú Nuevo'),
  },
  {
    nombre: 'Paquete de créditos',
    ui: <CreditPackFormModal open onClose={cerrar} packId="p1" onSuccess={cerrar} />,
    lectura: /credit-packs\/p1/,
    dato: valor('Paquete Real'),
    guardar: () => boton(/actions\.save/),
  },
  {
    nombre: 'Descuento',
    ui: <DiscountForm />,
    path: '/d/:discountId',
    url: '/d/d1',
    lectura: /discounts\/d1/,
    dato: valor('Descuento Real'),
    guardar: () => boton(/discounts\.actions\.save/),
  },
  {
    nombre: 'Servicio',
    ui: <ServiceFormDialog open onOpenChange={cerrar} mode="edit" productId="svc1" />,
    lectura: /products\/svc1/,
    dato: valor('Servicio Real'),
    guardar: () => boton(/^save$/),
  },
  {
    nombre: 'Grupo de modificadores',
    ui: <ModifiersManagerDialog venueId="v1" modifierGroupId="g1" onClose={cerrar} />,
    lectura: /modifier-groups\/g1/,
    dato: valor('Extras Reales'),
    guardar: () => boton(/modifiers\.forms\.save/),
    tocar: () => cambiar('Extras Reales', 'Extras Nuevos'),
  },
  {
    nombre: 'Grupo de modificadores (productos)',
    ui: <ModifiersManagerDialog venueId="v1" modifierGroupId="g1" onClose={cerrar} />,
    lectura: /\/products/,
    dato: valor('Extras Reales'),
    guardar: () => boton(/modifiers\.forms\.save/),
    tocar: () => cambiar('Extras Reales', 'Extras Nuevos'),
  },
  {
    nombre: 'Liga de pago',
    ui: <CreatePaymentLinkDialog open onClose={cerrar} editingLinkId="l1" />,
    lectura: /payment-links\/l1/,
    dato: valor('Liga Real'),
    guardar: () => boton(/^form\.save$/),
  },
  {
    nombre: 'Campaña del negocio',
    ui: <CampaignEditorModal venueId="v1" campaignId="c1" open onClose={cerrar} />,
    lectura: /venues\/v1\/campaigns\/c1/,
    dato: valor('Campaña Real'),
    guardar: () => boton(/campaigns\.saveDraft/),
  },
  {
    nombre: 'Aviso de privacidad',
    ui: <PrivacyNoticeModal venueId="v1" open onClose={cerrar} />,
    lectura: /privacy-notice/,
    dato: valor('Aviso real'),
    guardar: () => screen.queryByTestId('privacy-notice-save'),
  },
  {
    nombre: 'Puente de impresión',
    ui: <GatewayTab venueId="v1" />,
    lectura: /gateway/,
    dato: () => screen.findByText('TERM-REAL'),
    guardar: () => boton(/gateway\.edit/),
    formulario: () => boton(/gateway\.set/),
  },
  {
    nombre: 'Activar cobros',
    ui: <PaymentActivationPage />,
    lectura: /payment-activation/,
    dato: valor('Calle Real 1'),
    guardar: () => boton(/Guardar dirección/),
  },
  {
    nombre: 'Pagos de la organización (SUPERADMIN)',
    ui: <PaymentConfigDialog open onOpenChange={cerrar} organization={ORG} />,
    lectura: /organizations\/o1\/payment-config/,
    dato: () => waitFor(() => expect(boton(/Guardar Cuentas/)).toBeEnabled()),
    guardar: () => boton(/Guardar Cuentas/),
    formulario: () => boton(/Guardar Cuentas/),
  },
  {
    nombre: 'Campaña de plataforma (SUPERADMIN)',
    ui: <CampaignEditor />,
    path: '/m/:campaignId',
    url: '/m/mc1',
    lectura: /marketing\/campaigns\/mc1/,
    dato: valor('Campaña Super'),
    guardar: () => boton(/Guardar borrador/),
  },
  {
    nombre: 'Perfil fiscal',
    ui: <FiscalProfile />,
    lectura: /fiscal-profile/,
    dato: valor('RAZON REAL'),
    guardar: () => boton(/edit\.fiscal\.save/),
  },
]
const TABLA = CASOS.map(c => [c.nombre, c] as const)

let client: QueryClient
function montar({ ui, path = '/x', url = '/x', cache }: Pick<Caso, 'ui' | 'path' | 'url' | 'cache'>) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  if (cache) client.setQueryData(...cache)
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const noSeEscribio = () => {
  expect(m.put).not.toHaveBeenCalled()
  expect(m.patch).not.toHaveBeenCalled()
  // La vista previa de destinatarios del SUPERADMIN es un POST que sólo lee.
  expect(m.post.mock.calls.filter(([u]) => !/recipients\/preview/.test(u))).toHaveLength(0)
}
function sinFormularioNiGuardado(c: Caso) {
  expect((c.formulario ?? primerCampo)()).toBeNull()
  const guardar = c.guardar()
  if (guardar) {
    expect(guardar).toBeDisabled()
    fireEvent.click(guardar)
  }
  noSeEscribio()
}

beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockImplementation(lecturaSana)
  m.post.mockResolvedValue({ data: { total: 5, venueCount: 1, staffCount: 4 } })
  onlineManager.setOnline(true)
})
afterEach(() => {
  client?.clear()
  onlineManager.setOnline(true)
})

describe('Editar con la lectura sin llegar: no hay formulario ni guardado', () => {
  it.each(TABLA)('%s: con la lectura caída avisa y no deja guardar', async (_n, c) => {
    leeAsi(c.lectura, () => Promise.reject(new Error('500')))
    montar(c)
    await hayAviso()
    sinFormularioNiGuardado(c)
  })

  it.each(TABLA)('%s: sin internet avisa y no deja guardar', async (_n, c) => {
    onlineManager.setOnline(false)
    montar(c)
    await hayAviso()
    sinFormularioNiGuardado(c)
  })

  it.each(TABLA)('%s: mientras la lectura no llega no deja guardar y no asusta', async (_n, c) => {
    leeAsi(c.lectura, () => new Promise(() => {}))
    montar(c)
    const guardar = c.guardar()
    if (guardar) expect(guardar).toBeDisabled()
    sinAviso()
  })

  it.each(TABLA)('%s: al reintentar y llegar la lectura, el formulario trae lo real', async (_n, c) => {
    leeAsi(c.lectura, () => Promise.reject(new Error('500')))
    montar(c)
    await hayAviso()
    m.get.mockImplementation(lecturaSana)
    await client.refetchQueries()
    await c.dato()
    sinAviso()
  })

  it.each(TABLA)('%s: al volver el internet, el formulario trae lo real', async (_n, c) => {
    onlineManager.setOnline(false)
    montar(c)
    await hayAviso()
    onlineManager.setOnline(true)
    await c.dato()
    sinAviso()
  })
})

describe('Con la lectura sana, igual que hoy', () => {
  it.each(TABLA)('%s: trae lo real, sin aviso, y deja guardar', async (_n, c) => {
    montar(c)
    await c.dato()
    sinAviso()
    c.tocar?.()
    await waitFor(() => expect(c.guardar()).toBeEnabled())
  })

  it.each(TABLA)('%s: si falla la recarga con datos reales, los conserva, avisa y deja guardar', async (_n, c) => {
    montar(c)
    await c.dato()
    leeAsi(c.lectura, () => Promise.reject(new Error('500')))
    await client.refetchQueries()
    await hayAviso()
    await c.dato()
    c.tocar?.()
    await waitFor(() => expect(c.guardar()).toBeEnabled())
  })
})

describe('Crear no tiene lectura previa: sigue igual, también sin internet', () => {
  const CREAR: [string, Pick<Caso, 'ui' | 'path' | 'url'>, () => HTMLElement | null, boolean][] = [
    ['paquete de créditos', { ui: <CreditPackFormModal open onClose={cerrar} onSuccess={cerrar} /> }, () => boton(/actions\.save/), true],
    ['descuento', { ui: <DiscountForm /> }, () => boton(/discounts\.actions\.save/), true],
    ['servicio', { ui: <ServiceFormDialog open onOpenChange={cerrar} mode="create" serviceType="APPOINTMENTS_SERVICE" /> }, () => boton(/^create$/), true],
    ['campaña del negocio', { ui: <CampaignEditorModal venueId="v1" campaignId={null} open onClose={cerrar} /> }, () => boton(/campaigns\.saveDraft/), false],
    ['campaña de plataforma', { ui: <CampaignEditor /> }, () => boton(/Guardar borrador/), false],
    ['liga de pago', { ui: <CreatePaymentLinkDialog open onClose={cerrar} /> }, () => boton(/wizard\.continue/), false],
  ]
  const verifica = async ([, ui, guardar, encendido]: (typeof CREAR)[number]) => {
    montar(ui)
    await waitFor(() => expect(guardar()).toBeInTheDocument())
    if (encendido) expect(guardar()).toBeEnabled()
    sinAviso()
  }
  it.each(CREAR)('%s: con red', async (...caso) => {
    await verifica(caso)
  })
  it.each(CREAR)('%s: sin internet', async (...caso) => {
    onlineManager.setOnline(false)
    await verifica(caso)
  })
  it('campaña del negocio: sin internet se llena y deja guardar', async () => {
    onlineManager.setOnline(false)
    montar({ ui: <CampaignEditorModal venueId="v1" campaignId={null} open onClose={cerrar} /> })
    fireEvent.change(screen.getByLabelText('campaigns.fields.name'), { target: { value: 'Nueva' } })
    fireEvent.change(screen.getByLabelText('campaigns.fields.subject'), { target: { value: 'Asunto' } })
    expect(boton(/campaigns\.saveDraft/)).toBeEnabled()
  })
})

describe('`null` es un dato: no hay registro, y ahí sí se puede crear', () => {
  const nulo = (lectura: RegExp, cuerpo: unknown) => leeAsi(lectura, () => Promise.resolve({ data: cuerpo }))

  it('Puente de impresión: dice que no hay y deja configurarlo', async () => {
    nulo(/gateway/, { data: null })
    montar({ ui: <GatewayTab venueId="v1" /> })
    expect(await screen.findByRole('button', { name: /gateway\.set/ })).toBeEnabled()
    sinAviso()
  })
  it('Activar cobros: sale el formulario vacío', async () => {
    nulo(/payment-activation/, { data: null })
    montar({ ui: <PaymentActivationPage /> })
    expect(await screen.findByRole('button', { name: /Guardar dirección/ })).toBeEnabled()
    sinAviso()
  })
  it('Perfil fiscal: sale el formulario vacío', async () => {
    nulo(/fiscal-profile/, { data: null })
    montar({ ui: <FiscalProfile /> })
    expect(await screen.findByRole('button', { name: /edit\.fiscal\.save/ })).toBeEnabled()
    sinAviso()
  })
  it('Aviso de privacidad: se puede escribir el primero', async () => {
    nulo(/privacy-notice/, { data: { notice: null } })
    montar({ ui: <PrivacyNoticeModal venueId="v1" open onClose={cerrar} /> })
    await screen.findByText('privacyNotice.noVersion')
    fireEvent.change(screen.getByTestId('privacy-notice-textarea'), { target: { value: 'Mi primer aviso' } })
    expect(screen.getByTestId('privacy-notice-save')).toBeEnabled()
  })
  it('Pagos de la organización: sin configuración deja elegir cuenta', async () => {
    nulo(/organizations\/o1\/payment-config/, { paymentConfig: null, pricingStructures: [], venueInheritance: [] })
    montar({ ui: <PaymentConfigDialog open onOpenChange={cerrar} organization={ORG} /> })
    expect(await screen.findByRole('button', { name: /Guardar Cuentas/ })).toBeDisabled()
    sinAviso()
  })
  it('Tarifas: sin ninguna, deja configurarlas', async () => {
    nulo(/pricing-structures/, { data: [] })
    montar({ ui: <VenuePaymentConfig />, path: '/v/:slug', url: '/v/negocio' })
    expect(await screen.findByRole('button', { name: /Configurar Tarifas/ })).toBeEnabled()
    sinAviso()
  })
  it('Tarifas: con los costos caídos tampoco ofrece configurarlas, aunque la tarifa sí se leyó', async () => {
    leeAsi(/cost-structures/, () => Promise.reject(new Error('500')))
    montar({ ui: <VenuePaymentConfig />, path: '/v/:slug', url: '/v/negocio' })
    await hayAviso()
    expect(boton(/Configurar Tarifas/)).toBeNull()
  })
})
