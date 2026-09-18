/**
 * Centavos → pesos, para la pantalla de la oferta.
 *
 * 🔴 Es lo ÚNICO que el dashboard hace con el dinero. Los montos llegan del servidor en centavos
 * enteros con IVA incluido y aquí solo se formatean: no se suman, no se prorratean y no se
 * redondean a pesos. En México el precio en pantalla ya incluye el impuesto, así que los centavos
 * del IVA son parte de lo que el cliente paga.
 */
const formateador = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export function formatMXN(cents: number): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—'
  return formateador.format(cents / 100)
}
