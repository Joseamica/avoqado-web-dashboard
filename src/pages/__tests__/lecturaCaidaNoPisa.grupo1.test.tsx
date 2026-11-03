/**
 * Grupo 1 del D4 (medicion-formularios.md): formularios que se llenan de una lectura. Si la lectura cae o no llega, salen vacíos o con
 * valores de fábrica y al guardar el SERVIDOR pisa lo real. Corre con TanStack y los servicios de verdad: sólo se finge la red.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BadReviewSettingsDialog } from '@/components/Review/BadReviewSettingsCard'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import { resolvePermissions } from '@/lib/permissions/permissionDependencies'
import { notificationCategories } from '@/lib/notifications/categories'
import { DEFAULT_PAYMENT_LINK_BRANDING, DEFAULT_PAYMENT_LINK_SETTINGS } from '@/services/paymentLink.service'
import { DEFAULT_RESERVATION_BRANDING } from '@/services/reservationBranding.service'
import { StaffRole } from '@/types'
import OrgPayoutConfigSection from '../Commissions/components/OrgPayoutConfigSection'
import { BirthdayAutomationCard } from '../Customers/components/BirthdayAutomationCard'
import AutoReorderSettings from '../Inventory/AutoReorderSettings'
import { RawMaterialPresentationsSection } from '../Inventory/components/RawMaterialPresentationsSection'
import { RecipeDialog } from '../Inventory/components/RecipeDialog'
import WalletCardDesigner from '../Loyalty/WalletCardDesigner'
import NotificationPreferences2 from '../Notifications/NotificationPreferences2'
import PaymentLinkBranding from '../PaymentLinks/PaymentLinkBranding'
import PaymentLinkSettings from '../PaymentLinks/PaymentLinkSettings'
import { EditBrandIdentityModal } from '../Reservations/components/EditBrandIdentityModal'
import ReservationBranding from '../Reservations/ReservationBranding'
import ReservationSettings from '../Reservations/ReservationSettings'
import GoogleIntegration from '../Settings/GoogleIntegration'
import { PermissionEditorModal } from '../Settings/components/PermissionEditorModal'
import { WorkScheduleSection } from '../Team/components/WorkScheduleSection'

// Radix usa pointer capture, que jsdom no trae. Funciones planas: `mockReset: true` vaciaría un vi.fn().
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const m = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  t: (k: string, o?: string | { defaultValue?: string }) => (typeof o === 'string' ? o : (o?.defaultValue ?? k)),
  // Las mismas referencias en cada pintada, como las dan sus contextos: un objeto nuevo reiniciaría los formularios.
  venue: { venueId: 'v1', venueSlug: 'mi-negocio', fullBasePath: '/venues/mi-negocio', venue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City' } },
  auth: {
    user: { role: 'SUPERADMIN', venues: [] },
    staffInfo: { role: 'OWNER' },
    checkFeatureAccess: () => true,
    checkModuleAccess: () => false,
  },
}))
vi.mock('@/api', () => ({ default: { get: m.get, put: m.put, post: m.post, patch: m.patch, delete: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => m.venue }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => m.auth }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/useReservationSettingsTour', () => ({ useReservationSettingsTour: () => ({ start: () => undefined }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactElement }) => children }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: m.t, i18n: { language: 'es' } }), Trans: () => null }))
vi.mock('@/firebase', () => ({ storage: {}, buildStoragePath: (p: string) => p }))
vi.mock('firebase/storage', () => ({ getDownloadURL: async () => '', ref: () => ({}), uploadBytesResumable: () => ({}) }))
vi.mock('../PaymentLinks/fonts-eager', () => ({}))
vi.mock('../Inventory/components/AddIngredientDialog', () => ({ AddIngredientDialog: () => null }))
vi.mock('../Customers/components/CampaignBlocksEditor', () => ({ CampaignBlocksEditor: () => null }))
vi.mock('../Loyalty/components/CounterPosterCard', () => ({ default: () => null }))
vi.mock('../Loyalty/components/WalletCardPreview', () => ({ WalletCardPreview: () => null }))
vi.mock('@/pages/GoogleCalendar/components/GoogleCalendarConnectionCard', () => ({ GoogleCalendarConnectionCard: () => null }))
vi.mock('../Reservations/components/GoogleCalendarDeadLetterBanner', () => ({ GoogleCalendarDeadLetterBanner: () => null }))
vi.mock('../Reservations/components/GoogleCalendarPrivacySection', () => ({ GoogleCalendarPrivacySection: () => null }))
vi.mock('../Reservations/components/ReservationStaffConfiguration', () => ({ ReservationStaffConfiguration: () => null }))

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const PERMISOS_DEL_ROL = Array.from(resolvePermissions(DEFAULT_PERMISSIONS[StaffRole.WAITER]))
const TIPO_DE_AVISO = notificationCategories[0].types[0].type
const RECETA = {
  portionYield: 4,
  prepTime: 10,
  cookTime: 20,
  notes: 'Con cariño',
  totalCost: 40,
  lines: [
    { id: 'l1', rawMaterialId: 'rm1', quantity: 2, unit: 'PIECE', isOptional: false, substituteNotes: null, isVariable: false, linkedModifierGroupId: null, costPerServing: 5, rawMaterial: { name: 'Huevo', unit: 'PIECE', costPerUnit: 5 } },
    { id: 'l2', rawMaterialId: 'rm2', quantity: 1, unit: 'LITER', isOptional: false, substituteNotes: null, isVariable: false, linkedModifierGroupId: null, costPerServing: 5, rawMaterial: { name: 'Leche', unit: 'LITER', costPerUnit: 20 } },
  ],
}
const RESERVACIONES = {
  scheduling: { slotIntervalMin: 30, defaultDurationMin: 60, autoConfirm: false, maxAdvanceDays: 90, minNoticeMin: 30, noShowGraceMin: 10, nightlyOutreachEnabled: false, pacingMaxPerSlot: 4, onlineCapacityPercent: 80 },
  deposits: { mode: 'deposit', fixedAmount: 150, percentageOfTotal: null, requiredForPartySizeGte: null },
  payments: { appointmentUpfrontDefault: 'required', classUpfrontDefault: 'required' },
  publicBooking: { enabled: true, requirePhone: true, requireEmail: false, requireAccount: false, requireCustomerApproval: false },
  cancellation: { allowCustomerCancel: true, minHoursBeforeStart: 24, forfeitDeposit: true, noShowFeePercent: 50, creditRefundMode: 'TIME_BASED', creditFreeRefundHoursBefore: 12, creditLateRefundPercent: 0, creditNoShowRefund: false, allowCustomerReschedule: true },
  waitlist: { enabled: true, maxSize: 50, priorityMode: 'fifo', notifyWindowMin: 30 },
  reminders: { enabled: true, channels: ['EMAIL'], minutesBefore: [1440] },
  operatingHours: null,
  canChargeOnline: true,
}
const LUNES = { enabled: true, ranges: [{ open: '07:00', close: '15:00' }] }
const DIA_LIBRE = { enabled: false, ranges: [] }
const SEMANA = { monday: LUNES, tuesday: DIA_LIBRE, wednesday: DIA_LIBRE, thursday: DIA_LIBRE, friday: DIA_LIBRE, saturday: DIA_LIBRE, sunday: DIA_LIBRE }

/** Las respuestas sanas, en la forma que devuelve el SERVIDOR. La primera que coincide con la URL gana. */
const LECTURAS: [RegExp, unknown][] = [
  [/role-permissions/, { data: [{ role: StaffRole.WAITER, permissions: PERMISOS_DEL_ROL, deniedPermissions: [], isCustom: false }] }],
  [/role-config/, { configs: [{ role: StaffRole.WAITER, displayName: 'Anfitrión', description: 'Recibe gente', isActive: true, showAsSeller: false }] }],
  [/inventory\/products\/p1\/recipe/, { data: RECETA }],
  [/reservations\/settings/, RESERVACIONES],
  [/reservations\/branding/, { ...DEFAULT_RESERVATION_BRANDING, accentColor: '#123456', showLogo: false }],
  [/org-payout-config/, { data: { aggregationPeriod: 'WEEKLY', requireApproval: false, paymentMethods: ['CASH'] } }],
  [/loyalty\/card-design/, { backgroundColor: '#112233', foregroundColor: '#ffffff', labelColor: '#ffffff', stampShape: 'CIRCLE' }],
  [/loyalty\/config/, { active: true, stampsEnabled: true, stampsRequired: 7, stampRewardType: 'FREE_PRODUCT', stampRewardValue: null, stampRewardLabel: 'Café gratis' }],
  [/inventory\/auto-reorder/, { config: { enabled: true, dailyCapMxn: 500, minUrgency: 'HIGH' }, hasDeliveryAddress: true, preview: { items: [] } }],
  [/raw-materials\/rm1\/presentations/, { data: [{ name: 'Caja', factorToBase: 12 }] }],
  [/payment-links\/settings/, { ...DEFAULT_PAYMENT_LINK_SETTINGS, merchantPolicies: 'Sin devoluciones', notifyOnPaid: false }],
  [/payment-links\/branding/, { ...DEFAULT_PAYMENT_LINK_BRANDING, buttonColor: '#123456', showLogo: false }],
  [/birthday-automation/, { data: { automation: { id: 'a1', status: 'ACTIVE', subject: 'Feliz día', contentBlocks: [], daysBefore: 3 } } }],
  [/integrations\/google\/status/, { connected: false }],
  [/venues\/v1\/settings$/, { notifyBadReviews: false, badReviewThreshold: 2, badReviewAlertRoles: [StaffRole.OWNER], googleReviewLink: 'https://g.page/r/real/review' }],
  [/work-schedule/, { weekly: SEMANA, exceptions: [] }],
  [/notifications\/preferences/, { data: [{ type: TIPO_DE_AVISO, enabled: true, channels: ['SMS'], priority: 'NORMAL' }] }],
  [/venues\/v1$/, { id: 'v1', name: 'Mi negocio', logo: 'https://x/chico.png', logoFull: 'https://x/grande.png', heroImageUrl: 'https://x/portada.png', primaryColor: '#123456' }],
]
function lecturaSana(url: string) {
  const hit = LECTURAS.find(([re]) => re.test(url))
  return Promise.resolve({ data: hit ? hit[1] : {} })
}

