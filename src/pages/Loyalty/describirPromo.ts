import type { TFunction } from 'i18next'

import type { LoyaltyPromotionKind, LoyaltyPromotionLimit } from '@/types/customer'

/** Lo que la frase necesita. En el diálogo sale del BORRADOR (no de lo guardado); en la lista, de la promo guardada. */
export interface PromoParaDescribir {
  kind: LoyaltyPromotionKind
  multiplier: number | null
  extraStamps: number | null
  extraPoints: number | null
  /** Día del negocio, 'AAAA-MM-DD'. Vacío mientras el dueño no lo elige. */
  startDate: string
  endDate: string | null
  /** 0 = domingo. Vacío = todos los días. */
  daysOfWeek: number[]
  timeFrom: string | null
  timeUntil: string | null
  productNames: string[]
  categoryNames: string[]
  /** Pesos. */
  minSpend: number | null
  limit: LoyaltyPromotionLimit
  /** Hoy en el negocio. Sólo el diálogo lo manda: una promo que empieza hoy arranca en el instante en que se guarda. */
  hoy?: string
}

/** Lo que el negocio tiene prendido: la frase sólo habla de eso. */
export interface ProgramaPrendido {
  sellos: boolean
  puntos: boolean
}

const P = 'promotions.preview.'
const LUNES_PRIMERO = [1, 2, 3, 4, 5, 6, 0]
const NOMBRES_VISIBLES = 3
// es-MX en los dos idiomas: el monto es en pesos y «$1,500.00» se lee igual en inglés.
const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function unir(items: string[], conjuncion: string): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} ${conjuncion} ${items[items.length - 1]}`
}

/** 'AAAA-MM-DD' como día de calendario: sin `new Date()`, que lo movería a la zona del navegador. */
function dia(iso: string | null): { d: number; m: number; y: number } | null {
  const r = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null
  return r ? { y: Number(r[1]), m: Number(r[2]) - 1, d: Number(r[3]) } : null
}

function cuando(p: PromoParaDescribir, t: TFunction): string {
  const ini = dia(p.startDate)
  if (!ini) return ''
  const meses = t(`${P}months`, { returnObjects: true }) as unknown as string[]
  const fecha = (f: { d: number; m: number; y: number }, conAnio: boolean) =>
    t(`${P}${conAnio ? 'dateYear' : 'date'}`, { d: f.d, month: meses[f.m], y: f.y })
  const fin = dia(p.endDate)
  if (p.hoy && p.startDate === p.hoy) {
    if (!fin) return t(`${P}fromNow`)
    return p.endDate === p.startDate ? t(`${P}fromNowToday`) : t(`${P}fromNowUntil`, { date: fecha(fin, fin.y !== ini.y) })
  }
  if (!fin) return t(`${P}since`, { date: fecha(ini, false) })
  if (fin.y === ini.y && fin.m === ini.m) {
    if (fin.d === ini.d) return t(`${P}oneDay`, { date: fecha(ini, false) })
    return t(`${P}sameMonth`, { d1: ini.d, d2: fin.d, month: meses[ini.m] })
  }
  const conAnio = fin.y !== ini.y
  return t(`${P}range`, { from: fecha(ini, conAnio), to: fecha(fin, conAnio) })
}

function horario(p: PromoParaDescribir, t: TFunction): string {
  const partes: string[] = []
  const dias = LUNES_PRIMERO.filter(d => p.daysOfWeek.includes(d))
  if (dias.length > 0 && dias.length < 7) {
    const nombres = t(`${P}days`, { returnObjects: true }) as unknown as string[]
    partes.push(
      t(`${P}onDays`, {
        days: unir(
          dias.map(d => nombres[d]),
          t(`${P}and`),
        ),
      }),
    )
  }
  if (p.timeFrom && p.timeUntil) partes.push(t(`${P}hours`, { from: p.timeFrom, until: p.timeUntil }))
  return partes.join(' ')
}

function nombres(lista: string[], t: TFunction): string {
  const visibles =
    lista.length > NOMBRES_VISIBLES + 1
      ? [...lista.slice(0, NOMBRES_VISIBLES), t(`${P}others`, { count: lista.length - NOMBRES_VISIBLES })]
      : lista
  return unir(visibles, t(`${P}or`))
}

function queDa(p: PromoParaDescribir, programa: ProgramaPrendido, conFiltro: boolean, t: TFunction): string | null {
  const partes: string[] = []
  if (p.kind === 'MULTIPLY') {
    const m = p.multiplier
    if (!m || m < 2) return null
    if (programa.sellos) partes.push(t(`${P}stamps`, { count: m }))
    if (programa.puntos) {
      const puntos = m === 2 ? t(`${P}pointsDouble`) : m === 3 ? t(`${P}pointsTriple`) : t(`${P}pointsTimes`, { count: m })
      // Regla 4: con productos o categorías, sólo se multiplica la parte de la venta que califica.
      partes.push(conFiltro ? t(`${P}pointsScoped`, { points: puntos }) : puntos)
    }
  } else {
    if (programa.sellos && p.extraStamps) partes.push(t(`${P}stamps`, { count: 1 + p.extraStamps }))
    if (programa.puntos && p.extraPoints) partes.push(t(`${P}extraPoints`, { count: p.extraPoints }))
  }
  return partes.length > 0 ? unir(partes, t(`${P}and`)) : null
}

/**
 * La promo en una frase que el dueño entiende: «Del 13 al 17 de nov., cada visita da 2 sellos en vez de 1 y el doble de puntos.»
 * Sólo menciona sellos si el negocio da sellos y puntos si da puntos; si lo que configuró no toca nada de eso, lo dice.
 */
export function describirPromo(p: PromoParaDescribir, programa: ProgramaPrendido, t: TFunction): string {
  const conFiltro = p.productNames.length > 0 || p.categoryNames.length > 0
  const sujeto = [
    t(`${P}visit`),
    p.minSpend ? t(`${P}minSpend`, { amount: pesos.format(p.minSpend) }) : '',
    p.productNames.length > 0
      ? t(`${P}products`, { names: nombres(p.productNames, t) })
      : p.categoryNames.length > 0
        ? t(`${P}categories`, { names: nombres(p.categoryNames, t) })
        : '',
  ]
    .filter(Boolean)
    .join(' ')
  const que = queDa(p, programa, conFiltro, t)
  const predicado = que ? t(`${P}gives`, { what: que }) : t(`${P}nothing`)
  const frase = [cuando(p, t), horario(p, t), `${sujeto} ${predicado}`].filter(Boolean).join(', ')
  const limite = p.limit === 'NONE' ? '' : ` ${t(`${P}limit${p.limit}`)}`
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.${limite}`
}
