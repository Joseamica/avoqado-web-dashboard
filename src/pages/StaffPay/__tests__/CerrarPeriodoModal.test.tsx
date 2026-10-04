import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CerrarPeriodoModal } from '../components/CerrarPeriodoModal'

const m = vi.hoisted(() => ({ preview: vi.fn(), close: vi.fn(), refetch: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d }) }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, title, children, actions }: { open: boolean; title: string; children: ReactNode; actions?: ReactNode }) =>
    open ? (
      <div>
        <header>
          <h2>{title}</h2>
          {actions}
        </header>
        {children}
      </div>
    ) : null,
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
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('"count":72')
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('close.people')
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('Prado Norte')
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.close).toHaveBeenCalledWith({ fecha: '2026-08-15', huellaEsperada: 'h1', confirmarHuerfanas: false }))
  })

  it('con el nombre del periodo, el botón dice qué se cierra («Cerrar agosto 2026»)', () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" etiqueta="agosto 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByRole('button', { name: /close\.confirmNamed/ })).toHaveTextContent('agosto 2026')
  })

  it('nombra sólo las sedes donde hay dinero (sedesConDinero), no todo el alcance (QA defecto 8)', () => {
    m.preview.mockReturnValue({ data: { ...ok, periodo: { ...ok.periodo, venueIds: ['v1', 'v2'] }, sedesConDinero: ['v1'] }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.willFreeze/)).toHaveTextContent('"sedes":"Prado Norte"')
  })

  it('los ajustes del cierre llevan el mismo «−» que la tabla (QA defecto 14)', () => {
    m.preview.mockReturnValue({ data: { ...ok, totalAjustes: '-150.00', total: '36470.00' }, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText(/close\.adjustmentsIncluded/)).toHaveTextContent('"total":"−$150.00"')
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

  it('otro rechazo del server (4xx) dice el motivo y recarga el preview para mostrar los bloqueos reales', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue({ response: { status: 403, data: { message: 'No tienes permiso en BSF' } } })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'No tienes permiso en BSF', variant: 'destructive' }))
  })

  it('un error de red sólo avisa (no hay preview nuevo que pedir)', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue(new Error('Network Error'))
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'errors.generic' })))
    expect(m.refetch).not.toHaveBeenCalled()
  })

  it('si el periodo ya estaba cerrado, lo dice con su total (no «Periodo cerrado» como si fuera nuevo)', async () => {
    const onCerrado = vi.fn()
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockResolvedValue({ periodId: 'p1', total: '36620.00', yaCerrado: true })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={onCerrado} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() => expect(onCerrado).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/close\.alreadyClosed.*36,620\.00/) }))
  })

  it('si el preview falla, dice por qué, deja reintentar y no deja cerrar', () => {
    m.preview.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { data: { message: 'Sin conexión con el servidor' } } }, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByText('Sin conexión con el servidor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.refetch).toHaveBeenCalled()
  })

  it('en el celular el botón de confirmar va abajo y el título es corto: no se enciman (QA defecto 4)', () => {
    const ancho = window.innerWidth
    window.innerWidth = 390
    try {
      m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
      render(<CerrarPeriodoModal open fecha="2026-07-15" etiqueta="julio de 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
      const encabezado = screen.getByRole('banner')
      expect(encabezado).toHaveTextContent('close.titleLoading')
      expect(within(encabezado).queryByRole('button')).toBeNull()
      expect(screen.getByRole('button', { name: /close\.confirmNamed/ })).toHaveTextContent('julio de 2026')
    } finally {
      window.innerWidth = ancho
    }
  })

  it('en pantalla grande el botón sigue arriba y el título nombra el periodo', () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-07-15" etiqueta="julio de 2026" onOpenChange={() => {}} onCerrado={() => {}} />)
    const encabezado = screen.getByRole('banner')
    expect(encabezado).toHaveTextContent('close.titleNamed')
    expect(within(encabezado).getByRole('button', { name: /close\.confirmNamed/ })).toBeInTheDocument()
  })
})
