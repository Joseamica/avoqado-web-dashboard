/**
 * Seam multi-proveedor para el wizard de conexión bancaria. Hoy solo existe EXTERNAL_BANK
 * (Moneygiver, DIRECT_CREDENTIAL — usuario/contraseña propios). El paso de credenciales del
 * wizard branchea por `connectionType`, NUNCA por `provider.code`, para que sumar un proveedor
 * OAuth o un agregador después sea agregar un nuevo case aquí, no reescribir el wizard.
 */
export type ConnectStrategy = 'credential-form' | 'not-implemented'

export function connectStrategyFor(connectionType: string): ConnectStrategy {
  switch (connectionType) {
    case 'DIRECT_CREDENTIAL':
      return 'credential-form'
    case 'DIRECT_OAUTH':
    case 'AGGREGATOR':
      return 'not-implemented'
    default:
      return 'not-implemented'
  }
}
