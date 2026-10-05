/** Pestañas de Reservaciones › Pases (en el hash de la URL) → el `status` que se le pide al server. */
export const PASS_VISIT_TABS = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  portal: 'ALREADY_CONFIRMED',
  expired: 'EXPIRED',
  rejected: 'REJECTED',
} as const
export type PassVisitTab = keyof typeof PASS_VISIT_TABS
