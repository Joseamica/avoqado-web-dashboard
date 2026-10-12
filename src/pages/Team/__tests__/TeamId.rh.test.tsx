// RH fase 1a · Tarea 12: la ficha de una persona en pestañas. Las secciones que ya existían (horario, nivel de pago,
// expediente, comisiones) se fingen con un marcador: aquí se prueba DÓNDE aparecen y con qué candado, y lo nuevo de
// «Puesto y pago» (asignar con relación, la oferta de rol que nunca se ejecuta sola y la marca blanca).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  history: vi.fn(),
  historial: vi.fn(),
  resumen: vi.fn(),
  positions: vi.fn(),
  asignarHook: vi.fn(),
  cambiarHook: vi.fn(),
  terminarHook: vi.fn(),
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
    venueTimezone: 'America/Mexico_City',
  }),
}))
vi.mock('@/services/team.service', () => ({
  default: { getTeamMember: (...a: unknown[]) => m.getTeamMember(...a), getDeactivationImpact: () => Promise.resolve({}) },
}))
vi.mock('@/services/rh.service', () => ({ rhService: { history: (...a: unknown[]) => m.history(...a) } }))
vi.mock('@/hooks/useRh', () => ({
  rhKeys: { all: (v?: string | null) => ['rh', v] },
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
  m.history.mockResolvedValue(pagina<Asignacion>([]))
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

async function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
}
const pestanas = () =>
  within(screen.getByRole('navigation'))
    .getAllByRole('button')
    .map(b => b.textContent)
const abrirPestana = (clave: string) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: clave }))
const campo = (nombre: string) => screen.getByRole('combobox', { name: nombre }) as HTMLSelectElement
const hoy = hoyEnSede('America/Mexico_City')

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

  it('asignar con la relación sin tocar manda relation: null, con la fecha de hoy de la sede y sin fechas futuras', async () => {
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    fireEvent.click(screen.getByRole('button', { name: 'profile.assign' }))
    const fecha = screen.getByLabelText('profile.date')
    expect(fecha).toHaveValue(hoy)
    expect(fecha).toHaveAttribute('max', hoy)
    expect(within(campo('relation')).getAllByRole('option')[1]).toHaveValue('none')
    fireEvent.change(campo('positionId'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(asignar.mutateAsync).toHaveBeenCalledWith({
        staffId: 's1',
        body: { positionId: 'p1', relation: null, fecha: hoy, tracksAttendance: true },
      }),
    )
    // Sólo los puestos activos se ofrecen para asignar.
    expect(m.positions).toHaveBeenCalledWith(expect.not.objectContaining({ includeArchived: true }), true)
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
    m.history.mockResolvedValue(pagina([asignacion()]))
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    expect(screen.queryByRole('button', { name: 'profile.assign' })).toBeNull()
    expect(screen.queryByText('relation.none')).toBeNull()
    expect(screen.queryByText(/people\.relation/)).toBeNull()
    expect(m.history).not.toHaveBeenCalled()
    expect(m.resumen).not.toHaveBeenCalled()
  })

  it('muestra los puestos vigentes con relación «Sin definir», checa y sede; Cambiar manda la relación elegida', async () => {
    m.history.mockResolvedValue(pagina([asignacion(), asignacion({ id: 'a0', effectiveTo: '2026-08-31' })]))
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    const tarjeta = (await screen.findByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' })).closest('li')!
    expect(within(tarjeta).getByText('relation.none')).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Centro/)).toBeInTheDocument()
    expect(within(tarjeta).getByText('positions.yes')).toBeInTheDocument()
    // La terminada no es vigente: no tiene botones.
    expect(screen.getAllByRole('button', { name: /profile\.changeAria/ })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' }))
    expect(campo('positionId')).toHaveValue('p1')
    fireEvent.change(campo('relation'), { target: { value: 'ASIMILADO' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(cambiar.mutateAsync).toHaveBeenCalledWith({
        assignmentId: 'a1',
        body: { positionId: 'p1', relation: 'ASIMILADO', fecha: hoy },
      }),
    )
  })

  it('un puesto vigente viejo detrás de muchas versiones nuevas de otro puesto sí aparece (no se toma sólo la primera página)', async () => {
    m.history.mockImplementation((_v: string, _s: string, p: number) =>
      Promise.resolve(
        p === 0
          ? pagina([asignacion({ id: 'c1', positionName: 'Cajero', effectiveTo: '2026-10-01' })], 101, true)
          : pagina([asignacion({ id: 'm1', positionName: 'Mesero', effectiveFrom: '2024-01-01' })], 101, false),
      ),
    )
    await montar()
    abrirPestana('profile.tabs.positionAndPay')
    expect(await screen.findByRole('button', { name: 'profile.changeAria:{"name":"Mesero"}' })).toBeInTheDocument()
    expect(m.history).toHaveBeenCalledWith('v1', 's1', 1, 100)
    expect(screen.queryByRole('button', { name: 'profile.changeAria:{"name":"Cajero"}' })).toBeNull()
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
