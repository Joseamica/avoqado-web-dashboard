/**
 * D5, opción A (founder, 2-nov-2026): un aparato emite vales O los cobra, no las dos cosas. Con las dos, su botón siempre
 * emite y la casilla «Cobrar» no hacía nada. Al prender una, el panel apaga la otra en el mismo cambio y lo explica; el
 * SERVIDOR también lo rechaza (AREA_TICKET_ISSUE_AND_CHECKOUT).
 */
export type CapacidadDeVales = 'canIssueAreaTickets' | 'canCheckoutAreaTickets' | 'canDeliverAreaTickets'

type EmiteYCobra = { canIssueAreaTickets: boolean; canCheckoutAreaTickets: boolean }

const OTRA: Partial<Record<CapacidadDeVales, CapacidadDeVales>> = {
  canIssueAreaTickets: 'canCheckoutAreaTickets',
  canCheckoutAreaTickets: 'canIssueAreaTickets',
}

export function cambioDeCapacidad(
  terminal: EmiteYCobra,
  clave: CapacidadDeVales,
  prendida: boolean,
): { input: Partial<Record<CapacidadDeVales, boolean>>; apagada: CapacidadDeVales | null } {
  const otra = OTRA[clave]
  if (prendida && otra && terminal[otra as keyof EmiteYCobra]) {
    return { input: { [clave]: true, [otra]: false }, apagada: otra }
  }
  return { input: { [clave]: prendida }, apagada: null }
}

export function tieneEmitirYCobrar(terminal: EmiteYCobra): boolean {
  return terminal.canIssueAreaTickets && terminal.canCheckoutAreaTickets
}
