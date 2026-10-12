// RH fase 1a · Tarea 12: la ficha de una persona en pestañas. Las secciones que ya existían (horario, nivel de pago,
// expediente, comisiones) se fingen con un marcador: aquí se prueba DÓNDE aparecen y con qué candado, y lo nuevo de
// «Puesto y pago» (asignar con relación, la oferta de rol que nunca se ejecuta sola y la marca blanca).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asignacion, Puesto } from '@/types/rh'
import { hoyEnSede } from '@/pages/StaffPay/hoyEnSede'
import TeamId from '../TeamId'

type Mutacion = {
  mutate: ReturnType<typeof vi.fn>
  mutateAsync: ReturnType<typeof vi.fn>
  isPending: boolean
  isPaused: boolean
  cancelarEnPausa: ReturnType<typeof vi.fn>
}
const m = vi.hoisted(() => ({
  // No son vi.fn: `mockReset: true` (vitest.config) los borraría antes de cada prueba.
  sinPermiso: [] as string[],
  marcaBlanca: false,
  modoMarcaBlanca: false,
  getTeamMember: vi.fn(),
  historial: vi.fn(),
  resumen: vi.fn(),
  positions: vi.fn(),
  asignarHook: vi.fn(),
  cambiarHook: vi.fn(),
  terminarHook: vi.fn(),
  quitarMiembro: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) => (o && typeof o === 'object' && !('defaultValue' in o) ? `${k}:${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => !m.sinPermiso.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'v1',
    venueSlug: 'centro',
    isWhiteLabelMode: m.modoMarcaBlanca,
    venue: { settings: { attendanceEnabled: true } },
    fullBasePath: '/venues/centro',
  }),
}))
vi.mock('@/hooks/useWhiteLabelConfig', () => ({ useWhiteLabelConfig: () => ({ isWhiteLabelEnabled: m.marcaBlanca }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ staffInfo: { role: 'OWNER' } }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }) }))
vi.mock('@/hooks/use-role-config', () => ({
  useRoleConfig: () => ({ getDisplayName: (r: string) => `rol:${r}`, isRoleActive: () => true }),
}))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (d: unknown) => String(d),
    formatCalendarDate: (d: string) => d,
    // UTC+14: el día de la sede casi nunca coincide con el del navegador (ni con UTC), así que no puede pasar por casualidad.
    venueTimezone: 'Pacific/Kiritimati',
  }),
}))
vi.mock('@/services/team.service', () => ({
  default: {
    getTeamMember: (...a: unknown[]) => m.getTeamMember(...a),
    getDeactivationImpact: () => Promise.resolve({}),
    removeTeamMember: (...a: unknown[]) => m.quitarMiembro(...a),
  },
}))
// `useInvalidarConteosDePuesto` y `rhKeys` son los de verdad (se prueba que la ficha refresca [rh, sede]); lo demás se finge.
vi.mock('@/hooks/useRh', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useRh')>()),
  useStaffAssignments: (s?: string, p?: number) => m.historial(s, p),
  usePayOverview: (s?: string, e?: boolean) => m.resumen(s, e),
  usePositions: (o: unknown, e?: boolean) => m.positions(o, e),
  useAssignPosition: () => m.asignarHook(),
  useChangeAssignment: () => m.cambiarHook(),
  useEndAssignment: () => m.terminarHook(),
}))
vi.mock('../components/WorkScheduleSection', () => ({ WorkScheduleSection: () => <div data-testid="seccion-horario" /> }))
vi.mock('../components/NivelDePagoSection', () => ({ NivelDePagoSection: () => <div data-testid="seccion-nivel" /> }))
vi.mock('../components/StaffDocuments', () => ({ StaffDocuments: () => <div data-testid="seccion-expediente" /> }))
vi.mock('../components/TeamCommissionSection', () => ({ default: () => <div data-testid="seccion-comisiones" /> }))
vi.mock('../components/EditTeamMemberForm', () => ({ default: () => <div data-testid="form-editar-miembro" /> }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  // El Dialog de editar miembro (real) pregunta si vive dentro de un modal de pantalla completa.
  useIsInsideFullScreenModal: () => false,
  FullScreenModal: ({
    open,
    children,
    actions,
    onClose,
  }: {
    open: boolean
    children: ReactNode
    actions?: ReactNode
    onClose: () => void
  }) =>
    open ? (
      <div>
        <button type="button" onClick={onClose}>
          cerrar-modal
        </button>
        {actions}
        {children}
      </div>
    ) : null,
}))
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

const miembro = (o: Record<string, unknown> = {}) => ({
  id: 'sv1',
  staffId: 's1',
  firstName: 'Ana',
  lastName: 'Ruiz',
  email: 'ana@ejemplo.mx',
  role: 'CASHIER',
  active: true,
  startDate: '2026-01-05',
  endDate: null,
  pin: null,
  totalSales: 1000,
  totalTips: 100,
  totalOrders: 10,
  averageRating: 0,
  permissionSetId: null,
  permissionSetName: null,
  venue: { id: 'v1', name: 'Centro', organization: { name: 'Org' } },
  ...o,
})
const puesto = (o: Partial<Puesto> = {}): Puesto => ({
  id: 'p1',
  name: 'Mesero',
  color: null,
  icon: null,
  suggestedRole: 'WAITER',
  suggestedRelation: null,
  tracksAttendanceDefault: true,
  componentKinds: [],
  archivedAt: null,
  personasVigentes: 0,
  ...o,
})
const asignacion = (o: Partial<Asignacion> = {}): Asignacion => ({
  id: 'a1',
  staffId: 's1',
  positionId: 'p1',
  positionName: 'Mesero',
  relation: null,
  effectiveFrom: '2026-09-01',
  effectiveTo: null,
  tracksAttendance: true,
  supersedesId: null,
  ...o,
})
const pagina = <T,>(data: T[], total = data.length, hasMore = false) => ({ data, total, hasMore })
const consulta = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() })
const mutacion = (): Mutacion => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isPaused: false,
  cancelarEnPausa: vi.fn(),
})

let asignar: Mutacion
let cambiar: Mutacion
let terminar: Mutacion

beforeEach(() => {
  m.sinPermiso = []
  m.marcaBlanca = false
  m.modoMarcaBlanca = false
  m.getTeamMember.mockResolvedValue(miembro())
  m.historial.mockReturnValue(consulta(pagina<Asignacion>([])))
  m.resumen.mockReturnValue(consulta({ comisiones: [], nivelDeClase: null, propinas: { regla: 'ATIENDE_LUEGO_COBRA' } }))
  m.positions.mockReturnValue(consulta(pagina([puesto()])))
  asignar = mutacion()
  cambiar = mutacion()
  terminar = mutacion()
  m.asignarHook.mockReturnValue(asignar)
  m.cambiarHook.mockReturnValue(cambiar)
  m.terminarHook.mockReturnValue(terminar)
})
afterEach(() => {
  vi.useRealTimers()
})

async function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/venues/centro/team/sv1']}>
        <Routes>
          <Route path="/venues/:slug/team/:memberId" element={<TeamId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { name: 'Ana Ruiz' })
  return cliente
}
const pestanas = () => screen.getAllByRole('tab').map(b => b.textContent)
const abrirPestana = (clave: string) => fireEvent.click(screen.getByRole('tab', { name: clave }))
const campo = (nombre: string) => screen.getByRole('combobox', { name: nombre }) as HTMLSelectElement
const hoy = hoyEnSede('Pacific/Kiritimati')
const conPuestos = (currentAssignments: Asignacion[]) => m.getTeamMember.mockResolvedValue(miembro({ currentAssignments }))

describe('Ficha de la persona en pestañas (RH 1a)', () => {
  it('las pestañas son, en orden, Resumen · Puesto y pago · Asistencia y turnos · Recibos · Documentos', async () => {
    await montar()
    expect(pestanas()).toEqual([
      'profile.tabs.summary',
      'profile.tabs.positionAndPay',
      'profile.tabs.attendance',
      'profile.tabs.receipts',
      'profile.tabs.documents',
    ])
    expect(screen.getByRole('tab', { name: 'profile.tabs.summary' })).toHaveAttribute('aria-selected', 'true')
    abrirPestana('profile.tabs.receipts')
    expect(screen.getByRole('tab', { name: 'profile.tabs.receipts' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'profile.tabs.summary' })).toHaveAttribute('aria-selected', 'false')
  })

  it('«Resumen» es la de entrada y conserva el contenido de rendimiento de hoy', async () => {
    await montar()
    expect(screen.getByText('detail.performance.title')).toBeInTheDocument()
    expect(screen.getByText('detail.insights.title')).toBeInTheDocument()
    expect(screen.queryByTestId('seccion-horario')).toBeNull()
    expect(screen.queryByTestId('seccion-nivel')).toBeNull()
    expect(screen.queryByTestId('seccion-expediente')).toBeNull()
  })

  it('cada sección vive sólo en su pestaña: horario en Asistencia, nivel y comisiones en Puesto y pago, expediente en Documentos', async () => {
    await montar()
    abrirPestana('profile.tabs.attendance')
    expect(screen.getByTestId('seccion-horario')).toBeInTheDocument()
    expect(screen.queryByTestId('seccion-nivel')).toBeNull()
    expect(screen.queryByTestId('seccion-expediente')).toBeNull()

    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.getByTestId('seccion-nivel')).toBeInTheDocument()
    expect(screen.getByTestId('seccion-comisiones')).toBeInTheDocument()
    expect(screen.queryByTestId('seccion-horario')).toBeNull()

    abrirPestana('profile.tabs.documents')
    expect(screen.getByTestId('seccion-expediente')).toBeInTheDocument()
    expect(screen.queryByTestId('seccion-nivel')).toBeNull()
  })

  it('cada sección conserva su permiso de hoy; Comisiones ya no es pestaña y sigue tras commissions:read', async () => {
    m.sinPermiso = ['attendance:read', 'staffpay:read', 'staff-documents:read', 'commissions:read']
    await montar()
    expect(pestanas()).toEqual(['profile.tabs.summary', 'profile.tabs.positionAndPay'])
    expect(pestanas()).not.toContain('detail.tabs.commissions')
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.queryByTestId('seccion-nivel')).toBeNull()
    expect(screen.queryByTestId('seccion-comisiones')).toBeNull()
  })

  it('en el modo de marca blanca (/wl/) no hay horario, nivel, recibos ni expediente, igual que hoy', async () => {
    m.modoMarcaBlanca = true
    await montar()
    expect(pestanas()).toEqual(['profile.tabs.summary', 'profile.tabs.positionAndPay'])
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.queryByTestId('seccion-nivel')).toBeNull()
    expect(screen.getByTestId('seccion-comisiones')).toBeInTheDocument()
  })

  it('asignar con la relación sin tocar manda relation: null, con la fecha de hoy DE LA SEDE y sin fechas futuras', async () => {
    // 12-oct 11:00 UTC: en Kiritimati (UTC+14) ya es 13-oct; en el navegador (de UTC-12 a UTC+12) todavía no.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T11:00:00Z'))
    const hoyKiritimati = '2026-10-13'
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(screen.getByRole('button', { name: 'profile.assign' }))
    const fecha = screen.getByLabelText('profile.date')
    expect(fecha).toHaveValue(hoyKiritimati)
    expect(fecha).toHaveAttribute('max', hoyKiritimati)
    expect(within(campo('relation')).getAllByRole('option')[1]).toHaveValue('none')
    fireEvent.change(campo('positionId'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(asignar.mutateAsync).toHaveBeenCalledWith({
        staffId: 's1',
        body: { positionId: 'p1', relation: null, fecha: hoyKiritimati, tracksAttendance: true },
      }),
    )
    // Sólo los puestos activos se ofrecen para asignar.
    expect(m.positions).toHaveBeenCalledWith(expect.not.objectContaining({ includeArchived: true }), true)
  })

  it.each([
    ['falla', { data: undefined, isError: true, fetchStatus: 'idle', refetch: vi.fn() }, 'positions.loadError'],
    ['sin red', { data: undefined, isError: false, fetchStatus: 'paused', refetch: vi.fn() }, 'profile.positionsOffline'],
  ])('si la lista de puestos %s, lo dice (no un select vacío)', async (_n, estado, texto) => {
    m.positions.mockReturnValue(estado)
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(screen.getByRole('button', { name: 'profile.assign' }))
    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'positionId' })).toBeNull()
    expect(screen.getByRole('button', { name: 'positions.save' })).toBeDisabled()
  })

  it.each([
    ['falla', { data: undefined, isError: true, fetchStatus: 'idle', refetch: vi.fn() }, 'positions.loadError'],
    ['sin red', { data: undefined, isError: false, fetchStatus: 'paused', refetch: vi.fn() }, 'profile.positionsOffline'],
  ])('🔴 Cambiar: si la lista de puestos %s, lo dice (no ofrece sólo el puesto actual) y la relación se puede cambiar igual', async (_n, estado, texto) => {
    m.positions.mockReturnValue(estado)
    conPuestos([asignacion()])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(await screen.findByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' }))
    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'positionId' })).toBeNull()
    // Cambiar sólo la relación no necesita el catálogo: manda el puesto de siempre.
    fireEvent.change(campo('relation'), { target: { value: 'ASIMILADO' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(cambiar.mutateAsync).toHaveBeenCalledWith({ assignmentId: 'a1', body: { positionId: 'p1', relation: 'ASIMILADO', fecha: hoy } }),
    )
  })

  it('🔴 Cambiar: «Reintentar» vuelve a pedir los puestos', async () => {
    const refetch = vi.fn()
    m.positions.mockReturnValue({ data: undefined, isError: true, fetchStatus: 'idle', refetch })
    conPuestos([asignacion()])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(await screen.findByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' }))
    fireEvent.click(screen.getByRole('button', { name: 'positions.retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('🔴 dar de baja a una persona refresca [rh, sede] (chips «Coaches · 4» y el catálogo de Puestos), sólo de ESTA sede', async () => {
    m.quitarMiembro.mockResolvedValue({})
    const cliente = await montar()
    cliente.setQueryData(['rh', 'v1', 'positions', {}], pagina([puesto()]))
    cliente.setQueryData(['rh', 'v2', 'positions', {}], pagina([puesto()]))
    fireEvent.click(screen.getByRole('button', { name: 'actions.deactivate' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'dialogs.deactivateConfirm' }))
    await waitFor(() => expect(m.quitarMiembro).toHaveBeenCalledWith('v1', 'sv1'))
    await waitFor(() => expect(cliente.getQueryState(['rh', 'v1', 'positions', {}])?.isInvalidated).toBe(true))
    expect(cliente.getQueryState(['rh', 'v2', 'positions', {}])?.isInvalidated).toBe(false)
  })

  it('el 409/400 del servidor se muestra tal cual', async () => {
    asignar.mutateAsync.mockRejectedValue({ response: { status: 409, data: { message: 'Ya tiene ese puesto en esas fechas.' } } })
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(screen.getByRole('button', { name: 'profile.assign' }))
    fireEvent.change(campo('positionId'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tiene ese puesto en esas fechas.')
  })

  it('si el rol sugerido del puesto difiere del actual, ofrece cambiarlo y NO lo cambia solo; el botón abre la edición del miembro', async () => {
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(screen.getByRole('button', { name: 'profile.assign' }))
    fireEvent.change(campo('positionId'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    expect(await screen.findByText('profile.changeRoleOffer:{"current":"rol:CASHIER","suggested":"rol:WAITER"}')).toBeInTheDocument()
    expect(screen.queryByTestId('form-editar-miembro')).toBeNull()
    expect(asignar.mutateAsync).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'profile.changeRole' }))
    expect(await screen.findByTestId('form-editar-miembro')).toBeInTheDocument()
  })

  it('con el mismo rol que sugiere el puesto no hay oferta', async () => {
    m.getTeamMember.mockResolvedValue(miembro({ role: 'WAITER' }))
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(screen.getByRole('button', { name: 'profile.assign' }))
    fireEvent.change(campo('positionId'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() => expect(asignar.mutateAsync).toHaveBeenCalled())
    expect(screen.queryByText(/profile\.changeRoleOffer/)).toBeNull()
  })

  it.each([
    ['módulo de marca blanca', () => (m.marcaBlanca = true)],
    ['ruta /wl/', () => (m.modoMarcaBlanca = true)],
  ])('en marca blanca (%s) no aparecen ni «Asignar puesto» ni la relación, y no se pide nada de RH', async (_n, prender) => {
    prender()
    conPuestos([asignacion()])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.queryByRole('button', { name: 'profile.assign' })).toBeNull()
    expect(screen.queryByText('relation.none')).toBeNull()
    expect(screen.queryByText(/people\.relation/)).toBeNull()
    expect(m.historial).not.toHaveBeenCalled()
    expect(m.resumen).not.toHaveBeenCalled()
    expect(m.positions).not.toHaveBeenCalled()
  })

  it('muestra los vigentes del servidor con relación «Sin definir», checa y sede; Cambiar manda la relación elegida', async () => {
    conPuestos([asignacion(), asignacion({ id: 'a2', positionId: 'p2', positionName: 'Cajero', effectiveTo: hoy })])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    const tarjeta = (await screen.findByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' })).closest('li')!
    expect(within(tarjeta).getByText('relation.none')).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Centro/)).toBeInTheDocument()
    expect(within(tarjeta).getByText('positions.yes')).toBeInTheDocument()
    // La que termina hoy sigue vigente hoy: se ve «hasta …», pero ya no se cambia ni se termina.
    const cajero = screen.getByText('Cajero').closest('li')!
    expect(within(cajero).getByText(new RegExp(`profile\\.until:\\{"date":"${hoy}"\\}`))).toBeInTheDocument()
    expect(within(cajero).queryByRole('button')).toBeNull()
    expect(screen.getAllByRole('button', { name: /profile\.changeAria/ })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' }))
    expect(campo('positionId')).toHaveValue('p1')
    // Sin cambios no se puede guardar; la fecha no puede ir antes del inicio de esta versión.
    expect(screen.getByRole('button', { name: 'positions.save' })).toBeDisabled()
    expect(screen.getByLabelText('profile.date')).toHaveAttribute('min', '2026-09-01')
    fireEvent.change(campo('relation'), { target: { value: 'ASIMILADO' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(cambiar.mutateAsync).toHaveBeenCalledWith({
        assignmentId: 'a1',
        body: { positionId: 'p1', relation: 'ASIMILADO', fecha: hoy },
      }),
    )
  })

  it('el 409 de Cambiar («Esta asignación cambió…») se muestra tal cual', async () => {
    cambiar.mutateAsync.mockRejectedValue({
      response: { status: 409, data: { message: 'Esta asignación cambió mientras la editabas. Recarga e inténtalo de nuevo.' } },
    })
    conPuestos([asignacion()])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(await screen.findByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' }))
    fireEvent.change(campo('relation'), { target: { value: 'ASIMILADO' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta asignación cambió mientras la editabas. Recarga e inténtalo de nuevo.')
  })

  it('Terminar confirma con el último día (hoy de la sede por default) y manda la fecha', async () => {
    conPuestos([asignacion()])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(await screen.findByRole('button', { name: 'profile.endAria:{"name":"Mesero"}' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('profile.endConfirm:{"name":"Mesero"}')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('profile.date')).toHaveValue(hoy)
    expect(terminar.mutateAsync).not.toHaveBeenCalled()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'profile.end' }))
    await waitFor(() => expect(terminar.mutateAsync).toHaveBeenCalledWith({ assignmentId: 'a1', fecha: hoy }))
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'profile.ended' }))
  })

  it('el 400 de Terminar se muestra tal cual y el diálogo no se cierra', async () => {
    terminar.mutateAsync.mockRejectedValue({ response: { status: 400, data: { message: 'Esa asignación ya terminó.' } } })
    conPuestos([asignacion()])
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(await screen.findByRole('button', { name: 'profile.endAria:{"name":"Mesero"}' }))
    const dialogo = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'profile.end' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Esa asignación ya terminó.')
  })

  it('«Cómo se le paga hoy» dice cuando no hay permiso (no esconde el bloque)', async () => {
    m.resumen.mockReturnValue(consulta({ comisiones: null, nivelDeClase: 'SIN_PERMISO', propinas: { regla: 'ATIENDE_LUEGO_COBRA' } }))
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.getByText('profile.liveNoPermissionCommissions')).toBeInTheDocument()
    expect(screen.getByText('profile.liveNoPermissionClassLevel')).toBeInTheDocument()
    expect(screen.queryByText('profile.liveCommissions')).toBeNull()
    expect(screen.getByText('profile.liveTips')).toBeInTheDocument()
  })

  it('«Cómo se le paga hoy» con permiso lista comisiones (excluida / tasa personal) y el nivel de clase', async () => {
    m.resumen.mockReturnValue(
      consulta({
        comisiones: [
          { configId: 'c1', nombre: 'Ventas', alcance: 'SEDE', excluida: true, tasaPersonal: null },
          { configId: 'c2', nombre: 'Servicios', alcance: 'ORGANIZACION', excluida: false, tasaPersonal: 0.035 },
        ],
        nivelDeClase: { nombre: 'Coach A', desde: '2026-09-01' },
        propinas: { regla: 'ATIENDE_LUEGO_COBRA' },
      }),
    )
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.getByText(/profile\.liveExcluded/)).toBeInTheDocument()
    expect(screen.getByText(/profile\.liveCustomRate:\{"rate":3\.5\}/)).toBeInTheDocument()
    expect(screen.getByText(/Coach A/)).toBeInTheDocument()
    expect(screen.queryByText('profile.liveNoPermissionCommissions')).toBeNull()
  })

  it('el historial va de 20 en 20 con «Cargar más»', async () => {
    m.historial.mockImplementation((_s: string, p: number) =>
      consulta(
        p === 0
          ? pagina([asignacion({ positionName: 'Cajero' })], 21, true)
          : pagina([asignacion({ id: 'a9', positionName: 'Barista' })], 21, false),
      ),
    )
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.queryByText('Barista')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'positions.loadMore' }))
    expect(await screen.findByText('Barista')).toBeInTheDocument()
    expect(m.historial).toHaveBeenCalledWith('s1', 1)
  })
})
