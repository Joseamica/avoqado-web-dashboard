/**
 * Nombre para mostrar: junta sólo las partes que existen. `Customer.firstName` y `lastName` son opcionales en el SERVIDOR
 * (quien reserva desde book.avoqado.io queda sin apellido), y `${firstName} ${lastName}` pintaba «Jose null» (D682).
 * Sin ninguna parte devuelve '' para que la pantalla use su propio respaldo: `nombreCompleto(c) || guestName || t(...)`.
 */
export const nombreCompleto = (persona?: { firstName?: string | null; lastName?: string | null } | null): string =>
  [persona?.firstName, persona?.lastName]
    .map(parte => parte?.trim())
    .filter(Boolean)
    .join(' ')
