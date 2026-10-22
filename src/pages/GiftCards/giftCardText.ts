/**
 * Tarjetas de regalo — funciones puras del panel (sin React; el idioma sólo se lee de i18next en `esIdiomaEspanol`): qué se enseña de
 * una tarjeta, el signo de cada renglón de la libreta, cómo se leen los montos tecleados, las validaciones de los formularios y qué
 * acciones aplican.
 * El server vuelve a decidir todo; aquí sólo se evita mandar lo que de seguro rechaza y se explica antes. Leen los tipos de
 * C4 TAL CUAL (F3): lo poco que el server no manda («vencida») se calcula aquí, con su prueba.
 */
import i18next from 'i18next'
import { z } from 'zod'
import { conSigno } from '@/pages/StaffPay/conSigno'
import type {
  GiftCardActivityType,
  GiftCardDelivery,
  GiftCardDeliveryErrorCode,
  GiftCardDetail,
  GiftCardListStatus,
  GiftCardNotSellableReason,
  GiftCardReason,
  GiftCardRow,
  GiftCardSettingsView,
  GiftCardValidityMonths,
  UpdateGiftCardSettingsInput,
} from '@/types/giftCard'

/** Tope legal por tarjeta (spec §6, contrato «Topes»): ningún saldo pasa de aquí. El server lo hace cumplir; aquí sólo se avisa. */
export const TOPE_POR_TARJETA = 10_000
/** Monto mínimo de una tarjeta (contrato «Topes», `MINIMO_POR_SOBRE` del server). */
export const MINIMO_POR_SOBRE = 100
/** Tope de la nota de una acción del gerente: el del zod del server (`giftCard.schema.ts`, ya recortada); su 400 no trae `code`. */
export const NOTA_MAXIMA = 500

const centavos = (n: number) => Math.round(n * 100)

/** «•••• 1234»: lo único del código que el panel enseña (spec §4.1). */
export const ultimos4 = (last4: string): string => `•••• ${last4}`

/**
 * Una tarjeta activa con la fecha ya pasada se le enseña a la persona como «Vencida». C4 no manda la bandera: se calcula con
 * `status` y `expiresAt` (la misma regla del filtro `EXPIRED` del server: ACTIVE con `expiresAt` ya pasado).
 */
export function estadoVisible(card: Pick<GiftCardRow, 'status' | 'expiresAt'>, ahora: Date = new Date()): GiftCardListStatus {
  const vencida = card.status === 'ACTIVE' && card.expiresAt != null && new Date(card.expiresAt).getTime() <= ahora.getTime()
  return vencida ? 'EXPIRED' : card.status
}

/** Variante del distintivo por estado (tokens del tema, nunca colores fijos). */
export function varianteDeEstado(s: GiftCardListStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'ACTIVE') return 'default'
  if (s === 'BLOCKED') return 'destructive'
  if (s === 'DEACTIVATED') return 'secondary'
  return 'outline'
}

/** +1 suma al saldo, −1 resta, 0 no mueve dinero. El server manda `amount` siempre positivo (contrato A1). */
export function signoDe(type: GiftCardActivityType): 1 | -1 | 0 {
  switch (type) {
    case 'ACTIVATE':
    case 'REDEEM_REVERSAL':
    case 'ADJUST_INCREMENT':
      return 1
    case 'REDEEM':
    case 'ADJUST_DECREMENT':
    case 'DEACTIVATE':
      return -1
    default:
      return 0
  }
}

/** El monto de un renglón con su signo a la vista («+$500.00», «−$120.00») o «—» si no mueve dinero. */
export function montoDelMovimiento(type: GiftCardActivityType, amount: number): string {
  const signo = signoDe(type)
  if (signo === 0 || !Number.isFinite(amount) || amount === 0) return '—'
  return conSigno(signo * amount)
}

/**
 * El texto del server para un aviso, SÓLO si su respuesta trae `code` (nota 10 del coordinador): los errores de tarjetas
 * (y el candado de plan, reescrito con `GIFT_CARDS_NOT_IN_PLAN`) llegan en español con su código. Sin `code` —los 401/500 de
 * `checkFeatureAccess` en inglés, un 502 en HTML, la red caída— devuelve `undefined` y la pantalla pone su texto genérico
 * (`errors.generic` o el de su sección): nunca el `message` crudo.
 * Lee SÓLO `message` (r1, I1): el candado de plan manda también `error` y ahí va el CÓDIGO, no un texto. Con `code` y sin
 * `message`, también `undefined`.
 */
export function textoDelServidorConCodigo(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { code?: unknown; message?: unknown } } } | null)?.response?.data
  if (typeof data?.code !== 'string' || data.code === '') return undefined
  return typeof data.message === 'string' && data.message.trim() !== '' ? data.message : undefined
}

