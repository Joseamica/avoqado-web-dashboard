import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TablaDePagosTab } from '../components/TablaDePagosTab'

const APAGADAS = { coverBonusHours: null, coverBonusAmount: null, lateCancelHours: null }
const m = vi.hoisted(() => ({
  publish: vi.fn(),
  assign: vi.fn(),
  assignMutate: vi.fn(),
  update: vi.fn(),
  reglas: { coverBonusHours: null, coverBonusAmount: null, lateCancelHours: null } as Record<string, number | null>,
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual<any>('@tanstack/react-query')),
  useQuery: () => ({ data: { data: [{ staffId: 's1', firstName: 'Ana', lastName: 'López', active: true }] } }),
}))
// Select nativo: el Select de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
const PN_HC = [0, 430, 430, 430, 430, 460, 490, 530, 570, 610, 650]
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayLevels: () => ({ data: [{ id: 'hc', name: 'Head Coach', sortOrder: 0, archivedAt: null }] }),
  useStaffPayAssignments: () => ({ data: [] }),
  useStaffPayTables: () => ({ data: [{ id: 't1', name: 'Todas', productIds: [], archivedFrom: null, vigente: { id: 'v', effectiveFrom: '2026-10-01', revision: 1, countMode: 'BOOKED', maxCount: 10, cells: PN_HC.map((amount, count) => ({ payLevelId: 'hc', count, amount })), reglas: m.reglas } }] }),
  useCreateLevel: () => ({ mutate: vi.fn() }),
  useUpdateLevel: () => ({ mutate: m.update, isPending: false }),
  useAssignLevel: () => ({ mutate: m.assignMutate, mutateAsync: m.assign, isPending: false }),
  useCreateTable: () => ({ mutate: vi.fn() }),
  usePublishTable: () => ({ mutateAsync: m.publish }),
  // El mínimo de la vigencia sale de la lista de periodos en caché; aquí no hay.
  useStaffPayPeriods: () => ({ data: undefined }),
}))

const celda = (count: number) => screen.getByLabelText(`grid.cellLabel:${JSON.stringify({ level: 'Head Coach', count })}`) as HTMLInputElement

