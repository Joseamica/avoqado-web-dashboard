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
