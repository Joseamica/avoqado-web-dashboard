import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SedesTab } from '../components/SedesTab'

const m = vi.hoisted(() => ({ sedes: vi.fn(), dialogo: vi.fn(), precio: vi.fn(), can: vi.fn() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-feature-price', () => ({
  useFeaturePrice: (codigo: string, o?: { enabled?: boolean }) => {
    m.precio(codigo, o)
    return { price: 199, canSeePrices: true, canPurchase: true }
  },
}))
vi.mock('@/hooks/useStaffPay', () => ({ useStaffPaySedes: (enabled: boolean) => m.sedes(enabled) }))
vi.mock('../components/ParticipacionSedeDialog', () => ({
  ParticipacionSedeDialog: ({ sede, accion, onClose }: any) => {
    m.dialogo(sede.venueId, accion)
    return (
      <div>
        dialogo {accion}
        <button type="button" onClick={onClose}>
          cerrar-dialogo
        </button>
      </div>
    )
  },
}))

const cero = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const sede = (x: Record<string, unknown>) => ({
  venueId: 'v', nombre: 'Prado Norte', zona: 'America/Mexico_City', tienePlan: true, estado: 'ACTIVA', desde: '2026-10-01', hasta: null,
  minimo: null, puedeActivar: false, puedeDesactivar: true, fueraEstePeriodo: cero, ...x,
})
const refetch = vi.fn()
const con = (sedes: unknown[], activado = true) =>
  m.sedes.mockReturnValue({ data: { activado, startDate: activado ? '2026-10-01' : null, periodo: activado ? { start: '2026-10-01', end: '2026-10-31' } : null, sedes }, isLoading: false, isError: false, refetch })
const pantalla = () => render(<MemoryRouter><SedesTab activa /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  m.can.mockReturnValue(true)
})

