import { DateTime } from 'luxon'

import type { ClassSession } from '@/services/classSession.service'
import type { Reservation } from '@/types/reservation'

/** Un evento del día en minutos desde las 00:00 del negocio. `fin` ya trae el alto mínimo con que se dibuja. */
export interface Tramo {
  id: string
  inicio: number
  fin: number
}

export interface Carril {
  carril: number
  carriles: number
}

/**
 * D102: lo que se encima en horario va lado a lado, como Google Calendar y Square, en vez de una caja encima de otra
 * (la de abajo quedaba tapada y sin poder abrirse). Cada grupo de eventos que se traslapan, aunque sea en cadena,
 * comparte el número de carriles; cada evento toma el primer carril libre.
 */
export function repartirCarriles(tramos: Tramo[]): Map<string, Carril> {
  const res = new Map<string, Carril>()
  const orden = [...tramos].sort((a, b) => a.inicio - b.inicio || b.fin - a.fin)
  let grupo: { id: string; carril: number }[] = []
  let finesPorCarril: number[] = []
  let finDelGrupo = -Infinity
  const cerrarGrupo = () => {
    for (const g of grupo) res.set(g.id, { carril: g.carril, carriles: finesPorCarril.length })
    grupo = []
    finesPorCarril = []
  }
  for (const t of orden) {
    if (t.inicio >= finDelGrupo) cerrarGrupo()
    let carril = finesPorCarril.findIndex(fin => fin <= t.inicio)
    if (carril === -1) {
      carril = finesPorCarril.length
      finesPorCarril.push(t.fin)
    } else {
      finesPorCarril[carril] = t.fin
    }
    grupo.push({ id: t.id, carril })
    finDelGrupo = grupo.length === 1 ? t.fin : Math.max(finDelGrupo, t.fin)
  }
  cerrarGrupo()
  return res
}

/**
 * Posición horizontal de un carril, de borde a borde (left y right): la tarjeta nunca se sale de su carril ni de su día.
 * Con uno o dos carriles deja 4 px de cada lado, como antes; con más, 1 px.
 * ponytail: con ~40+ cosas a la vez en una columna angosta (semana, 5 días) cada carril queda de ~2 px; siguen sin
 * encimarse, pero ya no se leen. Si estorba, el arreglo es un «+N» por grupo.
 */
export function posicionDelCarril(c?: Carril): { left: string; right: string } {
  const { carril, carriles } = c ?? { carril: 0, carriles: 1 }
  const margen = carriles > 2 ? 1 : 4
  const pct = (n: number) => Math.round(((n * 100) / carriles) * 1000) / 1000
  return { left: `calc(${pct(carril)}% + ${margen}px)`, right: `calc(${pct(carriles - carril - 1)}% + ${margen}px)` }
}

/** Relleno interno de la tarjeta: con carriles angostos el relleno haría la tarjeta más ancha que su carril. */
export function paddingDelCarril(c?: Carril): string {
  const carriles = c?.carriles ?? 1
  return carriles > 6 ? 'px-0' : carriles > 2 ? 'px-1' : 'px-2'
}

type ConHorario = Pick<Reservation, 'startsAt' | 'endsAt'>

/** Los carriles de una columna: clases (con llave `cs-<id>`) y reservaciones juntas, porque también se enciman entre sí. */
export function carrilesDe(
  clases: (ConHorario & { id: string })[],
  reservaciones: (ConHorario & { id: string })[],
  zona: string,
): Map<string, Carril> {
  return repartirCarriles([
    ...clases.map(s => tramoDelEvento(`cs-${s.id}`, s, zona)),
    ...reservaciones.map(r => tramoDelEvento(r.id, r, zona)),
  ])
}

