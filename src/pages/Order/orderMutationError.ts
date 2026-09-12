import { apiErrorDescription } from '@/utils/apiError'

/**
 * Código del server (diseño §C.6) cuando una orden tiene un cobro de terminal cuyo desenlace no está acreditado: ni el
 * DELETE ni el PUT a CANCELLED/DELETED la cancelan hasta que ese cobro termine. Mismo código que el POS ya conoce.
 */
export const ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE = 'ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE'

/**
 * Texto del toast de error al borrar o editar una orden. Antes usaba `error.message`, que en axios es el genérico
 * «Request failed with status code 409»: el motivo real del server nunca se veía. Ahora: un texto propio y traducido
 * para el cobro de terminal en curso, y el mensaje del server (`apiErrorDescription`) para todo lo demás.
 */
export function describeOrderMutationError(error: unknown, t: (key: string) => string): string {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  if (code === ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE) return t('cancelBlockedByTerminalCharge')
  return apiErrorDescription(error)
}
