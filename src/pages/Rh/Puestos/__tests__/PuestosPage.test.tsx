// RH fase 1a · Tarea 10: la página de Puestos. Los datos y las mutaciones se fingen (`useRh` tiene su propia prueba); aquí se
// prueba lo que el dueño ve y toca: lista vacía, chips sugeridos que NO crean nada, guardar, archivar con confirmación,
// permiso `teams:update`, paginación y el aviso del independiente.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Puesto } from '@/types/rh'
import PuestosPage from '../PuestosPage'

type Mutacion = { mutate: ReturnType<typeof vi.fn>; mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean; isPaused: boolean; cancelarEnPausa: ReturnType<typeof vi.fn> }
const m = vi.hoisted(() => ({
  can: vi.fn(),
  toast: vi.fn(),
  positions: vi.fn(),
  sugeridos: vi.fn(),
  crearHook: vi.fn(),
  actualizarHook: vi.fn(),
  archivarHook: vi.fn(),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ getDisplayName: (r: string) => `rol:${r}` }) }))
vi.mock('@/hooks/useRh', () => ({
  usePositions: (o: unknown) => m.positions(o),
  usePositionSuggestions: (enabled?: boolean) => m.sugeridos(enabled),
  useCreatePosition: () => m.crearHook(),
  useUpdatePosition: () => m.actualizarHook(),
  useArchivePosition: () => m.archivarHook(),
}))
// El diálogo es de pantalla completa (Radix): aquí se pinta plano y con un botón que hace de la «X».
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions, onClose }: { open: boolean; children: ReactNode; actions?: ReactNode; onClose: () => void }) =>
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
// Los selects de Radix no se dejan manejar en jsdom: cada uno es un <select aria-label=name> nativo.
vi.mock('@/components/ui/select', () => import('@/test/nativeSelectShim'))

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
  personasVigentes: 3,
  ...o,
})
const pagina = (data: Puesto[], total = data.length, hasMore = false) => ({ data: { data, total, hasMore }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
const mutacion = (): Mutacion => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, isPaused: false, cancelarEnPausa: vi.fn() })

let crear: Mutacion
let actualizar: Mutacion
let archivar: Mutacion

beforeEach(() => {
  m.can.mockImplementation(() => true)
  m.positions.mockReturnValue(pagina([puesto()]))
  m.sugeridos.mockReturnValue({ data: { data: [{ name: 'Recepcionista', suggestedRole: 'CASHIER' }] } })
  crear = mutacion()
  actualizar = mutacion()
  archivar = mutacion()
  m.crearHook.mockReturnValue(crear)
  m.actualizarHook.mockReturnValue(actualizar)
  m.archivarHook.mockReturnValue(archivar)
})

const abrirCrear = () => fireEvent.click(screen.getByRole('button', { name: 'positions.create' }))
const campo = (nombre: string) => screen.getByRole('combobox', { name: nombre }) as HTMLSelectElement

