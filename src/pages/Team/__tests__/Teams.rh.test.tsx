// RH fase 1a · Tarea 11: la lista de Personas (Teams) busca en el SERVIDOR (300 ms), filtra por puesto con chips y muestra
// Puesto / Checa / Relación de cada persona. Se finge sólo lo que está fuera de la pantalla (servicio, sesión, permisos y
// los formularios); la tabla, los filtros y el debounce son los de verdad. Los textos son los reales de es/*.json.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TeamMember } from '@/services/team.service'
import { StaffRole } from '@/types'
import type { Asignacion, Puesto } from '@/types/rh'
import Teams from '../Teams'

const m = vi.hoisted(() => ({
  getTeamMembers: vi.fn(),
  rol: 'OWNER' as string,
  puestos: [] as unknown[],
}))

// Textos reales de es/*.json (el espacio de nombres por omisión es `common`). Un traductor estable por espacio: Teams los usa en
// las dependencias de sus useMemo.
vi.mock('react-i18next', async () => {
  const [rh, team, common] = (await Promise.all([import('@/locales/es/rh.json'), import('@/locales/es/team.json'), import('@/locales/es/common.json')])).map(
    x => x.default as unknown,
  )
  const bundles: Record<string, unknown> = { rh, team, common }
  const buscar = (b: unknown, k: string) => k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown> | undefined)?.[p], b)
  const interpolar = (s: string, o?: Record<string, unknown>) => s.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o?.[n] ?? ''))
  const traductores = new Map<string, unknown>()
  const i18n = { language: 'es' }
  return {
    useTranslation: (ns = 'common') => {
      if (!traductores.has(ns)) {
        traductores.set(ns, {
          t: (k: string | string[], o?: Record<string, unknown>) => {
            const llave = Array.isArray(k) ? k[0] : k
            const v = buscar(bundles[ns], llave)
            return interpolar(typeof v === 'string' ? v : String(o?.defaultValue ?? llave), o)
          },
          i18n,
        })
      }
      return traductores.get(ns)
    },
  }
})
vi.mock('@/api', () => ({ default: { get: async () => ({ data: {} }) } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/demo' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ staffInfo: { role: m.rol }, activeVenue: { timezone: 'America/Mexico_City' } }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ getDisplayName: (r: string) => `rol:${r}`, getColor: () => undefined }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/useTeamInvitationTour', () => ({ useTeamInvitationTour: () => {} }))
vi.mock('@/services/features.service', () => ({ getVenueSeatStatus: async () => ({ allowed: true }) }))
vi.mock('@/hooks/useRh', () => ({ usePositions: () => ({ data: { data: m.puestos, total: m.puestos.length, hasMore: false } }) }))
vi.mock('@/services/team.service', () => ({
  default: {
    getTeamMembers: (...a: unknown[]) => m.getTeamMembers(...a),
    getPendingInvitations: async () => ({ data: [] }),
  },
}))
vi.mock('../AsistenciaSettings', () => ({ default: () => null }))
vi.mock('../components/EditTeamMemberForm', () => ({ default: () => null }))
vi.mock('../components/InviteTeamMemberForm', async () => {
  const { forwardRef } = await import('react')
  return { default: forwardRef(() => null) }
})

const puesto = (o: Partial<Puesto>): Puesto => ({
  id: 'p-coach',
  name: 'Coaches',
  color: '#3b82f6',
  icon: null,
  suggestedRole: 'WAITER',
  suggestedRelation: null,
  tracksAttendanceDefault: true,
  componentKinds: [],
  archivedAt: null,
  personasVigentes: 4,
  ...o,
})
const asignacion = (o: Partial<Asignacion>): Asignacion => ({
  id: 'a1',
  staffId: 's1',
  positionId: 'p-coach',
  positionName: 'Coach',
  relation: null,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  tracksAttendance: true,
  supersedesId: null,
  ...o,
})
const miembro = (o: Partial<TeamMember>): TeamMember => ({
  id: 'm1',
  staffId: 's1',
  firstName: 'Ana',
  lastName: 'López',
  email: 'ana@example.com',
  role: StaffRole.WAITER,
  active: true,
  startDate: '2026-01-01',
  endDate: null,
  pin: null,
  totalSales: 0,
  totalTips: 0,
  totalOrders: 0,
  averageRating: 0,
  permissionSetId: null,
  permissionSetName: null,
  currentAssignments: [],
  ...o,
})
const pagina = (data: TeamMember[], totalCount: number, currentPage = 1) => ({
  data,
  meta: { totalCount, pageSize: 20, currentPage, totalPages: Math.ceil(totalCount / 20), hasNextPage: false, hasPrevPage: false },
})

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } } })
  const vista = render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Teams />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { cliente, ...vista }
}
const filas = () => screen.getAllByRole('row').slice(1)
const fila = (nombre: string) => filas().find(f => within(f).queryByText(nombre)) as HTMLElement
const columna = (h: string) => screen.getAllByRole('columnheader').findIndex(c => c.textContent?.includes(h))
const celda = (nombre: string, h: string) => within(fila(nombre)).getAllByRole('cell')[columna(h)]
const llamadas = () => m.getTeamMembers.mock.calls as unknown[][]
// La lista (20 por página); aparte va la petición de una fila que sólo sirve para el total de «Todos».
const ultimaLista = () => {
  const listas = llamadas().filter(c => c[2] === 20)
  return listas[listas.length - 1]
}

