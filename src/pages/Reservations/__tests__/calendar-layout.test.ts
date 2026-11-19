import { describe, expect, it } from 'vitest'

import type { ClassSession } from '@/services/classSession.service'
import type { Reservation } from '@/types/reservation'

import { carrilesDe, columnasAgrupadas, horasConEventos, paddingDelCarril, posicionDelCarril, repartirCarriles, tramoDelEvento } from '../calendar-layout'

const MX = 'America/Mexico_City' // UTC-6 en noviembre
const h = (hhmm: string, dia = '2026-11-19') => `${dia}T${hhmm}:00-06:00`
const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

describe('repartirCarriles (D102: lo encimado va lado a lado)', () => {
  it('una sola cita ocupa todo el ancho', () => {
    expect(repartirCarriles([{ id: 'a', inicio: min('17:00'), fin: min('18:00') }]).get('a')).toEqual({ carril: 0, carriles: 1 })
  })

  it('el caso de la revisión: dos a las 17:00, una a las 17:30 y otra a las 18:00 → 3 carriles, nadie tapado', () => {
    const r = repartirCarriles([
      { id: 'carla', inicio: min('17:00'), fin: min('18:00') },
      { id: 'diego', inicio: min('17:00'), fin: min('18:00') },
      { id: 'maria', inicio: min('17:30'), fin: min('18:30') },
      { id: 'beto', inicio: min('18:00'), fin: min('19:00') },
    ])
    expect(r.get('carla')).toEqual({ carril: 0, carriles: 3 })
    expect(r.get('diego')).toEqual({ carril: 1, carriles: 3 })
    expect(r.get('maria')).toEqual({ carril: 2, carriles: 3 })
    // Beto empieza cuando Carla termina: reusa su carril, pero sigue en el grupo de María (que termina 18:30).
    expect(r.get('beto')).toEqual({ carril: 0, carriles: 3 })
  })

  it('lo que empieza justo al terminar otra cosa, sin más traslapes, vuelve a todo el ancho', () => {
    const r = repartirCarriles([
      { id: 'a', inicio: min('17:00'), fin: min('18:00') },
      { id: 'b', inicio: min('17:00'), fin: min('18:00') },
      { id: 'c', inicio: min('18:00'), fin: min('19:00') },
    ])
    expect(r.get('c')).toEqual({ carril: 0, carriles: 1 })
    expect(r.get('a')?.carriles).toBe(2)
  })

  it('cada carril queda a su lado y con un solo carril se ve igual que antes (4 px de cada lado)', () => {
    expect(posicionDelCarril()).toEqual({ left: 'calc(0% + 4px)', right: 'calc(0% + 4px)' })
    expect(posicionDelCarril({ carril: 1, carriles: 2 })).toEqual({ left: 'calc(50% + 4px)', right: 'calc(0% + 4px)' })
  })

  it('con muchas cosas a la vez el margen baja a 1 px y la tarjeta nunca se sale de su carril (Codex r1 #1, r3 #4)', () => {
    expect(posicionDelCarril({ carril: 15, carriles: 16 })).toEqual({ left: 'calc(93.75% + 1px)', right: 'calc(0% + 1px)' })
    // El último de 60 termina en el borde de su día, no en el siguiente.
    expect(posicionDelCarril({ carril: 59, carriles: 60 }).right).toBe('calc(0% + 1px)')
    // Codex r2 #1: el relleno no hace la tarjeta más ancha que su carril.
    expect([paddingDelCarril(), paddingDelCarril({ carril: 0, carriles: 3 }), paddingDelCarril({ carril: 0, carriles: 16 })]).toEqual(['px-2', 'px-1', 'px-0'])
  })

  it('una clase y una cita que se enciman también van lado a lado (la clase con llave cs-)', () => {
    const r = carrilesDe(
      [{ id: 'c1', startsAt: h('19:00', '2026-11-18'), endsAt: h('20:00', '2026-11-18') }],
      [{ id: 'r1', startsAt: h('18:30', '2026-11-18'), endsAt: h('19:30', '2026-11-18') }],
      MX,
    )
    expect(r.get('r1')).toEqual({ carril: 0, carriles: 2 })
    expect(r.get('cs-c1')).toEqual({ carril: 1, carriles: 2 })
  })

  it('una cita de 15 min cuenta con el alto con que se dibuja (no queda debajo de la siguiente)', () => {
    const corta = tramoDelEvento('corta', { startsAt: h('20:00'), endsAt: h('20:15') }, MX)
    expect(corta.fin).toBe(min('20:00') + 23)
    const r = repartirCarriles([corta, { id: 'sig', inicio: min('20:15'), fin: min('21:00') }])
    expect(r.get('corta')?.carriles).toBe(2)
  })
})