/** Minutos del día del negocio de un evento; el alto mínimo con que se dibuja (24 px de 64 por hora) cuenta como ocupado. */
export function tramoDelEvento(id: string, evento: ConHorario, zona: string): Tramo {
  const ini = DateTime.fromISO(evento.startsAt, { zone: 'utc' }).setZone(zona)
  const fin = DateTime.fromISO(evento.endsAt, { zone: 'utc' }).setZone(zona)
  const inicio = ini.hour * 60 + ini.minute
  const finDelDia = fin.hasSame(ini, 'day') ? fin.hour * 60 + fin.minute : 24 * 60
  return { id, inicio, fin: Math.max(finDelDia, inicio + 23) }
}

/**
 * D104: la cuadrícula sale del horario del negocio, pero se estira para que quepa todo lo agendado en los días a la
 * vista. Una cita de 07:00 con horario de 09:00 se dibujaba fuera del área visible y no había forma de verla.
 * Cada hora de la lista es una fila de hh:00 a hh+1:00.
 */
export function horasConEventos(base: number[], eventos: ConHorario[], zona: string): number[] {
  let primera = base[0]
  let ultima = base[base.length - 1]
  for (const e of eventos) {
    const ini = DateTime.fromISO(e.startsAt, { zone: 'utc' }).setZone(zona)
    const fin = DateTime.fromISO(e.endsAt, { zone: 'utc' }).setZone(zona)
    primera = Math.min(primera, ini.hour)
    const ultimaFila = !fin.hasSame(ini, 'day') ? 23 : fin.minute === 0 && fin.hour > ini.hour ? fin.hour - 1 : fin.hour
    ultima = Math.max(ultima, ultimaFila)
  }
  if (primera === base[0] && ultima === base[base.length - 1]) return base
  return Array.from({ length: ultima - primera + 1 }, (_, i) => i + primera)
}

export interface ColumnaAgrupada {
  key: string
  headerLabel: string
  reservations: Reservation[]
  classSessions: ClassSession[]
}

/**
 * D103: al agrupar por personal o mesa, las clases del día también entran a su columna. Antes sólo se pintaban las
 * reservaciones que manda el servidor agrupadas y las clases desaparecían del calendario. Por personal, cada clase va
 * con su instructor (o a «Sin asignar»); por mesa, a «Sin asignar».
 */
export function columnasAgrupadas(
  grouped: Record<string, Reservation[]>,
  clases: ClassSession[],
  modo: 'staff' | 'table',
  mostrar: (r: Reservation) => boolean,
  etiquetas: { sinAsignar: string; mesa: (numero: string) => string },
): ColumnaAgrupada[] {
  const esSinAsignar = (key: string) => key === 'unassigned' || key === 'null'
  const columnas = new Map<string, ColumnaAgrupada>()
  for (const [key, rsvps] of Object.entries(grouped)) {
    let headerLabel: string
    if (esSinAsignar(key)) headerLabel = etiquetas.sinAsignar
    else if (modo === 'staff') {
      const staff = rsvps[0]?.assignedStaff
      headerLabel = staff ? `${staff.firstName} ${staff.lastName}` : key
    } else {
      const table = rsvps[0]?.table
      headerLabel = table ? etiquetas.mesa(table.number) : key
    }
    columnas.set(key, { key, headerLabel, reservations: rsvps.filter(r => !r.classSessionId && mostrar(r)), classSessions: [] })
  }
  for (const s of clases) {
    const key = modo === 'staff' && s.assignedStaffId ? s.assignedStaffId : 'unassigned'
    let col = columnas.get(key) ?? (key === 'unassigned' ? columnas.get('null') : undefined)
    if (!col) {
      const headerLabel = key === 'unassigned' ? etiquetas.sinAsignar : s.assignedStaff ? `${s.assignedStaff.firstName} ${s.assignedStaff.lastName}` : key
      col = { key, headerLabel, reservations: [], classSessions: [] }
      columnas.set(key, col)
    }
    col.classSessions.push(s)
  }
  // Primero las columnas con nombre, «Sin asignar» al final.
  return [...columnas.values()].sort((a, b) => {
    if (esSinAsignar(a.key)) return 1
    if (esSinAsignar(b.key)) return -1
    return a.headerLabel.localeCompare(b.headerLabel)
  })
}
