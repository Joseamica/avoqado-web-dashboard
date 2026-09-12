/**
 * Espejo del saneado del servidor (`avoqado-server/src/services/shared/receiptLayout/sanitizeText.ts`).
 *
 * Aquí NO es una defensa de seguridad —el servidor rechaza igual, y es él quien manda—: es para
 * poder marcar el carácter EN EL CAMPO antes de guardar (spec § 8). Sin esto, el dueño escribe un
 * emoji, toca «Guardar» y recibe un 400 que no le dice en qué renglón está el problema. Es el
 * mismo defecto que ya se cazó en este repo: un formulario que se deja llenar entero para
 * estrellarse contra el backend.
 *
 * 🔴 Las clases de control se escriben SIEMPRE como escapes `\uXXXX`, nunca como bytes crudos:
 * un carácter invisible aquí es indistinguible a la vista y cualquier normalización del archivo
 * lo borraría en silencio, dejando el aviso sin funcionar.
 */
/* eslint-disable no-control-regex -- este módulo EXISTE para cazar caracteres de control */

export type MotivoNoImprimible = 'control' | 'bidi' | 'zeroWidth' | 'nonLatin1'

export interface TextoRevisado {
  ok: boolean
  motivo?: MotivoNoImprimible
  /** El carácter exacto que el papel no puede imprimir, para nombrarlo en el aviso. */
  offending?: string
}

const CONTROL = /[\u0000-\u001F\u007F-\u009F]/u
const BIDI = /[\u202A-\u202E\u2066-\u2069]/u
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/u
/** Todo lo que NO sea Latin-1 imprimible: U+0020-007E y U+00A0-00FF. El papel no tiene más. */
const NON_LATIN1 = /[^ -~\u00A0-ÿ]/u

/** Lo que el papel admite por renglón. El servidor rechaza en 49 (MAX_TEXT_CHARS = 48). */
export const MAX_CARACTERES = 48
/** Renglones por bloque de texto (MAX_TEXT_LINES del servidor). */
export const MAX_RENGLONES = 6

export function revisarTexto(raw: string): TextoRevisado {
  const texto = raw.normalize('NFC')
  const control = CONTROL.exec(texto)
  if (control) return { ok: false, motivo: 'control', offending: control[0] }
  const bidi = BIDI.exec(texto)
  if (bidi) return { ok: false, motivo: 'bidi', offending: bidi[0] }
  const zero = ZERO_WIDTH.exec(texto)
  if (zero) return { ok: false, motivo: 'zeroWidth', offending: zero[0] }
  const ajeno = NON_LATIN1.exec(texto)
  if (ajeno) return { ok: false, motivo: 'nonLatin1', offending: ajeno[0] }
  return { ok: true }
}
