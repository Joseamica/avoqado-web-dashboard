import type { TFunction } from 'i18next'
import { textoDelServidor } from '@/utils/apiError'

type Resp = { response?: { status?: number; data?: unknown } }
const cuerpo = (err: unknown) => {
  const d = (err as Resp | null)?.response?.data
  return d && typeof d === 'object' ? (d as Record<string, unknown>) : undefined
}

/** El candado de plan responde 403 en INGLÉS y sin `code` (contrato §0): se reconoce por `featureCode`. Incluye vencido/suspendido. */
export function esCandadoDeVariantes(err: unknown): boolean {
  return (err as Resp | null)?.response?.status === 403 && cuerpo(err)?.featureCode === 'PRODUCT_VARIANTS'
}

export function codigoDelError(err: unknown): string | undefined {
  const c = cuerpo(err)?.code
  return typeof c === 'string' ? c : undefined
}

/** El texto para un toast, siempre en el idioma del usuario: nunca el `message` de axios ni el inglés de un 403. */
export function mensajeDeVariantes(err: unknown, t: TFunction): string {
  const r = (err as Resp | null)?.response
  if (esCandadoDeVariantes(err)) return t('variants:errors.planRequired')
  if (r?.status === 403) return t('variants:errors.noPermission')
  if (!r) return t('variants:errors.network')
  return textoDelServidor(err) ?? t('variants:errors.generic')
}
