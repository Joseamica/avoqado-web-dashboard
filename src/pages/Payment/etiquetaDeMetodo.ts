/**
 * Una sola traducción del método de pago para la tabla, los dos filtros y el panel de detalle. Cada lugar traducía por su
 * cuenta y se desfasaron: el filtro llamaba «Tarjeta» a transferencias/monedero/otro y el detalle mostraba `BANK_TRANSFER`
 * literal (16-oct: los cobros de Mercado Pago ya se guardan como SPEI = BANK_TRANSFER, OXXO = OTHER, saldo = DIGITAL_WALLET).
 */
const LLAVES: Record<string, string> = {
  CASH: 'methods.cash',
  CREDIT_CARD: 'methods.creditCard',
  DEBIT_CARD: 'methods.debitCard',
  DIGITAL_WALLET: 'methods.digitalWallet',
  BANK_TRANSFER: 'methods.bankTransfer',
  CRYPTOCURRENCY: 'methods.cryptocurrency',
  OTHER: 'methods.other',
  STORE_CREDIT: 'methods.storeCredit',
}

export function etiquetaDeMetodo(method: string | undefined | null, t: (llave: string) => string): string {
  if (!method) return '-'
  // «CARD» es el valor viejo (antes de CREDIT_CARD/DEBIT_CARD) y cualquier otro desconocido: se queda como Tarjeta.
  return t(LLAVES[method.toUpperCase()] ?? 'methods.card')
}
