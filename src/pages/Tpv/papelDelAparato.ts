/**
 * Aparatos claros, Paso 1 (8-nov-2026): qué papel tiene un aparato en un negocio con vales por área, para el letrero de arriba
 * de su ficha: «Emite vales de <área>» o «Cobra».
 *
 * Emite sólo con lo mismo que exige ANDROID para abrir la pantalla de vales (`issueWorkspace`): vales prendidos, «Emitir vales»,
 * área ACTIVA y pantalla de vales (`AREA_OPERATIONS`). Con «Emitir» prendido pero sin una de esas, el POS cobra normal: se dice
 * «Cobra» y por qué (Codex r1 #2). Con «Emitir» y «Cobrar» a la vez sólo emite (D5, 2-nov), así que tampoco cobra.
 * Con los vales apagados o un SERVIDOR que no manda `areaTicketsEnabled`: `null` (la ficha se ve como hoy).
 */
export interface AreaDeLaFicha {
  id: string
  name: string
  sendsComanda: boolean
  active: boolean
  /** «Preparar después de pagar» no saca comanda al emitir (ANDROID `AreaComandaPolicy`): la ficha no la promete. */
  fulfillmentMode?: string
}

export type EmitirSinEfecto = 'sinArea' | 'areaApagada' | 'sinPantallaDeVales'

export type PapelDelAparato = {
  tipo: 'emite' | 'cobra'
  area: AreaDeLaFicha | null
  noCobra: boolean
  emitirSinEfecto: EmitirSinEfecto | null
}

export function papelDelAparato(t: {
  canIssueAreaTickets?: boolean
  canCheckoutAreaTickets?: boolean
  defaultWorkspace?: string
  areaTicketsEnabled?: boolean
  fulfillmentArea?: AreaDeLaFicha | null
}): PapelDelAparato | null {
  if (t.areaTicketsEnabled !== true) return null
  const cobra = (emitirSinEfecto: EmitirSinEfecto | null): PapelDelAparato => ({ tipo: 'cobra', area: null, noCobra: false, emitirSinEfecto })
  if (!t.canIssueAreaTickets) return cobra(null)
  if (!t.fulfillmentArea) return cobra('sinArea')
  if (!t.fulfillmentArea.active) return cobra('areaApagada')
  if (t.defaultWorkspace !== 'AREA_OPERATIONS') return cobra('sinPantallaDeVales')
  return { tipo: 'emite', area: t.fulfillmentArea, noCobra: true, emitirSinEfecto: null }
}

/** Aparatos claros, Paso 2: texto corto del papel para la lista. Gana la primera regla que aplica. */
export type PapelCorto = {
  clave: 'terminalDeCobro' | 'puntoDeVenta' | 'emite' | 'cobraVales' | 'entregaVales' | 'sinElegir'
  area?: string
  aviso: EmitirSinEfecto | null
}

export function papelCorto(
  d: {
    type: string
    canIssueAreaTickets?: boolean
    canCheckoutAreaTickets?: boolean
    canDeliverAreaTickets?: boolean
    defaultWorkspace?: string
    fulfillmentArea?: AreaDeLaFicha | null
  },
  areaTicketsEnabled: boolean | undefined,
): PapelCorto {
  if (d.type === 'TPV_ANDROID' || d.type === 'TPV_IOS') return { clave: 'terminalDeCobro', aviso: null }
  if (areaTicketsEnabled !== true) return { clave: 'puntoDeVenta', aviso: null }
  const papel = papelDelAparato({ ...d, areaTicketsEnabled })
  if (papel?.tipo === 'emite') return { clave: 'emite', area: papel.area?.name, aviso: null }
  if (d.canIssueAreaTickets) return { clave: 'puntoDeVenta', aviso: papel?.emitirSinEfecto ?? null }
  if (d.canCheckoutAreaTickets) return { clave: 'cobraVales', aviso: null }
  if (d.canDeliverAreaTickets) {
    if (!d.fulfillmentArea) return { clave: 'sinElegir', aviso: 'sinArea' }
    if (!d.fulfillmentArea.active) return { clave: 'sinElegir', aviso: 'areaApagada' }
    return { clave: 'entregaVales', area: d.fulfillmentArea.name, aviso: null }
  }
  return { clave: 'sinElegir', aviso: null }
}

/** `true` sólo si el nombre es el que puso el SERVIDOR al registrar el aparato (`deviceRegistry.service.ts:97-103`). */
export function esNombreDeFabrica(d: { name: string; model?: string | null; selfRegistered?: boolean }): boolean {
  if (!d.selfRegistered || !d.model) return false
  const m = d.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${m}( \\(\\d+\\))?$`).test(d.name)
}

const TIPOS_POS = ['POS_ANDROID', 'POS_IOS', 'POS_DESKTOP']

export function necesitaConfigurar(
  d: { type: string; selfRegistered?: boolean; areaRoleChosenAt?: string | null },
  vales: { enabled: boolean; activeAreaCount: number } | undefined,
): boolean {
  return !!vales?.enabled && vales.activeAreaCount >= 1 && TIPOS_POS.includes(d.type) && d.selfRegistered === true && !d.areaRoleChosenAt
}