beforeEach(() => {
  m.rol = 'OWNER'
  m.puestos = [puesto({}), puesto({ id: 'p-mesero', name: 'Meseros', color: null, personasVigentes: 6 })]
  // La lista de verdad depende de los filtros; el total SIN filtros (pageSize 1) son 14 personas.
  m.getTeamMembers.mockImplementation(async (_v: string, page: number, size: number, search?: string, positionId?: string) => {
    if (positionId) return pagina([miembro({ id: 'm9', staffId: 's9', firstName: 'Coach', lastName: 'Solo' })], 4, page)
    if (search) return pagina([miembro({ id: 'm8', staffId: 's8', firstName: 'Anabel', lastName: 'Ruiz' })], 1, page)
    if (size === 1) return pagina([], 14)
    return pagina(
      [
        miembro({
          currentAssignments: [
            asignacion({ id: 'a1', positionName: 'Coach', relation: null, tracksAttendance: true }),
            asignacion({ id: 'a2', positionId: 'p-mesero', positionName: 'Mesero', relation: 'EMPLEADO_NOMINA', tracksAttendance: false }),
          ],
        }),
        miembro({
          id: 'm2',
          staffId: 's2',
          firstName: 'Beto',
          lastName: 'Gil',
          email: 'beto@example.com',
          currentAssignments: [asignacion({ id: 'a3', staffId: 's2', positionName: 'Barista', relation: null, tracksAttendance: false })],
        }),
        miembro({ id: 'm3', staffId: 's3', firstName: 'Cleo', lastName: 'Paz', email: 'cleo@example.com', currentAssignments: [] }),
        miembro({ id: 'm4', staffId: 's4', firstName: 'Sistema', lastName: 'Interno', email: 'sys@example.com', role: StaffRole.SUPERADMIN }),
      ],
      14,
      page,
    )
  })
})

