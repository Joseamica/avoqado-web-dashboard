import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AjusteManualModal } from '../components/AjusteManualModal'

const m = vi.hoisted(() => ({ add: vi.fn(), toast: vi.fn(), equipo: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions }: { open: boolean; children: ReactNode; actions?: ReactNode }) => (open ? <div>{actions}{children}</div> : null),
}))
vi.mock('@tanstack/react-query', async orig => ({ ...(await orig<object>()), useQuery: () => m.equipo() }))
// El combobox real (Popover + cmdk) no se deja manejar en jsdom: cada resultado es un botón.
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect, value, onChange, inputId }: any) => (
    <div>
      <input id={inputId} value={value} onChange={e => onChange(e.target.value)} />
      {items.map((i: any) => (
        <button key={i.id} type="button" onClick={() => onSelect(i)}>
          {i.label}
          {i.description ? ` - ${i.description}` : ''}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/hooks/useStaffPay', () => ({ useAddAdjustment: () => ({ mutateAsync: m.add, isPending: false }) }))

const persona = (staffId: string, firstName: string, lastName: string, email: string) => ({ staffId, firstName, lastName, email })
const CARLA = { data: { data: [persona('s1', 'Carla', 'QA', 'carla@estudio.mx')], meta: { totalCount: 1, hasNextPage: false } } }

const llenar = (tipo: 'manualAdjust.bonus' | 'manualAdjust.deduction' = 'manualAdjust.deduction') => {
  fireEvent.click(screen.getByRole('button', { name: /Carla QA/ }))
  fireEvent.click(screen.getByRole('button', { name: tipo }))
  fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '150' } })
  fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'Llegó tarde' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.equipo.mockReturnValue(CARLA)
})

describe('AjusteManualModal', () => {
  it('un descuento se manda negativo, con sede, motivo y una clave única', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ staffId: 's1', sede: 'v1', amount: -150, reason: 'Llegó tarde' })))
    expect(m.add.mock.calls[0][0].clientKey).toMatch(/.{8,}/)
  })
  it('cada persona trae su correo para distinguir a dos con el mismo nombre', () => {
    m.equipo.mockReturnValue({ data: { data: [persona('s1', 'Carla', 'QA', 'carla@estudio.mx'), persona('s2', 'Carla', 'QA', 'carla.qa@gmail.com')] } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByRole('button', { name: 'Carla QA - carla@estudio.mx' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carla QA - carla.qa@gmail.com' })).toBeInTheDocument()
  })
  it('con más resultados de los que caben, dice cuántos hay y pide escribir el nombre', () => {
    m.equipo.mockReturnValue({ data: { data: [persona('s1', 'Carla', 'QA', 'c@x.mx')], meta: { totalCount: 120, hasNextPage: true } } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByText(/manualAdjust\.moreResults/)).toHaveTextContent('"n":1,"total":120')
  })
  it('antes de guardar dice qué va a pasar: a quién y cuánto se resta', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} etiqueta="octubre 2026" />)
    llenar()
    const resumen = screen.getByText(/manualAdjust\.summaryDeduction/)
    expect(resumen).toHaveTextContent('Carla QA')
    expect(resumen).toHaveTextContent('octubre 2026')
  })
  it('la persona elegida sigue elegida aunque la búsqueda ya no la traiga', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    const { rerender } = render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar()
    m.equipo.mockReturnValue({ data: { data: [persona('s2', 'Luis', 'Pérez', 'luis@x.mx')] } })
    rerender(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByText(/manualAdjust\.selected/)).toHaveTextContent('Carla QA')
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ staffId: 's1' })))
  })
  it('si el server falla, reintentar manda la MISMA clave (el server no crea dos)', async () => {
    m.add.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Se cayó' } } })
    m.add.mockResolvedValueOnce({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    llenar('manualAdjust.bonus')
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Se cayó', variant: 'destructive' })))
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2))
    expect(m.add.mock.calls[1][0].clientKey).toBe(m.add.mock.calls[0][0].clientKey)
    expect(m.add.mock.calls[1][0].amount).toBe(150)
    // La fecha destino viaja SIEMPRE y es la misma en el reintento (Codex bloque A #1): no la decide el reloj del server.
    expect(m.add.mock.calls[0][0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(m.add.mock.calls[1][0].fecha).toBe(m.add.mock.calls[0][0].fecha)
  })
  it('con la fecha del periodo abierto, manda ESA fecha', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-10-01" etiqueta="octubre 2026" />)
    llenar()
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-10-01' })))
  })
  it('sin etiqueta (desde un periodo cerrado), el resumen dice la fecha exacta a la que va', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} fecha="2026-11-01" />)
    llenar()
    expect(screen.getByText(/manualAdjust\.summaryDeduction/)).toHaveTextContent('2026-11-01')
  })
  it('el buscador de persona se llama «Persona» (label conectado al input)', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByLabelText('manualAdjust.person')).toBeInstanceOf(HTMLInputElement)
  })
  it('sin motivo o con monto vacío no deja guardar', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeDisabled()
  })
})
