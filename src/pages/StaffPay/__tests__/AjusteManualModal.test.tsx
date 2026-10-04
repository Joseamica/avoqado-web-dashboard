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
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => <select aria-label="persona" value={value} onChange={e => onValueChange(e.target.value)}><option value="" />{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@/hooks/useStaffPay', () => ({ useAddAdjustment: () => ({ mutateAsync: m.add, isPending: false }) }))

const CARLA = { data: { data: [{ staffId: 's1', firstName: 'Carla', lastName: 'QA' }] } }
beforeEach(() => {
  vi.clearAllMocks()
  m.equipo.mockReturnValue(CARLA)
})

describe('AjusteManualModal', () => {
  it('un descuento se manda negativo, con sede, motivo y una clave única', async () => {
    m.add.mockResolvedValue({ id: 'e1', periodo: { start: '2026-10-01', end: '2026-10-31' } })
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    fireEvent.change(screen.getAllByLabelText('persona')[0], { target: { value: 's1' } })
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.deduction' }))
    fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('manualAdjust.reason'), { target: { value: 'Llegó tarde' } })
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.save' }))
    await waitFor(() => expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ staffId: 's1', sede: 'v1', amount: -150, reason: 'Llegó tarde' })))
    expect(m.add.mock.calls[0][0].clientKey).toMatch(/.{8,}/)
  })
  it('antes de guardar dice qué va a pasar: a quién y cuánto se resta', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} etiqueta="octubre 2026" />)
    fireEvent.change(screen.getAllByLabelText('persona')[0], { target: { value: 's1' } })
    fireEvent.click(screen.getByRole('button', { name: 'manualAdjust.deduction' }))
    fireEvent.change(screen.getByLabelText('manualAdjust.amount'), { target: { value: '150' } })
    const resumen = screen.getByText(/manualAdjust\.summaryDeduction/)
    expect(resumen).toHaveTextContent('Carla QA')
    expect(resumen).toHaveTextContent('octubre 2026')
  })
  it('la persona elegida sigue elegida aunque la búsqueda ya no la traiga', () => {
    const { rerender } = render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    fireEvent.change(screen.getAllByLabelText('persona')[0], { target: { value: 's1' } })
    m.equipo.mockReturnValue({ data: { data: [{ staffId: 's2', firstName: 'Luis', lastName: 'Pérez' }] } })
    rerender(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByRole('option', { name: 'Carla QA' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('persona')[0]).toHaveValue('s1')
  })
  it('sin motivo o con monto vacío no deja guardar', () => {
    render(<AjusteManualModal open onOpenChange={() => {}} sedes={['v1']} />)
    expect(screen.getByRole('button', { name: 'manualAdjust.save' })).toBeDisabled()
  })
})