/**
 * ¿El panel está en español? Lee el singleton que inicializa `src/i18n.ts`. Sin i18n inicializado (las pruebas que simulan
 * `react-i18next`) `language` es `undefined` y se toma como español: así lo que ya se probaba con el texto del server no cambia.
 */
export const esIdiomaEspanol = (): boolean => !i18next.language || i18next.language.startsWith('es')

/**
 * El texto de un error del server en el idioma del panel. El server escribe sus avisos en español y manda su `code` estable:
 * en español se enseña el texto del server (`textoDelServidorConCodigo`); en otro idioma, `serverCodes.<code>` del namespace
 * `giftCards` si existe (se pregunta a i18next: una llave que falta nunca sale cruda) y, si no, el texto del server.
 * `t` es el de `useTranslation('giftCards')`. `undefined` en los mismos casos que `textoDelServidorConCodigo`, salvo que con la
 * traducción por `code` no hace falta que el server mande `message`.
 */
export function textoDelServidorEnIdioma(err: unknown, t: (clave: string) => string): string | undefined {
  const delServidor = textoDelServidorConCodigo(err)
  if (esIdiomaEspanol()) return delServidor
  const code = (err as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  if (typeof code === 'string' && code !== '' && i18next.exists(`giftCards:serverCodes.${code}`)) return t(`serverCodes.${code}`)
  return delServidor
}

/**
 * El texto de un error en las pantallas de tarjetas (full-testing v2 #2): el del server si trae `code` (traducido por su `code` si el
 * panel no está en español, Task 5); un 403 SIN `code` (los de permisos, `checkPermission`/`verifyAccess`, en inglés) dice que falta
 * permiso; lo demás, el respaldo de la pantalla. `t` es el de `useTranslation('giftCards')`. Es el único punto por el que pasan las
 * pantallas: el idioma se resuelve aquí, no en cada una.
 */
export function avisoDeError(err: unknown, t: (clave: string) => string, respaldo = 'errors.generic'): string {
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status
  return textoDelServidorEnIdioma(err, t) ?? t(status === 403 && !tieneCodigo(err) ? 'errors.forbidden' : respaldo)
}

function tieneCodigo(err: unknown): boolean {
  const code = (err as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' && code !== ''
}

/**
 * Lee un monto tecleado: «150», «150.5», «1,500», «1,500.50» o «$500». `null` si no es un número con hasta 2 decimales.
 * En México el punto es decimal y la coma sólo separa miles en grupos de 3 (r1, I2): «5,00», «150,50» o «1,0,0» dan `null`
 * para que la persona corrija; nunca se adivina (en un ajuste, «5,00» leído como 500 sumaría $500). Lo mismo con `$` y
 * espacios (lote ⭐): el `$` sólo al inicio y los espacios sólo en los extremos («5 00», «5$00» ⇒ `null`). «0» da 0: quien
 * llama valida que sea positivo.
 */
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/^\$\s*/, '')
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(limpio)) return null
  return Number(limpio.replace(/,/g, ''))
}

// ── Entrega (1b P1: E14, E15) ────────────────────────────────────────────

/**
 * El teléfono de «Cambiar destino», como lo manda el panel: sus 10 dígitos (contrato 1b § 8, P-2). Acepta lo que la gente
 * teclea —espacios, guiones, puntos, paréntesis y el `+52`/`52` de lada— y devuelve `null` con cualquier otra cosa (letras, 9 u
 * 11 dígitos) para que se corrija ANTES de mandar (Review Focus 3): nunca se adivina un número.
 */
export function limpiarTelefono(texto: string): string | null {
  if (/[^\d\s().+-]/.test(texto)) return null
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos.slice(2)
  return digitos.length === 10 ? digitos : null
}

/** El mismo criterio de correo que `resendSchema` del server; evita su 400 sin código. */
export const correoValido = (texto: string): boolean => z.string().trim().email().safeParse(texto).success

/** Por qué no se entregó una tarjeta (S-7 + P-1; contrato 1b § 3.4): los seis códigos que el panel traduce, en ese orden. */
export const CODIGOS_DE_FALLO_DE_ENTREGA: readonly GiftCardDeliveryErrorCode[] = [
  'TEMPLATE_NOT_AVAILABLE',
  'WHATSAPP_SEND_FAILED',
  'WHATSAPP_UNDELIVERED',
  'EMAIL_SEND_FAILED',
  'EMAIL_INVALID_ADDRESS',
  'UNCONFIRMED',
]

/**
 * El motivo del fallo de la entrega en el idioma del panel (Review Focus 4). Un código conocido se traduce en CUALQUIER idioma
 * (`deliveryErrors.<code>`); uno que el panel todavía no conoce sale con el texto del server sólo en español
 * (`deliveryInfo.failed`); en otro idioma, o sin texto, el genérico. Nunca el español crudo con el panel en inglés.
 */