describe('horasConEventos (D104: nada agendado queda fuera de la cuadrícula)', () => {
  const base = Array.from({ length: 14 }, (_, i) => i + 9) // horario 09:00–22:00 → filas 9..22

  it('sin eventos fuera del horario se queda igual (misma lista)', () => {
    expect(horasConEventos(base, [{ startsAt: h('17:00'), endsAt: h('18:00') }], MX)).toBe(base)
    expect(horasConEventos(base, [{ startsAt: h('21:30'), endsAt: h('23:00') }], MX)).toBe(base)
  })

  it('una cita de 07:00 con horario de 09:00 hace que la cuadrícula empiece a las 07:00', () => {
    const horas = horasConEventos(base, [{ startsAt: h('07:00'), endsAt: h('08:00') }], MX)
    expect(horas[0]).toBe(7)
    expect(horas[horas.length - 1]).toBe(22)
  })

  it('una cita que termina 23:30 agrega la fila de las 23', () => {
    const horas = horasConEventos(base, [{ startsAt: h('22:00'), endsAt: h('23:30') }], MX)
    expect(horas[horas.length - 1]).toBe(23)
  })

  it('una que cruza la medianoche llega hasta la fila de las 23, no rompe la lista', () => {
    const horas = horasConEventos(base, [{ startsAt: h('23:00'), endsAt: h('01:00', '2026-11-20') }], MX)
    expect(horas[0]).toBe(9)
    expect(horas[horas.length - 1]).toBe(23)
  })
})

describe('columnasAgrupadas (D103: las clases no desaparecen al agrupar)', () => {
  const rsv = (id: string, extra: Partial<Reservation> = {}) =>
    ({ id, status: 'CONFIRMED', classSessionId: null, assignedStaff: null, table: null, ...extra }) as unknown as Reservation
  const clase = (id: string, staff: { id: string; firstName: string; lastName: string } | null) =>
    ({ id, assignedStaffId: staff?.id ?? null, assignedStaff: staff }) as unknown as ClassSession
  const etiquetas = { sinAsignar: 'Sin asignar', mesa: (n: string) => `Mesa ${n}` }
  const todas = () => true
  const ana = { id: 'st-ana', firstName: 'Ana', lastName: 'López' }

  it('el caso de la revisión: 3 citas sin asignar y 2 clases sin instructor → todo en «Sin asignar»', () => {
    const cols = columnasAgrupadas({ unassigned: [rsv('r1'), rsv('r2'), rsv('r3')] }, [clase('c1', null), clase('c2', null)], 'staff', todas, etiquetas)
    expect(cols).toHaveLength(1)
    expect(cols[0].reservations).toHaveLength(3)
    expect(cols[0].classSessions.map(c => c.id)).toEqual(['c1', 'c2'])
  })

  it('por personal, la clase va con su instructor aunque no tenga citas, y «Sin asignar» queda al final', () => {
    const cols = columnasAgrupadas({ unassigned: [rsv('r1')] }, [clase('c1', ana)], 'staff', todas, etiquetas)
    expect(cols.map(c => c.headerLabel)).toEqual(['Ana López', 'Sin asignar'])
    expect(cols[0].classSessions.map(c => c.id)).toEqual(['c1'])
  })

  it('por mesa, las clases van a «Sin asignar» (se crea si no había)', () => {
    const cols = columnasAgrupadas(
      { 'tb-1': [rsv('r1', { tableId: 'tb-1', table: { id: 'tb-1', number: '4', capacity: 4 } } as Partial<Reservation>)] },
      [clase('c1', ana)],
      'table',
      todas,
      etiquetas,
    )
    expect(cols.map(c => c.headerLabel)).toEqual(['Mesa 4', 'Sin asignar'])
    expect(cols[1].classSessions.map(c => c.id)).toEqual(['c1'])
  })

  it('sigue respetando los filtros y deja fuera las reservaciones que viven dentro de una clase', () => {
    const cols = columnasAgrupadas(
      { unassigned: [rsv('ok'), rsv('pendiente', { status: 'PENDING' }), rsv('en-clase', { classSessionId: 'c9' } as Partial<Reservation>)] },
      [],
      'staff',
      r => r.status !== 'PENDING',
      etiquetas,
    )
    expect(cols[0].reservations.map(r => r.id)).toEqual(['ok'])
  })
})