let client: QueryClient
function montar(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/venues/mi-negocio/pantalla']}>
        <Routes>
          <Route path="/venues/:slug/pantalla" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Deja que acaben las lecturas (las pausadas no cuentan) y lo que dispararon. */
async function asentar() {
  await waitFor(() => expect(client.isFetching()).toBe(0))
  await act(async () => {
    await new Promise(r => setTimeout(r, 30))
  })
}
const escrituras = () => [...m.put.mock.calls, ...m.post.mock.calls, ...m.patch.mock.calls]
const nadaEscribio = () => expect(escrituras()).toEqual([])
/** Toca lo que se deje tocar: un guardado nunca truena por no encontrar su botón, truena por haber escrito. */
const toca = (el: Element | undefined | null) => {
  if (el && !(el as HTMLButtonElement).disabled) fireEvent.click(el)
}
const boton = (name: string | RegExp) => screen.queryAllByRole('button', { name, hidden: true })[0]
const prendeOApaga = () => toca(screen.queryAllByRole('switch').find(s => !(s as HTMLButtonElement).disabled))
const escribe = (el: Element | undefined, value: string) => {
  if (el && !(el as HTMLInputElement).disabled) fireEvent.change(el, { target: { value } })
}

type Caso = {
  nombre: string
  ui: () => ReactElement
  /** La lectura que, si no llega, deja el formulario vacío. */
  lectura: RegExp
  /** El menor camino para pisar: lo que hoy hace salir la escritura. */
  guardar: () => void | Promise<void>
  /** Con la lectura sana, lo que sale conserva lo real. */
  conservaLoReal: (cuerpo: any) => void
  /** Las pantallas que ya tenían su propio aviso lo conservan. */
  aviso?: string
}

const CASOS: Caso[] = [
  {
    nombre: 'Permisos del rol',
    ui: () => <PermissionEditorModal open onClose={() => undefined} role={StaffRole.WAITER} venueId="v1" />,
    lectura: /role-permissions/,
    guardar: () => {
      // Sin nada marcado la categoría sale cerrada: se abre con su interruptor, que ya es «marcar».
      toca(screen.queryAllByRole('checkbox').find(c => !(c as HTMLButtonElement).disabled) ?? screen.queryAllByRole('switch', { name: 'rolePermissions.selectAll' })[0])
      toca(boton('rolePermissions.saveChanges'))
    },
    // Marcar una casilla no le quita al rol lo que ya tenía.
    conservaLoReal: cuerpo => expect(cuerpo.deniedPermissions.length).toBeLessThan(5),
  },
  {
    nombre: 'Receta (editar)',
    ui: () => <RecipeDialog open onOpenChange={() => undefined} mode="edit" product={{ id: 'p1', name: 'Pastel', price: 100 }} />,
    lectura: /inventory\/products\/p1\/recipe/,
    guardar: () => toca(boton(/^save$/)),
    conservaLoReal: cuerpo => expect(cuerpo.lines.map((l: { rawMaterialId: string }) => l.rawMaterialId)).toEqual(['rm1', 'rm2']),
  },
  {
    nombre: 'Ajustes de reservaciones',
    ui: () => <ReservationSettings />,
    lectura: /reservations\/settings/,
    guardar: () => {
      prendeOApaga()
      toca(boton('actions.saveChanges'))
    },
    conservaLoReal: cuerpo => {
      expect(cuerpo.deposits).toMatchObject({ mode: 'deposit', fixedAmount: 150 })
      expect(cuerpo.cancellation).toMatchObject({ noShowFeePercent: 50, forfeitDeposit: true })
    },
  },
  {
    nombre: 'Pago de comisiones de la organización',
    ui: () => <OrgPayoutConfigSection />,
    lectura: /org-payout-config/,
    guardar: () => {
      prendeOApaga()
      toca(boton('orgPayout.save'))
    },
    conservaLoReal: cuerpo => expect(cuerpo).toMatchObject({ aggregationPeriod: 'WEEKLY', paymentMethods: ['CASH'] }),
  },
  {
    nombre: 'Programa de sellos',
    ui: () => <WalletCardDesigner />,
    lectura: /loyalty\/config/,
    guardar: () => toca(boton('card.program.save')),
    conservaLoReal: cuerpo => expect(cuerpo).toMatchObject({ stampsEnabled: true, stampsRequired: 7, stampRewardLabel: 'Café gratis' }),
  },
  {
    nombre: 'Reabasto automático',
    ui: () => <AutoReorderSettings />,
    lectura: /inventory\/auto-reorder/,
    guardar: () => toca(boton('autoReorder.save')),
    conservaLoReal: cuerpo => expect(cuerpo).toEqual({ enabled: true, dailyCapMxn: 500, minUrgency: 'HIGH' }),
  },
  {
    nombre: 'Presentaciones del insumo',
    ui: () => <RawMaterialPresentationsSection venueId="v1" rawMaterialId="rm1" baseUnit="PIECE" canEdit />,
    lectura: /raw-materials\/rm1\/presentations/,
    guardar: () => {
      toca(boton('presentations.add'))
      escribe(screen.queryAllByPlaceholderText('presentations.namePlaceholder').slice(-1)[0], 'Bolsa')
      escribe(screen.queryAllByPlaceholderText('0').slice(-1)[0], '6')
      toca(boton('presentations.save'))
    },
    conservaLoReal: cuerpo =>
      expect(cuerpo.presentations).toEqual([
        { name: 'Caja', factorToBase: 12 },
        { name: 'Bolsa', factorToBase: 6 },
      ]),
  },
  {
    nombre: 'Ajustes de ligas de pago',
    ui: () => <PaymentLinkSettings />,
    lectura: /payment-links\/settings/,
    guardar: () => {
      prendeOApaga()
      toca(boton('settings.save'))
    },
    conservaLoReal: cuerpo => expect(cuerpo.merchantPolicies).toBe('Sin devoluciones'),
  },
  {
    nombre: 'Marca de ligas de pago',
    ui: () => <PaymentLinkBranding />,
    lectura: /payment-links\/branding/,
    guardar: () => {
      prendeOApaga()
      toca(boton(/Guardar cambios/))
    },
    conservaLoReal: cuerpo => expect(cuerpo.buttonColor).toBe('#123456'),
  },
  {
    nombre: 'Marca de reservaciones',
    ui: () => <ReservationBranding />,
    lectura: /reservations\/branding/,
    guardar: () => {
      prendeOApaga()
      toca(boton(/Guardar cambios/))
    },
    conservaLoReal: cuerpo => expect(cuerpo.accentColor).toBe('#123456'),
  },
  {
    nombre: 'Identidad de marca',
    ui: () => <EditBrandIdentityModal open onClose={() => undefined} />,
    lectura: /venues\/v1$/,
    guardar: () => {
      toca(boton('onlineBooking.brandIdentity.next'))
      toca(boton('onlineBooking.brandIdentity.complete'))
    },
    conservaLoReal: cuerpo => expect(cuerpo).toEqual({ logo: 'https://x/chico.png', logoFull: 'https://x/grande.png', heroImageUrl: 'https://x/portada.png', primaryColor: '#123456' }),
  },
  {
    nombre: 'Felicitación de cumpleaños',
    ui: () => <BirthdayAutomationCard venueId="v1" />,
    lectura: /birthday-automation/,
    guardar: () => {
      toca(screen.queryByTestId('birthday-configure'))
      toca(screen.queryByTestId('birthday-save'))
    },
    conservaLoReal: cuerpo => expect(cuerpo).toMatchObject({ subject: 'Feliz día', daysBefore: 3, activa: true }),
  },
  {
    nombre: 'Alertas de reseñas malas',
    ui: () => <BadReviewSettingsDialog open onOpenChange={() => undefined} />,
    lectura: /venues\/v1\/settings$/,
    guardar: () => {
      prendeOApaga()
      toca(boton('common.save'))
    },
    conservaLoReal: cuerpo => expect(cuerpo).toMatchObject({ badReviewThreshold: 2, badReviewAlertRoles: [StaffRole.OWNER] }),
  },
  {
    nombre: 'Liga de reseñas de Google',
    ui: () => <GoogleIntegration />,
    lectura: /venues\/v1\/settings$/,
    guardar: () => toca(boton('reviewRedirect.save')),
    conservaLoReal: cuerpo => expect(cuerpo).toEqual({ googleReviewLink: 'https://g.page/r/real/review' }),
  },
  {
    nombre: 'Horario de la persona',
    ui: () => <WorkScheduleSection venueId="v1" staffVenueId="sv1" />,
    lectura: /work-schedule/,
    guardar: () => {
      toca(document.getElementById('ws-toggle'))
      toca(document.getElementById('ws-toggle'))
      toca(boton('workSchedule.save'))
    },
    conservaLoReal: cuerpo => expect(cuerpo.weekly.monday).toEqual(LUNES),
    aviso: 'workSchedule.loadErrorTitle',
  },
  {
    nombre: 'Preferencias de avisos',
    ui: () => <NotificationPreferences2 />,
    lectura: /notifications\/preferences/,
    guardar: () => toca(boton(/channelNames\.EMAIL/)),
    conservaLoReal: cuerpo => expect(cuerpo).toEqual({ type: TIPO_DE_AVISO, channels: ['SMS', 'EMAIL'] }),
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockImplementation(lecturaSana)
  for (const escribir of [m.put, m.post, m.patch]) escribir.mockResolvedValue({ data: {} })
  onlineManager.setOnline(true)
})
afterEach(() => {
  client?.clear()
  onlineManager.setOnline(true)
})

describe.each(CASOS)('$nombre', ({ ui, lectura, guardar, conservaLoReal, aviso = 'loadFailure.empty' }) => {
  it('con la lectura caída avisa y no sale ninguna escritura', async () => {
    m.get.mockImplementation((url: string) => (lectura.test(url) ? Promise.reject(new Error('500')) : lecturaSana(url)))
    montar(ui())
    await asentar()
    await guardar()
    await asentar()
    nadaEscribio()
    expect(screen.getAllByText(aviso).length).toBeGreaterThan(0)
  })

  it('sin internet tampoco: ni al volver la red sale nada', async () => {
    onlineManager.setOnline(false)
    montar(ui())
    await asentar()
    const avisos = screen.queryAllByText(aviso).length
    await guardar()
    await asentar()
    act(() => onlineManager.setOnline(true)) // sin red la mutación queda en pausa y saldría aquí
    await asentar()
    nadaEscribio()
    expect(avisos).toBeGreaterThan(0)
  })

  it('mientras la lectura no llega no deja guardar', async () => {
    m.get.mockImplementation((url: string) => (lectura.test(url) ? new Promise(() => {}) : lecturaSana(url)))
    montar(ui())
    await act(async () => {
      await new Promise(r => setTimeout(r, 30))
    })
    await guardar()
    await act(async () => {
      await new Promise(r => setTimeout(r, 30))
    })
    nadaEscribio()
    expect(screen.queryByText(aviso)).toBeNull()
  })

  it('con la lectura sana no avisa y guarda lo real', async () => {
    montar(ui())
    await asentar()
    expect(screen.queryByText(aviso)).toBeNull()
    await guardar()
    await waitFor(() => expect(escrituras()).toHaveLength(1))
    conservaLoReal(escrituras()[0][1])
  })
})

describe('recarga caída con datos previos', () => {
  it.each(CASOS.filter(c => c.nombre !== 'Horario de la persona'))('$nombre: conserva lo real, avisa y deja guardar', async ({ ui, lectura, guardar, conservaLoReal }) => {
    montar(ui())
    await asentar()
    m.get.mockImplementation((url: string) => (lectura.test(url) ? Promise.reject(new Error('500')) : lecturaSana(url)))
    await act(async () => {
      await client.refetchQueries()
    })
    await screen.findByText('loadFailure.partial')
    await guardar()
    await waitFor(() => expect(escrituras()).toHaveLength(1))
    conservaLoReal(escrituras()[0][1])
  })

  it('Horario de la persona: conserva lo real, avisa y deja guardar', async () => {
    montar(<WorkScheduleSection venueId="v1" staffVenueId="sv1" />)
    await asentar()
    m.get.mockRejectedValue(new Error('500'))
    await act(async () => {
      await client.refetchQueries()
    })
    await screen.findByText('loadFailure.partial')
    expect(screen.queryByText('workSchedule.loadErrorTitle')).toBeNull()
    toca(document.getElementById('ws-toggle'))
    toca(document.getElementById('ws-toggle'))
    toca(boton('workSchedule.save'))
    await waitFor(() => expect(escrituras()).toHaveLength(1))
    expect((escrituras()[0][1] as { weekly: { monday: unknown } }).weekly.monday).toEqual(LUNES)
  })
})

describe('los casos que no son un fallo', () => {
  it('Receta en modo CREAR no tiene lectura previa: el formulario sigue ahí, sin aviso', async () => {
    montar(<RecipeDialog open onOpenChange={() => undefined} mode="create" product={{ id: 'p1', name: 'Pastel', price: 100 }} />)
    await asentar()
    expect(boton(/^save$/)).toBeEnabled()
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })

  it('Pago de comisiones: `null` significa que no hay registro y ahí sí se puede crear', async () => {
    m.get.mockImplementation((url: string) => (/org-payout-config/.test(url) ? Promise.resolve({ data: { data: null } }) : lecturaSana(url)))
    montar(<OrgPayoutConfigSection />)
    await asentar()
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
    prendeOApaga()
    toca(boton('orgPayout.save'))
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1))
    expect(m.put.mock.calls[0][1]).toMatchObject({ aggregationPeriod: 'MONTHLY' })
  })

  it('Felicitación: `automation: null` sigue siendo «sin configurar» y se puede crear', async () => {
    m.get.mockImplementation((url: string) => (/birthday-automation/.test(url) ? Promise.resolve({ data: { data: { automation: null } } }) : lecturaSana(url)))
    montar(<BirthdayAutomationCard venueId="v1" />)
    await asentar()
    expect(screen.getByTestId('birthday-status')).toHaveTextContent('birthday.notConfigured')
    fireEvent.click(screen.getByTestId('birthday-configure'))
    await asentar()
    fireEvent.click(screen.getByTestId('birthday-save'))
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1))
  })
})