export function errorDeEntrega(
  e: Pick<GiftCardDelivery, 'error' | 'errorCode'>,
  t: (clave: string, opciones?: Record<string, unknown>) => string,
): string {
  if (e.errorCode && (CODIGOS_DE_FALLO_DE_ENTREGA as readonly string[]).includes(e.errorCode)) return t(`deliveryErrors.${e.errorCode}`)
  if (esIdiomaEspanol() && e.error) return t('deliveryInfo.failed', { error: e.error })
  return t('deliveryInfo.failedGeneric')
}

/** Motivos que el gerente puede escoger en cada acción: la lista cerrada del server, sólo los que tienen sentido aquí. */
export const MOTIVOS_POR_ACCION = {
  AJUSTE: ['CASHIER_ERROR', 'CUSTOMER_REQUEST', 'SUSPICIOUS_ACTIVITY', 'OTHER'],
  BLOQUEAR: ['SUSPICIOUS_ACTIVITY', 'LOST_CARD', 'CHARGEBACK', 'CUSTOMER_REQUEST', 'OTHER'],
  DESBLOQUEAR: ['CUSTOMER_REQUEST', 'CASHIER_ERROR', 'OTHER'],
} as const satisfies Record<string, readonly GiftCardReason[]>
export type AccionConMotivo = keyof typeof MOTIVOS_POR_ACCION

/** Un error que la pantalla traduce: la llave dentro de `giftCards` y, si hace falta, montos en pesos. */
export type ErrorDeFormulario = { key: string; amount?: number; min?: number; max?: number }

export function validarAjuste(p: {
  direccion: 'INCREMENT' | 'DECREMENT'
  cantidad: number | null
  saldo: number
  motivo: GiftCardReason | ''
  nota: string
}): ErrorDeFormulario | null {
  if (p.cantidad == null || centavos(p.cantidad) <= 0) return { key: 'actions.adjust.errors.amount' }
  if (p.direccion === 'DECREMENT' && centavos(p.cantidad) > centavos(p.saldo))
    return { key: 'actions.adjust.errors.moreThanBalance', amount: p.saldo }
  if (p.direccion === 'INCREMENT' && centavos(p.saldo) + centavos(p.cantidad) > centavos(TOPE_POR_TARJETA))
    return { key: 'actions.adjust.errors.overCap', amount: TOPE_POR_TARJETA }
  if (!p.motivo) return { key: 'actions.errors.reason' }
  if (p.nota.trim().length < 5) return { key: 'actions.adjust.errors.note' }
  if (p.nota.trim().length > NOTA_MAXIMA) return { key: 'actions.errors.noteTooLong' }
  return null
}

/** Bloquear y desbloquear: motivo obligatorio; nota sólo con «Otro motivo»; nunca más de NOTA_MAXIMA. */
export function validarMotivoYNota(p: { motivo: GiftCardReason | ''; nota: string }): ErrorDeFormulario | null {
  if (!p.motivo) return { key: 'actions.errors.reason' }
  if (p.motivo === 'OTHER' && p.nota.trim().length < 5) return { key: 'actions.errors.noteForOther' }
  if (p.nota.trim().length > NOTA_MAXIMA) return { key: 'actions.errors.noteTooLong' }
  return null
}

/**
 * Por qué HOY no se venden tarjetas nuevas (o `null` si sí se venden). Lo vendido siempre se cobra: esto sólo explica la
 * venta. El plan se toma COMPROBADO (`resolved`): con el plan sin comprobar no se adivina «sin plan».
 */
export function motivoSinVenta(
  s: Pick<GiftCardSettingsView, 'enabled' | 'llavesConfiguradas'>,
  plan: { resolved: boolean; hasAccess: boolean },
): GiftCardNotSellableReason | null {
  if (!s.enabled) return 'DISABLED'
  if (!s.llavesConfiguradas) return 'KEYS_MISSING'
  if (plan.resolved && !plan.hasAccess) return 'NOT_IN_PLAN'
  return null
}

/**
 * Qué acciones de gerente aplican a una tarjeta según su estado y su venta (el server vuelve a decidir al recibirlas).
 * 🔴 Auditoría r1 (D-2): la cancelación se protege con `cancel.reason === 'IN_PROGRESS'` y el motivo vigente sale de
 * `currentBlock` (una consulta propia del server), NUNCA de la libreta paginada.
 */