describe('SedesTab — pantalla 1 del founder (diseño r3.7(1))', () => {
  it('una sede sin activar va en ámbar con lo que queda fuera y su botón Activar', () => {
    con([sede({ venueId: 'b', nombre: 'Condesa', estado: 'SIN_ACTIVAR', desde: null, minimo: '2026-10-01', puedeActivar: true, puedeDesactivar: false,
      fueraEstePeriodo: { ...cero, comisiones: { n: 41, total: '1230.00' } } })])
    pantalla()
    expect(screen.getByText('sedes.estado.SIN_ACTIVAR')).toBeInTheDocument()
    expect(screen.getByText(/sedes\.fuera\.sinActivar/)).toHaveTextContent('dia(2026-10-01)')
    expect(screen.getByText(/sedes\.fuera\.sinActivar/)).toHaveTextContent('sedes.cuenta.comisiones')
    fireEvent.click(screen.getByRole('button', { name: 'sedes.activar' }))
    expect(m.dialogo).toHaveBeenCalledWith('b', 'activar')
  })

  it('activa sin plan va en ROJO, dice que bloquea el cierre y ofrece desactivar', () => {
    con([sede({ estado: 'ACTIVA_SIN_PLAN', tienePlan: false })])
    pantalla()
    expect(screen.getByText('sedes.estado.ACTIVA_SIN_PLAN').closest('[data-estado]')).toHaveAttribute('data-estado', 'ACTIVA_SIN_PLAN')
    expect(screen.getByText('sedes.bloqueaCierre')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'sedes.desactivar' }))
    expect(m.dialogo).toHaveBeenCalledWith('v', 'desactivar')
  })

  it('sin plan: dice cómo se consigue, con el precio suelto, y no hay botones', () => {
    con([sede({ estado: 'SIN_PLAN', tienePlan: false, desde: null, puedeDesactivar: false })])
    pantalla()
    expect(screen.getByText(/sedes\.sinPlan/)).toHaveTextContent('199')
    expect(screen.queryByRole('button', { name: /sedes\.(activar|desactivar)/ })).toBeNull()
    // El catálogo de precios sólo se pide cuando hay alguna sede sin plan.
    expect(m.precio).toHaveBeenLastCalledWith('SERVICE_PAY', { enabled: true })
  })

  it('sin ninguna sede sin plan no pide el precio', () => {
    con([sede({})])
    pantalla()
    expect(m.precio).toHaveBeenLastCalledWith('SERVICE_PAY', { enabled: false })
  })

  it('sin el permiso de cerrar: se ve, sin botones, y dice a quién pedírselo', () => {
    con([sede({ estado: 'SIN_ACTIVAR', minimo: '2026-10-01', puedeActivar: false, puedeDesactivar: false })])
    pantalla()
    expect(screen.queryByRole('button', { name: 'sedes.activar' })).toBeNull()
    expect(screen.getByText('sedes.sinPermiso')).toBeInTheDocument()
  })

  it('activa y sin permiso de desactivar: también dice a quién pedírselo', () => {
    con([sede({ puedeDesactivar: false })])
    pantalla()
    expect(screen.queryByRole('button', { name: 'sedes.desactivar' })).toBeNull()
    expect(screen.getByText('sedes.sinPermiso')).toBeInTheDocument()
  })

  // E6a-fix F3 (Codex bloque E #3): la ruta va bajo la sede ACTUAL y exige «Cerrar periodos» ahí; las banderas son del destino.
  it('🔴 con permiso en el destino pero NO en esta sede: sin Activar, y dice que entre desde una sede con el permiso', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    con([sede({ venueId: 'b', nombre: 'Condesa', estado: 'SIN_ACTIVAR', desde: null, minimo: '2026-10-01', puedeActivar: true, puedeDesactivar: false })])
    pantalla()
    expect(screen.queryByRole('button', { name: 'sedes.activar' })).toBeNull()
    expect(screen.getByText('sedes.cambiaDeSede')).toBeInTheDocument()
    // No culpa al permiso del destino: ahí sí lo tiene.
    expect(screen.queryByText('sedes.sinPermiso')).toBeNull()
  })

  it('🔴 lo mismo con Desactivar: sin el permiso aquí no hay botón (terminaría en 403)', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    con([sede({ puedeDesactivar: true })])
    pantalla()
    expect(screen.queryByRole('button', { name: 'sedes.desactivar' })).toBeNull()
    expect(screen.getByText('sedes.cambiaDeSede')).toBeInTheDocument()
  })

  it('sin el permiso aquí NI en el destino: el aviso de siempre (a quién pedírselo), no «cambia de sede»', () => {
    m.can.mockReturnValue(false)
    con([sede({ puedeDesactivar: false })])
    pantalla()
    expect(screen.getByText('sedes.sinPermiso')).toBeInTheDocument()
    expect(screen.queryByText('sedes.cambiaDeSede')).toBeNull()
  })

  it('sin activar y sin días que puedan entrar hoy: no culpa al permiso, dice por qué', () => {
    con([sede({ estado: 'SIN_ACTIVAR', desde: null, minimo: null, puedeActivar: false, puedeDesactivar: false })])
    pantalla()
    expect(screen.queryByText('sedes.sinPermiso')).toBeNull()
    expect(screen.getByText('sedes.sinDiasHoy')).toBeInTheDocument()
  })

  it('activa: desde cuándo, y lo de antes de su inicio que todavía puede entrar, en gris', () => {
    con([sede({ fueraEstePeriodo: { ...cero, propinas: { n: 2, total: '80.00' } } })])
    pantalla()
    expect(screen.getByText(/sedes\.activaDesde/)).toHaveTextContent('dia(2026-10-01)')
    expect(screen.getByText(/sedes\.fuera\.antesDe/)).toHaveTextContent('sedes.cuenta.propinas')
    expect(screen.queryByText(/sedes\.fuera\.sinActivar/)).toBeNull()
  })

  it('activa con último día: «del … al …»', () => {
    con([sede({ hasta: '2026-10-20', puedeDesactivar: false })])
    pantalla()
    expect(screen.getByText(/sedes\.activaHasta/)).toHaveTextContent('dia(2026-10-20)')
    // Con la ventana ya cerrada no se desactiva: no es falta de permiso.
    expect(screen.queryByText('sedes.sinPermiso')).toBeNull()
  })

  it('sin nada fuera no dice «quedan fuera»', () => {
    con([sede({ estado: 'SIN_ACTIVAR', desde: null, minimo: '2026-10-01', puedeActivar: true, puedeDesactivar: false })])
    pantalla()
    expect(screen.queryByText(/sedes\.fuera/)).toBeNull()
  })

  it('el diálogo se cierra con onClose', () => {
    con([sede({})])
    pantalla()
    fireEvent.click(screen.getByRole('button', { name: 'sedes.desactivar' }))
    expect(screen.getByText('dialogo desactivar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cerrar-dialogo' }))
    expect(screen.queryByText('dialogo desactivar')).toBeNull()
  })

  it('antes de activar pago al personal: lista las sedes y manda a «Periodos»', () => {
    con([sede({ estado: 'SIN_ACTIVAR', desde: null, puedeActivar: false, puedeDesactivar: false }), sede({ venueId: 'c', nombre: 'Roma', tienePlan: false, estado: 'SIN_PLAN', desde: null, puedeDesactivar: false })], false)
    pantalla()
    expect(screen.getByRole('link', { name: 'sedes.irAActivar' })).toHaveAttribute('href', '/venues/x/servicio-pago#periodos')
    expect(screen.getByText('sedes.antesDeActivar')).toBeInTheDocument()
    expect(screen.getByText('sedes.conPlan')).toBeInTheDocument()
    expect(screen.getByText('sedes.estado.SIN_PLAN')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sedes\.(activar|desactivar)/ })).toBeNull()
  })

  it('cargando: esqueleto, sin lista', () => {
    m.sedes.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch })
    const { container } = pantalla()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('un 409 dice el mensaje del servidor y deja reintentar', () => {
    m.sedes.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { status: 409, data: { code: 'LECTURA_VENCIDA', message: 'La consulta tardó demasiado' } } }, refetch })
    pantalla()
    expect(screen.getByRole('alert')).toHaveTextContent('La consulta tardó demasiado')
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('un error sin mensaje del servidor dice el genérico de sedes', () => {
    m.sedes.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('red'), refetch })
    pantalla()
    expect(screen.getByRole('alert')).toHaveTextContent('sedes.error')
  })

  it('la pestaña oculta no pide nada', () => {
    con([sede({})])
    render(<MemoryRouter><SedesTab activa={false} /></MemoryRouter>)
    expect(m.sedes).toHaveBeenCalledWith(false)
  })
})