describe('Permisos del rol: la apariencia se llena de OTRA lectura', () => {
  it('sin poder leer los nombres del rol no ofrece editarlos: guardaría el nombre de fábrica encima del propio', async () => {
    m.get.mockImplementation((url: string) =>
      /role-config/.test(url) ? Promise.reject(Object.assign(new Error('403'), { response: { status: 403 } })) : lecturaSana(url),
    )
    montar(<PermissionEditorModal open onClose={() => undefined} role={StaffRole.WAITER} venueId="v1" />)
    await asentar()
    expect(screen.getByText('loadFailure.forbidden')).toBeInTheDocument()
    const apariencia = screen.getByText('Apariencia').closest('button')
    expect(apariencia).toBeDisabled()
    toca(apariencia)
    expect(document.getElementById('role-display-name')).toBeNull()
    expect(screen.queryAllByRole('checkbox').length).toBeGreaterThan(0) // los permisos sí se leyeron: se siguen editando
  })

  it('con la lectura sana se abre con el nombre real', async () => {
    montar(<PermissionEditorModal open onClose={() => undefined} role={StaffRole.WAITER} venueId="v1" />)
    await asentar()
    toca(screen.getByText('Apariencia').closest('button'))
    expect(document.getElementById('role-display-name')).toHaveValue('Anfitrión')
  })
})
