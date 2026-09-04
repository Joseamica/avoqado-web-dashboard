/**
 * Lógica de presentación de la bitácora de actividad.
 *
 * Vive aparte del componente porque son decisiones que se prueban sin montar
 * React: qué identificador se puede leer, qué dato se oculta, cómo se corta
 * la lista por días.
 */

// ── Identificadores ───────────────────────────────────────────────────────────

const CUID_RE = /^c[a-z0-9]{20,32}$/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * ¿Es un identificador interno que a una persona no le dice nada?
 *
 * 🔴 Importa porque `entityId` NO siempre es un id: `PERMISSION_DENIED` guarda
 * ahí el NOMBRE del permiso (`settlements:read`). Cortar eso a 8 caracteres
 * producía "#settleme" — el defecto que se ve en la pantalla de producción.
 */
export function isOpaqueId(value: string): boolean {
  return CUID_RE.test(value) || UUID_RE.test(value)
}

export interface FormattedEntityId {
  text: string
  /** true ⇒ hay que ofrecer el valor completo (tooltip / copiar) */
  truncated: boolean
}

export function formatEntityId(entityId: string | null | undefined): FormattedEntityId | null {
  const value = entityId?.trim()
  if (!value) return null
  if (isOpaqueId(value)) return { text: `${value.slice(0, 8)}…`, truncated: true }
  return { text: value, truncated: false }
}

// ── Redacción (defensa en profundidad) ────────────────────────────────────────

const SENSITIVE_KEY_RE =
  /pass(word)?|secret|token|api[-_]?key|authorization|auth|cvv|clabe|\bpan\b|card[-_]?number|account[-_]?number|private[-_]?key/i

export const REDACTED = '••• redacted'

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => (SENSITIVE_KEY_RE.test(k) ? [k, REDACTED] : [k, redactSensitive(v)])),
    )
  }
  return value
}

// ── Detalle expandido ─────────────────────────────────────────────────────────

/** Palabras que dependen del idioma; se inyectan para no acoplar el módulo a i18next. */
export type WordFn = (word: 'yes' | 'no' | 'empty') => string

export function formatDetailValue(value: unknown, word: WordFn): string {
  if (value === null || value === undefined || value === '') return word('empty')
  if (typeof value === 'boolean') return value ? word('yes') : word('no')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export interface DetailRow {
  key: string
  label: string
  value: string
}

/**
 * Convierte el `data` crudo en pares legibles.
 *
 * El JSON crudo en inglés dentro de una pantalla en español era la mitad del
 * problema: `{"hasPermissionSet": false}` no se lee, "Tiene conjunto de
 * permisos · No" sí.
 */
export function toDetailRows(data: unknown, labelOf: (key: string) => string | null, word: WordFn): DetailRow[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  const safe = redactSensitive(data) as Record<string, unknown>
  return Object.entries(safe).map(([key, value]) => ({
    key,
    // Sin traducción se muestra el nombre crudo del campo, nunca la clave i18n
    // ("detailKeys.loQueSea"). Quién decide eso es el llamador, que es el único
    // que sabe bajo qué prefijo vive la clave.
    label: labelOf(key) ?? key,
    value: formatDetailValue(value, word),
  }))
}

// ── Agrupación por día ────────────────────────────────────────────────────────

export interface DayGroup<T> {
  day: string
  logs: T[]
}

/**
 * Corta la lista en días conservando el orden que trae el servidor.
 *
 * `dayKeyOf` llega desde fuera porque el día se calcula en la zona del NEGOCIO,
 * nunca en la del navegador (regla de timezone del repo).
 */
export function groupByDay<T extends { createdAt: string }>(logs: T[], dayKeyOf: (createdAt: string) => string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const log of logs) {
    const day = dayKeyOf(log.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.logs.push(log)
    else groups.push({ day, logs: [log] })
  }
  return groups
}

// ── Tono de la acción ─────────────────────────────────────────────────────────

export type ActionTone = 'destructive' | 'positive' | 'attention' | 'neutral'

/**
 * Clasifica una acción por FAMILIA, no por lista exacta.
 *
 * 🔴 El servidor emite más de 500 códigos y crecen cada semana: un mapa uno a
 * uno se queda atrás en silencio y la acción nueva sale sin color. Se mira el
 * sufijo/prefijo, que es donde vive el significado.
 *
 * El orden importa — se evalúa de más grave a menos:
 * negado/fallido ▸ destructivo ▸ requiere atención ▸ positivo ▸ neutro.
 */
export function actionTone(action: string): ActionTone {
  const a = action.toUpperCase()

  // Nada que se haya negado, rechazado o roto puede pintarse de verde.
  if (/(DENIED|REJECTED|FAILED|LOCKED|INSUFFICIENT|MISMATCH|CORRUPT|ABANDONED|INCOMPLETE|NOT_CHARGED)/.test(a)) {
    return 'destructive'
  }
  if (/(DELETED|REMOVED|CANCELLED|CANCELED|DISABLED|DEACTIVATED|REVOKED|DISPOSED|RETIRED|EXPIRED|DECLINED)/.test(a)) {
    return 'destructive'
  }
  // Lo que un dueño audita: dinero perdonado, anulado, revertido o autorizado
  // por encima de las reglas normales.
  if (/(COMPED|VOIDED|OVERRIDE|REVERSED|REVERSAL|CLAWBACK|REFUND|DISCREPANC|VARIANCE|WENT_NEGATIVE|OVERPAY|SOBREPAGO|SUSPENDED|QUARANTINED)/.test(a)) {
    return 'attention'
  }
  if (/(CREATED|ADDED|ISSUED|APPROVED|CONFIRMED|COMPLETED|ACTIVATED|ENABLED|GRANTED|PUBLISHED|RECEIVED|ACCEPTED|REACTIVATED|UNLOCKED|GENERATED)/.test(a)) {
    return 'positive'
  }
  return 'neutral'
}

/** Fallback legible para acciones históricas o nuevas sin llave i18n. */
export function formatActionFallback(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase())
}

// ── Filtro de fecha (pill de Stripe) → rango que entiende el servidor ─────────

export interface DateFilterLike {
  operator: 'last' | 'before' | 'after' | 'between' | 'on'
  value: number | string | null
  value2?: string | null
  unit?: 'hours' | 'days' | 'weeks' | 'months'
}

export interface DateRange {
  startDate?: string
  endDate?: string
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * `now` entra como parámetro para que el resultado sea comprobable: una función
 * que lee el reloj por dentro no se puede probar sin congelar el tiempo.
 */
export function dateFilterToRange(filter: DateFilterLike | null | undefined, now: Date = new Date()): DateRange {
  if (!filter) return {}
  const { operator, value, value2, unit } = filter

  if (operator === 'on') return value ? { startDate: String(value), endDate: String(value) } : {}
  if (operator === 'between') return value && value2 ? { startDate: String(value), endDate: String(value2) } : {}
  if (operator === 'before') return value ? { endDate: String(value) } : {}
  if (operator === 'after') return value ? { startDate: String(value) } : {}

  if (operator === 'last') {
    const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(n) || n <= 0) return {}
    const start = new Date(now)
    switch (unit) {
      case 'hours':
        start.setHours(start.getHours() - n)
        break
      case 'weeks':
        start.setDate(start.getDate() - n * 7)
        break
      case 'months':
        start.setMonth(start.getMonth() - n)
        break
      default:
        start.setDate(start.getDate() - n)
    }
    return { startDate: toDateString(start) }
  }

  return {}
}
