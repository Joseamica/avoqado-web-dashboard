import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CerrarPeriodoModal } from '../components/CerrarPeriodoModal'

const m = vi.hoisted(() => ({ preview: vi.fn(), close: vi.fn(), refetch: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children, actions }: { open: boolean; children: ReactNode; actions?: ReactNode }) => (open ? <div>{actions}{children}</div> : null),
}))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => (id === 'v1' ? 'Prado Norte' : id) }))
vi.mock('@/hooks/useStaffPay', () => ({
  useClosePreview: () => m.preview(),
  useClosePeriod: () => ({ mutateAsync: m.close, isPending: false }),
}))

const ok = { periodo: { id: null, start: '2026-08-01', end: '2026-08-31', venueIds: ['v1'] }, puedeCerrar: true, bloqueos: [], clases: 72, excluidas: 0, personas: 4, totalServicios: '36620.00', totalAjustes: '0.00', total: '36620.00', huerfanas: 0, huella: 'h1' }
beforeEach(() => vi.clearAllMocks())

describe('CerrarPeriodoModal', () => {
  it('dice qué va a pasar y confirma con la huella del preview', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockResolvedValue({ periodId: 'p1', yaCerrado: false })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('"clases":72')
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('Prado Norte')
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.close).toHaveBeenCalledWith({ fecha: '2026-08-15', huellaEsperada: 'h1', confirmarHuerfanas: false }))
  })

  it('con el nombre del periodo, el botón dice qué se cierra («Cerrar agosto 2026»)', () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" etiqueta="agosto 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByRole('button', { name: /close\.confirmNamed/ })).toHaveTextContent('agosto 2026')
  })

  it('con bloqueos los explica y no deja confirmar', () => {
    m.preview.mockReturnValue({ data: { ...ok, puedeCerrar: false, bloqueos: [{ codigo: 'EXCEPCIONES', n: 2 }] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.block\.EXCEPCIONES/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
  })

  it('el bloqueo de excepciones lleva a la lista para resolverlas', () => {
    const verExcepciones = vi.fn()
    m.preview.mockReturnValue({ data: { ...ok, puedeCerrar: false, bloqueos: [{ codigo: 'EXCEPCIONES', n: 2 }] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} onVerExcepciones={verExcepciones} />)
    fireEvent.click(screen.getByRole('button', { name: 'period.seeExceptions' }))
    expect(verExcepciones).toHaveBeenCalled()
  })

  it('con reservas sin horario exige la casilla antes de confirmar', () => {
    m.preview.mockReturnValue({ data: { ...ok, huerfanas: 3 }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const confirmar = screen.getByRole('button', { name: 'close.confirm' })
    expect(confirmar).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirmar).not.toBeDisabled()
  })

  it('si los números cambiaron, avisa y vuelve a cargar el preview', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue({ response: { status: 409, data: { code: 'HUELLA_CAMBIO', message: 'Los números cambiaron' } } })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'close.changed' }))
  })

  it('si el preview falla, dice por qué, deja reintentar y no deja cerrar', () => {
    m.preview.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { data: { message: 'Sin conexión con el servidor' } } }, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText('Sin conexión con el servidor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.refetch).toHaveBeenCalled()
  })
})