describe('TablaDePagosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.reglas = { ...APAGADAS }
    m.publish.mockResolvedValue({ clasesQueCambian: 14 })
    m.assign.mockResolvedValue({ clasesQueCambian: 3 })
  })
  it('el simulador dice 8 lugares Head Coach = $570', () => {
    render(<TablaDePagosTab />)
    fireEvent.change(screen.getByLabelText('grid.simulatorSeats'), { target: { value: '8' } })
    expect(screen.getByTestId('simulator-result')).toHaveTextContent('570')
  })
  it('«Sólo quien llegó» se ve deshabilitado con su explicación', () => {
    render(<TablaDePagosTab />)
    expect(screen.getByLabelText('grid.attended')).toBeDisabled()
    expect(screen.getByText('grid.attendedHelp')).toBeInTheDocument()
  })
  it('editar el techo 10 → 1 → 12 no borra montos, y lo guardado no trae filas por encima del techo', async () => {
    render(<TablaDePagosTab />)
    const techo = screen.getByLabelText('grid.ceiling')
    fireEvent.change(techo, { target: { value: '1' } })
    fireEvent.change(techo, { target: { value: '12' } })
    expect(celda(8).value).toBe('570')
    expect(celda(10).value).toBe('650')
    fireEvent.change(techo, { target: { value: '5' } })
    fireEvent.click(screen.getByText('grid.publish'))
    await waitFor(() => expect(m.publish).toHaveBeenCalled())
    const payload = m.publish.mock.calls[0][0]
    expect(payload.maxCount).toBe(5)
    expect(payload.cells.length).toBe(6)
    expect(payload.cells.every((c: any) => c.count <= 5)).toBe(true)
  })
  it('elegir el nivel de una persona sólo SIMULA; se escribe hasta confirmar', async () => {
    render(<TablaDePagosTab />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'hc' } })
    // Server previo (sólo el total): se dice el total, sin «de este periodo» ni «las anteriores se quedan».
    await screen.findByText(`vigencia.effectTotal:${JSON.stringify({ count: 3 })}`)
    expect(m.assign).toHaveBeenCalledTimes(1)
    expect(m.assign.mock.calls[0][0]).toMatchObject({ staffId: 's1', payLevelId: 'hc', simular: true })
    expect(m.assignMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('assign.confirm'))
    await waitFor(() => expect(m.assign).toHaveBeenCalledTimes(2))
    expect(m.assign.mock.calls[1][0]).toMatchObject({ staffId: 's1', payLevelId: 'hc' })
    expect(m.assign.mock.calls[1][0].simular).toBeFalsy()
  })
  it('renombrar un nivel manda el nombre sin espacios sobrantes', () => {
    render(<TablaDePagosTab />)
    fireEvent.click(screen.getByLabelText(`levels.rename:${JSON.stringify({ name: 'Head Coach' })}`))
    fireEvent.change(screen.getByLabelText('levels.newName'), { target: { value: '  Head Coach Sr  ' } })
    fireEvent.click(screen.getByLabelText('levels.save'))
    expect(m.update).toHaveBeenCalledWith({ levelId: 'hc', name: 'Head Coach Sr' }, expect.anything())
  })

  it('🔴 una tabla que ya tiene reglas las conserva: cambiar sólo una celda y publicar las manda iguales (forma real de D4)', async () => {
    m.reglas = { coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: 2 }
    render(<TablaDePagosTab />)
    expect(screen.getByRole('switch', { name: 'rules.cover' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'rules.lateCancel' })).toBeChecked()
    expect(screen.getByLabelText('rules.coverHours')).toHaveValue(3)
    fireEvent.change(celda(8), { target: { value: '580' } })
    fireEvent.click(screen.getByText('grid.publish'))
    await waitFor(() => expect(m.publish).toHaveBeenCalled())
    // La simulación y el guardado llevan las reglas de la versión vigente, nunca null.
    for (const [payload] of m.publish.mock.calls) expect(payload).toMatchObject({ coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: 2 })
  })

  it('las reglas de clase viajan en la versión que se publica (también al simular); apagadas, como null', async () => {
    render(<TablaDePagosTab />)
    expect(screen.getByRole('switch', { name: 'rules.cover' })).not.toBeChecked()
    expect(screen.queryByLabelText('rules.coverHours')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'rules.cover' }))
    fireEvent.change(screen.getByLabelText('rules.coverHours'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('rules.coverAmount'), { target: { value: '100' } })
    fireEvent.click(screen.getByText('grid.publish'))
    await waitFor(() => expect(m.publish).toHaveBeenCalled())
    expect(m.publish.mock.calls[0][0]).toMatchObject({ coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: null })
    // Guardar (no sólo simular) también las lleva.
    fireEvent.click(screen.getByText('publish.confirm'))
    await waitFor(() => expect(m.publish.mock.calls.some(([p]) => !p.simular)).toBe(true))
    for (const [payload] of m.publish.mock.calls) expect(payload).toMatchObject({ coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: null })
  })

  it('apagar una regla que la tabla tenía la manda en null (no se hereda)', async () => {
    m.reglas = { coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: 2 }
    render(<TablaDePagosTab />)
    fireEvent.click(screen.getByRole('switch', { name: 'rules.lateCancel' }))
    fireEvent.click(screen.getByText('grid.publish'))
    await waitFor(() => expect(m.publish).toHaveBeenCalled())
    expect(m.publish.mock.calls[0][0]).toMatchObject({ coverBonusHours: 3, coverBonusAmount: 100, lateCancelHours: null })
  })

  it('una regla mal llenada lo dice y no deja publicar', () => {
    render(<TablaDePagosTab />)
    fireEvent.click(screen.getByRole('switch', { name: 'rules.lateCancel' }))
    fireEvent.change(screen.getByLabelText('rules.lateHours'), { target: { value: '0' } })
    expect(screen.getByRole('alert')).toHaveTextContent('rules.error.lateHours')
    expect(screen.getByText('grid.publish')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('rules.lateHours'), { target: { value: '2' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('grid.publish')).toBeEnabled()
  })
})
