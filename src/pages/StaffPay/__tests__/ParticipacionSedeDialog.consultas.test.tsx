// E6a-fix F8 y F12 (QA H3, H10): el diálogo de una sede con los hooks REALES y un QueryClient real (sólo el servicio es
// simulado). H10: tras confirmar, la invalidación volvía a pedir la vista previa y el servidor contestaba 409 «ya está activa».
// H3: abierto desde el bloqueo del cierre, al confirmar el foco caía en la página de fondo, tapada por el modal.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ParticipacionSedeDialog } from '../components/ParticipacionSedeDialog'
import { soltarFocoAlAbrir } from '../foco'

const m = vi.hoisted(() => ({ preview: vi.fn(), activar: vi.fn(), desactivar: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    participationPreview: (...a: unknown[]) => m.preview(...a),
    activateSede: (...a: unknown[]) => m.activar(...a),
    deactivateSede: (...a: unknown[]) => m.desactivar(...a),
  },
}))

const cero = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const sede = {
  venueId: 'b', nombre: 'Condesa', zona: 'America/Mexico_City', tienePlan: true, estado: 'SIN_ACTIVAR', desde: null, hasta: null,
  minimo: '2026-10-01', puedeActivar: true, puedeDesactivar: false, fueraEstePeriodo: cero,
} as const
const activa = { ...sede, estado: 'ACTIVA_SIN_PLAN', desde: '2026-09-01', puedeActivar: false, puedeDesactivar: true } as const
const vistaActivar = { accion: 'activar', fecha: '2026-10-07', minimo: '2026-10-01', maximo: '2026-10-07', zona: 'America/Mexico_City', entran: cero, quedanFuera: cero }
const vistaDesactivar = { accion: 'desactivar', fecha: '2026-09-30', minimo: '2026-09-01', maximo: '2026-10-07', zona: 'America/Mexico_City', dejanDeEntrar: cero, permanecen: cero }

const conCliente = (ui: React.ReactNode) => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={cliente}>{ui}</QueryClientProvider>)
}

beforeEach(() => vi.clearAllMocks())

describe('ParticipacionSedeDialog con los hooks reales', () => {
  it('🔴 activar con éxito NO vuelve a pedir la vista previa (el servidor ya diría 409 «ya está activa»)', async () => {
    m.preview.mockResolvedValue(vistaActivar)
    m.activar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-10-07', hasta: null } })
    const onClose = vi.fn()
    conCliente(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={onClose} />)
    const confirmar = await screen.findByRole('button', { name: /sedes\.dialogo\.confirmarActivar/ })
    await waitFor(() => expect(confirmar).toBeEnabled())
    expect(m.preview).toHaveBeenCalledTimes(1)
    fireEvent.click(confirmar)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    await new Promise(r => setTimeout(r, 30))
    expect(m.preview).toHaveBeenCalledTimes(1)
  })

  it('🔴 desactivar con éxito tampoco la vuelve a pedir', async () => {
    m.preview.mockResolvedValue(vistaDesactivar)
    m.desactivar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-09-01', hasta: '2026-09-30' } })
    const onClose = vi.fn()
    conCliente(<ParticipacionSedeDialog sede={activa} accion="desactivar" onClose={onClose} />)
    const confirmar = await screen.findByRole('button', { name: /sedes\.dialogo\.confirmarDesactivar/ })
    await waitFor(() => expect(confirmar).toBeEnabled())
    fireEvent.click(confirmar)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    await new Promise(r => setTimeout(r, 30))
    expect(m.preview).toHaveBeenCalledTimes(1)
  })

  it('un rechazo 4xx sí la vuelve a pedir (dice el estado real y apaga el botón)', async () => {
    m.preview.mockResolvedValue(vistaActivar)
    m.activar.mockRejectedValue({ response: { status: 409, data: { code: 'VENTANA_SE_CRUZA', message: 'Se cruza' } } })
    conCliente(<ParticipacionSedeDialog sede={sede} accion="activar" onClose={vi.fn()} />)
    const confirmar = await screen.findByRole('button', { name: /sedes\.dialogo\.confirmarActivar/ })
    await waitFor(() => expect(confirmar).toBeEnabled())
    fireEvent.click(confirmar)
    await waitFor(() => expect(m.preview).toHaveBeenCalledTimes(2))
  })

  /**
   * El bloqueo del cierre: un botón «Desactivar <sede>» DENTRO del modal (que desaparece al confirmar, porque el bloqueo se
   * va) y el encabezado del periodo en la página de FONDO (`data-staffpay-ancla`), tapado por el modal.
   */
  function DesdeElCierre({ focoDeVuelta }: { focoDeVuelta?: string }) {
    const [abierto, setAbierto] = useState(false)
    const [bloqueado, setBloqueado] = useState(true)
    return (
      <>
        <h3 tabIndex={-1} data-staffpay-ancla>
          Periodo de fondo
        </h3>
        <div data-testid="modal-del-cierre">
          <section tabIndex={-1} data-staffpay-cierre-ancla>
            Resumen del cierre
          </section>
          {bloqueado && (
            <button
              type="button"
              onClick={e => {
                soltarFocoAlAbrir(e.currentTarget)
                setAbierto(true)
              }}
            >
              Desactivar Condesa
            </button>
          )}
        </div>
        {abierto && (
          <ParticipacionSedeDialog
            sede={activa}
            accion="desactivar"
            focoDeVuelta={focoDeVuelta}
            onClose={() => {
              // El bloqueo sólo se va si la sede se desactivó (cancelar lo deja igual).
              setBloqueado(m.desactivar.mock.calls.length === 0)
              setAbierto(false)
            }}
          />
        )}
      </>
    )
  }

  it('🔴 abierto desde el cierre: al confirmar, el foco vuelve DENTRO del modal del cierre, no a la página de fondo', async () => {
    m.preview.mockResolvedValue(vistaDesactivar)
    m.desactivar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-09-01', hasta: '2026-09-30' } })
    conCliente(<DesdeElCierre focoDeVuelta="[data-staffpay-cierre-ancla]" />)
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Condesa' }))
    const confirmar = await screen.findByRole('button', { name: /sedes\.dialogo\.confirmarDesactivar/ })
    await waitFor(() => expect(confirmar).toBeEnabled())
    fireEvent.click(confirmar)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Desactivar Condesa' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-staffpay-cierre-ancla'))
    expect(screen.getByTestId('modal-del-cierre')).toContainElement(document.activeElement as HTMLElement)
  })

  it('cancelar desde el cierre devuelve el foco al botón «Desactivar <sede>», que sigue ahí', async () => {
    m.preview.mockResolvedValue(vistaDesactivar)
    conCliente(<DesdeElCierre focoDeVuelta="[data-staffpay-cierre-ancla]" />)
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Condesa' }))
    fireEvent.click(await screen.findByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Desactivar Condesa' })))
  })
})