export function accionesDisponibles(d: Pick<GiftCardDetail, 'status' | 'canReplaceCode' | 'cancel' | 'currentBlock' | 'order'>) {
  const ventaEnCancelacion = d.cancel.reason === 'IN_PROGRESS'
  const enCancelacion = ventaEnCancelacion || d.currentBlock?.reason === 'CANCEL_IN_PROGRESS'
  return {
    ajustar: (d.status === 'ACTIVE' || d.status === 'BLOCKED') && !enCancelacion,
    bloquear: d.status === 'ACTIVE',
    desbloquear: d.status === 'BLOCKED' && !enCancelacion,
    reponer: d.canReplaceCode && d.status !== 'DEACTIVATED' && !enCancelacion,
    // Lo decide el server con el mismo predicado que la cancelación (B2): el panel no lo deduce.
    cancelarVenta: d.order != null && d.cancel.allowed === true,
    ventaEnCancelacion,
  }
}

/**
 * La «foto» de la cancelación de la venta en el detalle (D4 r1, I1.3): va en la huella de cancelar/liberar. Si cambia, una
 * llave pendiente de esa venta ya no aplica. Lleva `activities.total` porque la libreta SÓLO crece: cancelar escribe un BLOCK
 * y liberar un UNBLOCK en cada tarjeta, así que «cancelada → liberada» no vuelve a la foto de antes (sin ABA).
 */
export const estadoDeCancelacion = (d: Pick<GiftCardDetail, 'cancel' | 'activities'>): string =>
  JSON.stringify([d.cancel.allowed, d.cancel.reason, d.activities.total])

// ── Reglas de venta (Configuración) ──────────────────────────────────────

export type VigenciaElegida = 'none' | '12' | '24' | '36' | '60'
export const VIGENCIAS: readonly VigenciaElegida[] = ['none', '12', '24', '36', '60']
export interface BorradorDeReglas {
  sugeridos: [string, string, string]
  minimo: string
  maximo: string
  vigencia: VigenciaElegida
}
export type ReglasValidas = Required<Pick<UpdateGiftCardSettingsInput, 'suggestedAmounts' | 'minAmount' | 'maxAmount' | 'validityMonths'>>

const aTexto = (p: number | undefined): string => (p == null ? '' : String(p))

/** El borrador del formulario a partir de lo guardado (hasta 3 montos sugeridos; los huecos, vacíos). */
export function borradorDesde(s: GiftCardSettingsView): BorradorDeReglas {
  const sug = s.suggestedAmounts.slice(0, 3).map(aTexto)
  while (sug.length < 3) sug.push('')
  return {
    sugeridos: [sug[0], sug[1], sug[2]],
    minimo: aTexto(s.minAmount),
    maximo: aTexto(s.maxAmount),
    vigencia: s.validityMonths == null ? 'none' : (String(s.validityMonths) as VigenciaElegida),
  }
}

/** Mismas reglas que el server (A5, que es quien manda): piso, techo, mínimo ≤ máximo, sugeridos dentro del rango. */
export function validarReglas(b: BorradorDeReglas): { ok: true; input: ReglasValidas } | { ok: false; error: ErrorDeFormulario } {
  const piso = MINIMO_POR_SOBRE
  const techo = TOPE_POR_TARJETA
  const min = leerMonto(b.minimo)
  if (min == null) return { ok: false, error: { key: 'settings.rules.errors.minInvalid' } }
  const max = leerMonto(b.maximo)
  if (max == null) return { ok: false, error: { key: 'settings.rules.errors.maxInvalid' } }
  if (centavos(min) < centavos(piso)) return { ok: false, error: { key: 'settings.rules.errors.minTooLow', amount: piso } }
  if (centavos(max) > centavos(techo)) return { ok: false, error: { key: 'settings.rules.errors.maxTooHigh', amount: techo } }
  if (centavos(min) > centavos(max)) return { ok: false, error: { key: 'settings.rules.errors.minAboveMax' } }
  const escritos = b.sugeridos.map(s => s.trim()).filter(s => s !== '')
  if (escritos.length === 0) return { ok: false, error: { key: 'settings.rules.errors.suggestedRequired' } }
  const montos = escritos.map(leerMonto)
  if (montos.some(m => m == null)) return { ok: false, error: { key: 'settings.rules.errors.suggestedInvalid' } }
  const validos = montos as number[]
  if (validos.some(m => centavos(m) < centavos(min) || centavos(m) > centavos(max)))
    return { ok: false, error: { key: 'settings.rules.errors.suggestedOutOfRange', min, max } }
  const unicos = [...new Set(validos.map(centavos))].sort((a, b) => a - b).map(c => c / 100)
  return {
    ok: true,
    input: {
      suggestedAmounts: unicos,
      minAmount: min,
      maxAmount: max,
      validityMonths: b.vigencia === 'none' ? null : (Number(b.vigencia) as GiftCardValidityMonths),
    },
  }
}