describe('PuestosPage', () => {
  it('sin puestos muestra el texto de vacío y no una tabla', () => {
    m.positions.mockReturnValue(pagina([]))
    render(<PuestosPage />)
    expect(screen.getByText('positions.empty')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('un chip sugerido abre el diálogo con el nombre y el rol puestos, y NO crea nada todavía', () => {
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('button', { name: 'positions.add:{"name":"Recepcionista"}' }))
    expect(screen.getByLabelText('positions.name')).toHaveValue('Recepcionista')
    expect(campo('suggestedRole')).toHaveValue('CASHIER')
    expect(crear.mutateAsync).not.toHaveBeenCalled()
  })

  it('guardar con la relación en «Sin definir» manda suggestedRelation null', async () => {
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('button', { name: 'positions.add:{"name":"Recepcionista"}' }))
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(crear.mutateAsync).toHaveBeenCalledWith({ name: 'Recepcionista', suggestedRole: 'CASHIER', suggestedRelation: null, tracksAttendanceDefault: true }),
    )
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'positions.created' }))
  })

  it('elegir una relación la manda tal cual; sin nombre o sin rol no se puede guardar', async () => {
    render(<PuestosPage />)
    abrirCrear()
    expect(screen.getByRole('button', { name: 'positions.save' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('positions.name'), { target: { value: '  Barbero  ' } })
    expect(screen.getByRole('button', { name: 'positions.save' })).toBeDisabled() // falta el rol
    fireEvent.change(campo('suggestedRole'), { target: { value: 'WAITER' } })
    fireEvent.change(campo('suggestedRelation'), { target: { value: 'RENTA_SILLA' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'positions.tracksAttendance' })) // se desmarca
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(crear.mutateAsync).toHaveBeenCalledWith({ name: 'Barbero', suggestedRole: 'WAITER', suggestedRelation: 'RENTA_SILLA', tracksAttendanceDefault: false }),
    )
  })

  it('el rol sólo ofrece los sugeribles: nunca SUPERADMIN', () => {
    render(<PuestosPage />)
    abrirCrear()
    const opciones = within(campo('suggestedRole')).getAllByRole('option').map(o => (o as HTMLOptionElement).value)
    expect(opciones).toContain('OWNER')
    expect(opciones).not.toContain('SUPERADMIN')
  })

  it('Independiente con «Checa entrada y salida» avisa (sin bloquear); desmarcar la casilla quita el aviso', async () => {
    render(<PuestosPage />)
    abrirCrear()
    fireEvent.change(screen.getByLabelText('positions.name'), { target: { value: 'Coach' } })
    fireEvent.change(campo('suggestedRole'), { target: { value: 'WAITER' } })
    fireEvent.change(campo('suggestedRelation'), { target: { value: 'INDEPENDIENTE_FACTURA' } })
    expect(screen.getByText('relation.independentAttendanceWarning')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'positions.save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'positions.tracksAttendance' }))
    expect(screen.queryByText('relation.independentAttendanceWarning')).toBeNull()
  })

  it('un 409 del servidor se muestra tal cual y el diálogo sigue abierto', async () => {
    crear.mutateAsync.mockRejectedValue({ response: { data: { message: 'Ya existe un puesto llamado «Mesero» en esta sucursal.' } } })
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('button', { name: 'positions.add:{"name":"Recepcionista"}' }))
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    expect(await screen.findByText('Ya existe un puesto llamado «Mesero» en esta sucursal.')).toBeInTheDocument()
    expect(screen.getByLabelText('positions.name')).toBeInTheDocument()
  })

  it('editar abre el diálogo con los valores del puesto y guarda con updatePosition', async () => {
    m.positions.mockReturnValue(pagina([puesto({ suggestedRelation: 'ASIMILADO', tracksAttendanceDefault: false })]))
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('button', { name: /positions\.editAria/ }))
    expect(screen.getByLabelText('positions.name')).toHaveValue('Mesero')
    expect(campo('suggestedRelation')).toHaveValue('ASIMILADO')
    expect(screen.getByRole('checkbox', { name: 'positions.tracksAttendance' })).not.toBeChecked()
    fireEvent.change(screen.getByLabelText('positions.name'), { target: { value: 'Mesera' } })
    fireEvent.click(screen.getByRole('button', { name: 'positions.save' }))
    await waitFor(() =>
      expect(actualizar.mutateAsync).toHaveBeenCalledWith({
        id: 'p1',
        body: { name: 'Mesera', suggestedRole: 'WAITER', suggestedRelation: 'ASIMILADO', tracksAttendanceDefault: false },
      }),
    )
    expect(crear.mutateAsync).not.toHaveBeenCalled()
  })

  it('archivar pide confirmación con el texto de archiveConfirm y sólo entonces archiva', async () => {
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('button', { name: /positions\.archiveAria/ }))
    const confirmacion = await screen.findByRole('alertdialog')
    expect(within(confirmacion).getByText('positions.archiveConfirm:{"name":"Mesero"}')).toBeInTheDocument()
    expect(archivar.mutate).not.toHaveBeenCalled()
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'positions.archive' }))
    expect(archivar.mutate).toHaveBeenCalledWith('p1', expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }))
  })

  it('sin teams:update no hay «Crear puesto», ni «Archivar», ni «Editar», ni chips (y los sugeridos ni se piden)', () => {
    m.can.mockImplementation((p: string) => p !== 'teams:update')
    render(<PuestosPage />)
    expect(screen.getByText('Mesero')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'positions.create' })).toBeNull()
    expect(screen.queryByRole('button', { name: /positions\.archiveAria/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /positions\.editAria/ })).toBeNull()
    expect(screen.queryByText('positions.suggestionsTitle')).toBeNull()
    expect(m.sugeridos).toHaveBeenCalledWith(false)
  })

  it('la fila dice la relación sugerida («Sin definir» si no hay), si checa y cuántas personas', () => {
    m.positions.mockReturnValue(
      pagina([puesto({ id: 'a', name: 'Mesero' }), puesto({ id: 'b', name: 'Coach', suggestedRelation: 'RENTA_SILLA', tracksAttendanceDefault: false, personasVigentes: 7 })]),
    )
    render(<PuestosPage />)
    const mesero = screen.getByText('Mesero').closest('tr')!
    expect(within(mesero).getByText('relation.none')).toBeInTheDocument()
    expect(within(mesero).getByText('rol:WAITER')).toBeInTheDocument()
    expect(within(mesero).getByText('positions.yes')).toBeInTheDocument()
    expect(within(mesero).getByText('3')).toBeInTheDocument()
    const coach = screen.getByText('Coach').closest('tr')!
    expect(within(coach).getByText('relation.RENTA_SILLA')).toBeInTheDocument()
    expect(within(coach).getByText('positions.no')).toBeInTheDocument()
  })

  it('«Cargar más» pide la página siguiente con offset, el total siempre se ve y el botón se va al terminar', () => {
    m.positions.mockImplementation(({ offset }: { offset: number }) =>
      offset === 0 ? pagina([puesto({ id: 'a', name: 'Mesero' })], 51, true) : pagina([puesto({ id: 'b', name: 'Cajero' })], 51, false),
    )
    render(<PuestosPage />)
    expect(screen.getByText('positions.shown:{"shown":1,"total":51}')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'positions.loadMore' }))
    expect(m.positions).toHaveBeenCalledWith(expect.objectContaining({ offset: 50, limit: 50, includeArchived: false }))
    expect(screen.getByText('Mesero')).toBeInTheDocument()
    expect(screen.getByText('Cajero')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'positions.loadMore' })).toBeNull()
    expect(screen.getByText('positions.shown:{"shown":51,"total":51}')).toBeInTheDocument()
  })

  it('«Ver archivados» pide includeArchived, vuelve a la primera página y marca los archivados sin acciones', () => {
    m.positions.mockImplementation(({ includeArchived }: { includeArchived: boolean }) =>
      pagina(includeArchived ? [puesto({ id: 'x', name: 'Viejo', archivedAt: '2026-10-01T00:00:00Z' })] : [puesto()]),
    )
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'positions.showArchived' }))
    expect(m.positions).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true, offset: 0 }))
    const fila = screen.getByText('Viejo').closest('tr')!
    expect(within(fila).getByText('positions.archived')).toBeInTheDocument()
    expect(within(fila).queryByRole('button')).toBeNull()
  })

  it('cambiar «Ver archivados» tras «Cargar más» vuelve a la primera página (no pide offset 50 del filtro nuevo)', () => {
    m.positions.mockImplementation(({ offset }: { offset: number }) =>
      offset === 0 ? pagina([puesto({ id: 'a', name: 'Mesero' })], 51, true) : pagina([puesto({ id: 'b', name: 'Cajero' })], 51, false),
    )
    render(<PuestosPage />)
    fireEvent.click(screen.getByRole('button', { name: 'positions.loadMore' }))
    m.positions.mockClear()
    fireEvent.click(screen.getByRole('switch', { name: 'positions.showArchived' }))
    expect(m.positions).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true, offset: 0 }))
    expect(m.positions).not.toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true, offset: 50 }))
    expect(screen.queryByText('Cajero')).toBeNull()
  })

  it('distingue cargando, error y vacío: un fallo de red NO se ve como «no hay puestos»', () => {
    const refetch = vi.fn()
    m.positions.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: true, refetch })
    const { unmount } = render(<PuestosPage />)
    expect(screen.queryByText('positions.empty')).toBeNull()
    unmount()
    m.positions.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch })
    render(<PuestosPage />)
    expect(screen.getByText('positions.loadError')).toBeInTheDocument()
    expect(screen.queryByText('positions.empty')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'positions.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('sin red el guardado queda en pausa: se avisa, y cerrar la ventana lo saca de la cola', () => {
    crear.isPaused = true
    render(<PuestosPage />)
    abrirCrear()
    expect(screen.getByText('positions.offlineSave')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-modal' }))
    expect(crear.cancelarEnPausa).toHaveBeenCalled()
  })
})
