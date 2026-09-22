/**
 * Merma — contrato con avoqado-server (fase 1) y reglas puras.
 *
 * 🔴 Los CÓDIGOS de motivo son un espejo EXACTO de
 * avoqado-server/src/services/shared/wasteReasons.ts (WASTE_REASON_CODES). Un nombre distinto no
 * truena aquí: el servidor responde 400 «El motivo de la merma no es válido». La prueba de este
 * archivo fija la lista literal.
 */

export const WASTE_REASON_CODES = [
  'EXPIRED',
  'SPOILED',
  'CONTAMINATED',
  'DEFECTIVE',
  'OVERPRODUCTION',
  'PREP_ERROR',
  'BURNT',
  'UNDERCOOKED',
  'DROPPED',
  'CUSTOMER_RETURN',
  'WRONG_ORDER',
  'CUSTOMER_CHANGE',
  'TESTING',
  'STAFF_MEAL',
  'PROMOTION',
  'DONATION',
  'THEFT',
  'MISSING',
  'PEST_DAMAGE',
  'OTHER',
  'UNSPECIFIED',
] as const

export type WasteReasonCode = (typeof WASTE_REASON_CODES)[number]

/** Lo que una persona puede ELEGIR. `UNSPECIFIED` sólo existe para mostrar registros viejos sin motivo. */
export type SelectableWasteReasonCode = Exclude<WasteReasonCode, 'UNSPECIFIED'>

export function isWasteReasonCode(value: unknown): value is WasteReasonCode {
  return typeof value === 'string' && (WASTE_REASON_CODES as readonly string[]).includes(value)
}

/** Clave i18n (namespace `inventory`) de la etiqueta de un motivo, o null si el código no se conoce. */
export function wasteReasonLabelKey(code: string | null | undefined): string | null {
  return isWasteReasonCode(code) ? `waste.reasons.${code}.label` : null
}

/** Daño / Robo / Pérdida del editor rápido de «Resumen de existencias». */
export const SUMMARY_LOSS_ACTION_REASON = {
  DAMAGE: 'DEFECTIVE',
  THEFT: 'THEFT',
  LOSS: 'MISSING',
} as const satisfies Record<'DAMAGE' | 'THEFT' | 'LOSS', SelectableWasteReasonCode>

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Lo que el SERVIDOR hará con una merma (spec D4): descuenta lo que haya y el resto queda
 * «sin existencia»; una existencia en 0 o negativa NO se toca. Es una vista previa: la cifra que
 * manda es la de la respuesta (`waste`).
 */
export function previewAfterWaste(currentStock: number, declared: number): { newStock: number; deducted: number; unrecorded: number } {
  const stock = Number.isFinite(currentStock) ? currentStock : 0
  const wanted = Number.isFinite(declared) && declared > 0 ? declared : 0
  const deducted = Math.min(wanted, Math.max(0, stock))
  return {
    newStock: round3(stock > 0 ? stock - deducted : stock),
    deducted: round3(deducted),
    unrecorded: round3(wanted - deducted),
  }
}

export interface WasteKeyState {
  key: string
  fingerprint: string | null
}

export function newWasteKey(): string {
  return crypto.randomUUID()
}

export function initialWasteKeyState(makeKey: () => string = newWasteKey): WasteKeyState {
  return { key: makeKey(), fingerprint: null }
}

/**
 * El folio de un envío. MISMO contenido ⇒ MISMO folio: el servidor reconoce el reintento (el de la
 * persona y el que `src/api.ts` hace solo ante un error de red) y no descuenta dos veces.
 * Contenido DISTINTO ⇒ folio nuevo: con el viejo el servidor respondería 409 IDEMPOTENCY_KEY_REUSED.
 */
export function keyForSubmission(state: WasteKeyState, fingerprint: string, makeKey: () => string = newWasteKey): WasteKeyState {
  if (state.fingerprint === null || state.fingerprint === fingerprint) return { key: state.key, fingerprint }
  return { key: makeKey(), fingerprint }
}

export interface WasteFormInput {
  /** Lo que se tiró, en la unidad del artículo. Se acepta con cualquier signo: se envía negativo. */
  quantity: number
  reasonCode: SelectableWasteReasonCode
  /** Nota libre de la persona; viaja en `reason`, que el servidor guarda como la nota del folio. */
  note: string
  reference?: string
}

export interface WasteAdjustment<T extends 'SPOILAGE' | 'LOSS'> {
  type: T
  quantity: number
  reasonCode: SelectableWasteReasonCode
  idempotencyKey: string
  reason?: string
  reference?: string
}

/** Cuerpo de adjust-stock para una merma. Cantidad NEGATIVA: así el servidor la manda al libro de merma. */
export function buildWasteAdjustment<T extends 'SPOILAGE' | 'LOSS'>(
  type: T,
  input: WasteFormInput,
  idempotencyKey: string,
): WasteAdjustment<T> {
  const note = input.note.trim()
  const reference = input.reference?.trim() ?? ''
  return {
    type,
    quantity: -Math.abs(input.quantity),
    reasonCode: input.reasonCode,
    idempotencyKey,
    ...(note ? { reason: note } : {}),
    ...(reference ? { reference } : {}),
  }
}

/** Huella del CONTENIDO de una merma: decide si un envío es reintento (mismo folio) o uno nuevo. */
export function wasteFingerprint(itemId: string, input: WasteFormInput): string {
  return JSON.stringify([itemId, Math.abs(input.quantity), input.reasonCode, input.note.trim(), input.reference?.trim() ?? ''])
}

export interface WasteSummary {
  reportId: string
  declared: string
  deducted: string
  unrecorded: string
}

const asDecimalText = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : null

/** `waste` de la respuesta de adjust-stock, sólo si trae la forma completa (un servidor viejo no lo manda). */
export function readWasteSummary(body: unknown): WasteSummary | null {
  const waste = (body as { waste?: Record<string, unknown> } | null)?.waste
  if (!waste || typeof waste.reportId !== 'string') return null
  const declared = asDecimalText(waste.declared)
  const deducted = asDecimalText(waste.deducted)
  const unrecorded = asDecimalText(waste.unrecorded)
  if (declared === null || deducted === null || unrecorded === null) return null
  return { reportId: waste.reportId, declared, deducted, unrecorded }
}

/** ¿El servidor pudo haber aplicado la merma aunque la respuesta sea un error? Sin respuesta o 5xx ⇒ sí. */
export function isAmbiguousWasteFailure(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status === undefined || status >= 500
}

/** Clave i18n del texto para una merma rechazada. null ⇒ usar el mensaje del servidor. */
export function wasteErrorKey(error: unknown): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  switch (code) {
    case 'WASTE_VOIDED':
      return 'waste.errors.voided'
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'waste.errors.keyReused'
    case 'WASTE_RETRYABLE_CONFLICT':
      return 'waste.errors.retryable'
    case 'QUANTITY_TOO_LARGE':
      return 'waste.errors.tooLarge'
    default:
      return isAmbiguousWasteFailure(error) ? 'waste.errors.ambiguous' : null
  }
}

/** Cantidad para pintar: hasta 3 decimales en el formato del idioma. Vacío ⇒ «—», nunca 0. */
export function formatWasteQuantity(value: string | number | null | undefined, locale: string): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n)
}
