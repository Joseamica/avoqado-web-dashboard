import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AvisoSedesFuera } from '../components/AvisoSedesFuera'

const m = vi.hoisted(() => ({ sedes: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/useStaffPay', () => ({ useStaffPaySedes: (enabled: boolean) => m.sedes(enabled) }))

const cero = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const conDinero = { ...cero, comisiones: { n: 41, total: '1230.00' } }
const s = (x: Record<string, unknown>) => ({ venueId: 'v', nombre: 'Condesa', estado: 'ACTIVA', minimo: '2026-10-01', fueraEstePeriodo: cero, ...x })
const con = (sedes: unknown[], activado = true) => m.sedes.mockReturnValue({ data: { activado, periodo: { start: '2026-10-01', end: '2026-10-31' }, sedes } })
const pintar = (activa = true) => render(<MemoryRouter><AvisoSedesFuera activa={activa} /></MemoryRouter>)

beforeEach(() => vi.clearAllMocks())

describe('AvisoSedesFuera — el aviso en «Periodos» (diseño r3.10, r4.11)', () => {
  it('sin activar y con dinero fuera: ámbar, lo nombra y lleva a Sedes', () => {
    con([s({ estado: 'SIN_ACTIVAR', fueraEstePeriodo: conDinero })])
    pintar()
    expect(screen.getByRole('note')).toHaveTextContent('Condesa')
    expect(screen.getByRole('note')).toHaveTextContent('dia(2026-10-01)')
    expect(screen.getByRole('note')).toHaveTextContent('sedes.cuenta.comisiones')
    expect(screen.getByRole('link', { name: 'sedes.verSedes' })).toHaveAttribute('href', '/venues/x/servicio-pago#sedes')
  })
  it('activa sin plan: en rojo, «bloquea el cierre»', () => {
    con([s({ estado: 'ACTIVA_SIN_PLAN' })])
    pintar()
    expect(screen.getByRole('alert')).toHaveTextContent(/sedes\.aviso\.sinPlan/)
    expect(screen.getByRole('alert')).toHaveTextContent('Condesa')
    expect(screen.getByRole('link', { name: 'sedes.verSedes' })).toHaveAttribute('href', '/venues/x/servicio-pago#sedes')
  })
  it('varias sin plan: las nombra todas y concuerda en plural', () => {
    con([s({ estado: 'ACTIVA_SIN_PLAN' }), s({ venueId: 'r', nombre: 'Roma', estado: 'ACTIVA_SIN_PLAN' })])
    pintar()
    expect(screen.getByRole('alert')).toHaveTextContent('Condesa y Roma')
    expect(screen.getByRole('alert')).toHaveTextContent('"count":2')
  })
  it('más de 3 sedes fuera: las 3 primeras y «y N sedes más»', () => {
    con(['A', 'B', 'C', 'D', 'E'].map(n => s({ venueId: n, nombre: `Sede ${n}`, estado: 'SIN_ACTIVAR', fueraEstePeriodo: conDinero })))
    pintar()
    const nota = screen.getByRole('note')
    expect(nota).toHaveTextContent('Sede C')
    expect(nota).not.toHaveTextContent('Sede D')
    expect(nota).toHaveTextContent('sedes.aviso.mas:{"count":2}')
  })
  it('todo activo o sin dinero fuera: no pinta nada; inactiva la pestaña: no pide nada', () => {
    con([s({}), s({ venueId: 'b', estado: 'SIN_ACTIVAR' })])
    const { container } = pintar(false)
    expect(container).toBeEmptyDOMElement()
    expect(m.sedes).toHaveBeenCalledWith(false)
  })
  it('todo activo o sin dinero fuera, con la pestaña activa: tampoco pinta nada', () => {
    con([s({}), s({ venueId: 'b', estado: 'SIN_ACTIVAR' }), s({ venueId: 'c', estado: 'SIN_PLAN', fueraEstePeriodo: conDinero })])
    const { container } = pintar()
    expect(container).toBeEmptyDOMElement()
  })
  it('mientras carga, o si falla, no estorba (la pestaña Sedes dice el error)', () => {
    m.sedes.mockReturnValue({ data: undefined })
    const { container } = pintar()
    expect(container).toBeEmptyDOMElement()
  })
})