describe('Personas: búsqueda en el servidor', () => {
  it('🔴 teclear no busca en el cliente: a los 300 ms llama al servidor con el texto, y el <Input> conserva el foco', async () => {
    montar()
    await screen.findByText('Ana López')
    expect(llamadas()[0]).toEqual(['v1', 1, 20, undefined, undefined])

    fireEvent.click(screen.getByRole('button', { name: 'Buscar...' }))
    const entrada = screen.getByPlaceholderText('Buscar por nombre o correo')
    expect(entrada).toHaveFocus()
    fireEvent.change(entrada, { target: { value: 'ana' } })
    // antes de los 300 ms no se pide nada
    expect(llamadas().some(c => c[3] === 'ana')).toBe(false)
    await waitFor(() => expect(ultimaLista()).toEqual(['v1', 1, 20, 'ana', undefined]))
    // 🔴 el buscador del servidor no desmonta el <Input> (en Android cerraría el teclado): sigue enfocado y con su texto
    await screen.findByText('Anabel Ruiz')
    expect(screen.getByPlaceholderText('Buscar por nombre o correo')).toBe(entrada)
    expect(entrada).toHaveFocus()
    expect(entrada).toHaveValue('ana')
    // el filtrado de la página en el cliente ya no existe: «Ana López» no está porque el servidor no la devolvió, no porque se escondiera
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
  })

  it('al buscar estando en la página 2 NO pide la página 2 de la búsqueda nueva: vuelve a la 1 antes de pedir', async () => {
    m.getTeamMembers.mockImplementation(async (_v: string, page: number, size: number, search?: string) => {
      if (size === 1) return pagina([], 45)
      if (search) return pagina([miembro({ id: 'm8', staffId: 's8', firstName: 'Anabel', lastName: 'Ruiz' })], 1, page)
      return pagina([miembro({ firstName: `Pág${page}` })], 45, page)
    })
    montar()
    await screen.findByText('Pág1 López')
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la página siguiente' }))
    await screen.findByText('Pág2 López')

    fireEvent.click(screen.getByRole('button', { name: 'Buscar...' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o correo'), { target: { value: 'ana' } })
    await screen.findByText('Anabel Ruiz')
    const conBusqueda = llamadas().filter(c => c[3] === 'ana')
    expect(conBusqueda.map(c => c[1])).toEqual([1])
  })
})

describe('Personas: filtro por puesto', () => {
  it('muestra «Todos · N» con el total SIN filtros y un chip por puesto con sus personas vigentes', async () => {
    montar()
    await screen.findByText('Ana López')
    const todos = await screen.findByRole('button', { name: 'Todos · 14' })
    expect(todos).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Coaches · 4' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Meseros · 6' })).toBeInTheDocument()
  })

  it('elegir «Coaches · 4» pide la lista con positionId; el total «Todos» no cambia; «Todos» quita el filtro', async () => {
    montar()
    await screen.findByText('Ana López')
    fireEvent.click(await screen.findByRole('button', { name: 'Coaches · 4' }))
    await screen.findByText('Coach Solo')
    expect(ultimaLista()).toEqual(['v1', 1, 20, undefined, 'p-coach'])
    expect(screen.getByRole('button', { name: 'Coaches · 4' })).toHaveAttribute('aria-pressed', 'true')
    // el servidor contesta 4 con el filtro puesto; «Todos» sigue siendo toda la gente
    expect(screen.getByRole('button', { name: 'Todos · 14' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Todos · 14' }))
    // la lista sin filtro ya estaba en caché (30 s): vuelve sin pedir otra vez, pero sin el positionId
    await screen.findByText('Ana López')
    expect(screen.getByRole('button', { name: 'Todos · 14' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Coach Solo')).not.toBeInTheDocument()
  })

  it('un negocio sin puestos no pinta la fila de chips', async () => {
    m.puestos = []
    montar()
    await screen.findByText('Ana López')
    expect(screen.queryByRole('button', { name: /Todos ·/ })).not.toBeInTheDocument()
    // y no gasta la petición extra que sólo sirve para el número de «Todos»
    expect(llamadas().some(c => c[2] === 1)).toBe(false)
  })
})

describe('Personas: columnas Puesto, Checa y Relación', () => {
  it('Puesto muestra un chip por asignación vigente; «Sin puesto» si no tiene', async () => {
    montar()
    await screen.findByText('Ana López')
    const ana = within(fila('Ana López'))
    expect(ana.getByText('Coach')).toBeInTheDocument()
    expect(ana.getByText('Mesero')).toBeInTheDocument()
    expect(within(fila('Beto Gil')).getByText('Barista')).toBeInTheDocument()
    expect(within(fila('Cleo Paz')).getByText('Sin puesto')).toBeInTheDocument()
  })

  it('Relación null dice «Sin definir» en gris, nunca «por fuera»; con valor, el nombre de la relación', async () => {
    montar()
    await screen.findByText('Ana López')
    const beto = within(fila('Beto Gil')).getByText('Sin definir')
    expect(beto).toHaveClass('text-muted-foreground')
    expect(within(fila('Ana López')).getByText('Empleado de nómina')).toBeInTheDocument()
    expect(screen.queryByText(/por fuera|informal|sin comprobante/i)).not.toBeInTheDocument()
  })

  it('Checa dice Sí/No según la asignación vigente (Sí si alguna checa) y «—» si no tiene puesto', async () => {
    montar()
    await screen.findByText('Ana López')
    expect(celda('Ana López', 'Checa')).toHaveTextContent('Sí')
    expect(celda('Beto Gil', 'Checa')).toHaveTextContent('No')
    expect(celda('Cleo Paz', 'Checa')).toHaveTextContent('—')
  })

  it('las columnas de antes se conservan', async () => {
    montar()
    await screen.findByText('Ana López')
    for (const h of ['Nombre', 'Rol', 'Estado', 'Ventas Totales', 'Propinas Totales', 'Órdenes Totales', 'Puesto', 'Checa', 'Relación'])
      expect(screen.getByRole('columnheader', { name: new RegExp(h) })).toBeInTheDocument()
  })
})

describe('Personas: lo que no cambia', () => {
  it('el total del servidor se ve (pestaña «Miembros 14») y sigue ocultando al superadmin a quien no lo es', async () => {
    montar()
    await screen.findByText('Ana López')
    expect(screen.getByRole('button', { name: /Miembros\s*14/ })).toBeInTheDocument()
    expect(screen.queryByText('Sistema Interno')).not.toBeInTheDocument()
  })

  it('un superadmin sí ve a los superadmins', async () => {
    m.rol = 'SUPERADMIN'
    montar()
    expect(await screen.findByText('Sistema Interno')).toBeInTheDocument()
  })

  it('🔴 la llave de la lista cuelga de [team-members, sede]: invalidar ese prefijo (como hacen las mutaciones de RH) la vuelve a pedir', async () => {
    const { cliente } = montar()
    await screen.findByText('Ana López')
    const antes = m.getTeamMembers.mock.calls.length
    await act(() => cliente.invalidateQueries({ queryKey: ['team-members', 'v1'] }))
    await waitFor(() => expect(m.getTeamMembers.mock.calls.length).toBeGreaterThan(antes))
    expect(cliente.getQueryCache().find({ queryKey: ['team-members', 'v1', 0, 20, '', ''] })).toBeDefined()
  })

  it('un fallo de red no se ve como «no hay gente»: aparece el aviso con «Reintentar ahora»', async () => {
    m.getTeamMembers.mockRejectedValue(new Error('network'))
    montar()
    expect(await screen.findByText(/problemas para conectar con el servidor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar ahora' })).toBeInTheDocument()
  })
})
