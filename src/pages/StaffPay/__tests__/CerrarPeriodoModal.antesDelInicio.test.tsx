// E6a-fix F10 (contrato con el server, QA H5), aparte para no pasar de 500 líneas: un periodo que termina antes del inicio de
// pago al personal ⇒ 409 ANTES_DEL_INICIO con su mensaje en español, y el estado por sede de un periodo pasado es el de ESE
// periodo. Mismo arnés que CerrarPeriodoModal.test.tsx.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CerrarPeriodoModal } from '../components/CerrarPeriodoModal'

const m = vi.hoisted(() => ({ preview: vi.fn(), close: vi.fn(), refetch: vi.fn(), toast: vi.fn(), sedes: vi.fn(), can: vi.fn() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
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
  useStaffPaySedes: (enabled?: boolean) => m.sedes(enabled),
}))
// El diálogo de E3c tiene sus propias pruebas: aquí sólo importa con qué sede y en qué modo se abre.
vi.mock('../components/ParticipacionSedeDialog', () => ({
  ParticipacionSedeDialog: ({ sede, accion, focoDeVuelta }: { sede: { venueId: string }; accion: string; focoDeVuelta?: string }) => (
    <div data-testid="participacion" data-foco={focoDeVuelta}>
      {accion} {sede.venueId}
    </div>
  ),
}))

const ok = { periodo: { id: null, start: '2026-08-01', end: '2026-08-31', venueIds: ['v1'] }, puedeCerrar: true, bloqueos: [], clases: 72, excluidas: 0, personas: 4, totalServicios: '36620.00', totalAjustes: '0.00', total: '36620.00', huerfanas: 0, huella: 'h1' }
beforeEach(() => {
  vi.clearAllMocks()
  m.sedes.mockReturnValue({ data: undefined })
  m.can.mockReturnValue(true)
})

describe('CerrarPeriodoModal — periodo anterior al inicio y estado por sede del periodo', () => {
  const ANTES_DEL_INICIO = {
    response: { status: 409, data: { code: 'ANTES_DEL_INICIO', message: 'Pago al personal está activo desde el 1 sep 2026: ese periodo es anterior' } },
  }
  it('la vista previa de un periodo anterior al inicio (409 ANTES_DEL_INICIO) dice el mensaje del servidor y no deja cerrar', () => {
    m.preview.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: ANTES_DEL_INICIO, refetch: m.refetch })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Pago al personal está activo desde el 1 sep 2026: ese periodo es anterior')
    expect(screen.getByRole('button', { name: 'close.confirm' })).toBeDisabled()
  })

  it('cerrar un periodo anterior al inicio (409 ANTES_DEL_INICIO): el aviso dice el mensaje del servidor', async () => {
    m.preview.mockReturnValue({ data: ok, isLoading: false, refetch: m.refetch })
    m.close.mockRejectedValue(ANTES_DEL_INICIO)
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'close.confirm' }))
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith({ title: 'Pago al personal está activo desde el 1 sep 2026: ese periodo es anterior', variant: 'destructive' }),
    )
    expect(m.refetch).toHaveBeenCalled()
  })

  it('el estado por sede de un periodo pasado es el que manda el servidor para ESE periodo (no el de hoy de «Sedes»)', () => {
    // Hoy las dos están activas en «Sedes»; en ese periodo sólo participó Prado Norte.
    m.sedes.mockReturnValue({ data: { activado: true, sedes: [{ venueId: 'v2', estado: 'ACTIVA' }] } })
    m.preview.mockReturnValue({
      data: { ...ok, porSede: [
        { venueId: 'v1', nombre: 'Prado Norte', estado: 'ACTIVA', entra: { clases: { n: 72, total: '36620.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }, fuera: { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }, pendientes: { n: 0, total: '0.00' } },
        { venueId: 'v2', nombre: 'Wellness', estado: 'SIN_ACTIVAR', entra: { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }, fuera: { clases: { n: 3, total: '900.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }, pendientes: { n: 0, total: '0.00' } },
      ] },
      isLoading: false,
      refetch: m.refetch,
    })
    render(<CerrarPeriodoModal open fecha="2026-08-15" onOpenChange={() => {}} onCerrado={() => {}} />)
    const wellness = screen.getByText('Wellness').closest('li')!
    expect(wellness).toHaveAttribute('data-estado', 'SIN_ACTIVAR')
    expect(within(wellness).getByText('sedes.estado.SIN_ACTIVAR')).toBeInTheDocument()
  })
})
