/**
 * useBancosData — datos compartidos por las páginas del hub Bancos.
 * Una sola query de conexiones (cache compartido con Integraciones/BankAccountsSection)
 * + la lista de proveedores (para distinguir "no te has conectado" de "no hay bancos
 * disponibles"; prod puede no tener EXTERNAL_BANK sembrado).
 *
 * `enabled` gatea AMBAS queries: un venue sin acceso PRO (BANKING_HUB) no debe golpear
 * el backend de scraping bancario ni filtrar datos reales detrás del blur del FeatureGate.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { falloDeCarga, type EstadoDeCarga } from '@/lib/falloDeCarga'
import { financialConnectionAPI, type FinancialAccountSummary, type FinancialConnectionSummary } from '@/services/financialConnection.service'

export interface BancosData {
  venueId: string | null
  connections: FinancialConnectionSummary[]
  /** Cuentas de conexiones CONNECTED, aplanadas, con su conexión padre. */
  accounts: Array<{ account: FinancialAccountSummary; connection: FinancialConnectionSummary }>
  hasConnection: boolean
  /** Hay conexiones pero ninguna CONNECTED (NEEDS_REAUTH / PENDING_*): necesitan reconectar, no crear nueva. */
  hasPendingConnection: boolean
  hasProviders: boolean
  isLoading: boolean
  /** Sin leer lo que la página necesita (500/timeout/sin red): distinto de "no tienes banco". Sólo sin datos: con ellos avisa `recarga`. */
  isError: boolean
  /** La lectura de la que depende lo que está a la vista: si su recarga cae, lo que había sigue y `AvisoDeCarga` lo dice. */
  recarga: EstadoDeCarga
  /** Reintenta la carga de conexiones (para el estado de error). */
  refetch: () => void
}

export function useBancosData({ enabled = true }: { enabled?: boolean } = {}): BancosData {
  const { venueId } = useCurrentVenue()

  const connectionsQuery = useQuery({
    queryKey: ['financial-connections', venueId],
    queryFn: () => financialConnectionAPI.listConnections(venueId!),
    enabled: enabled && !!venueId,
  })

  const providersQuery = useQuery({
    queryKey: ['financial-providers'],
    queryFn: financialConnectionAPI.listProviders,
    enabled,
  })

  const connections = useMemo(
    () => (connectionsQuery.data ?? []).filter(c => c.status !== 'REVOKED' && c.status !== 'ERROR'),
    [connectionsQuery.data],
  )

  // Solo cuentas de conexiones CONNECTED tienen lecturas útiles (saldo/movimientos).
  const accounts = useMemo(
    () =>
      connections
        .filter(c => c.status === 'CONNECTED')
        .flatMap(connection => connection.accounts.map(account => ({ account, connection }))),
    [connections],
  )

  const hasConnection = connections.some(c => c.status === 'CONNECTED')

  return {
    venueId,
    connections,
    accounts,
    hasConnection,
    hasPendingConnection: !hasConnection && connections.length > 0,
    // Lo leído sigue valiendo aunque falle la recarga; sin leer, `isError` evita afirmar "no hay proveedores".
    hasProviders: (providersQuery.data ?? []).length > 0,
    // Por lo que se ha leído, no por el estado: sin internet la consulta se pausa sin marcar error y sin «cargar», y diría «sin cuentas».
    isLoading:
      (enabled && !!venueId && connectionsQuery.data === undefined && !falloDeCarga(connectionsQuery)) ||
      (enabled && providersQuery.data === undefined && !falloDeCarga(providersQuery)),
    isError:
      (connectionsQuery.data === undefined && falloDeCarga(connectionsQuery)) ||
      (connections.length === 0 && providersQuery.data === undefined && falloDeCarga(providersQuery)),
    recarga: falloDeCarga(connectionsQuery) || connections.length > 0 ? connectionsQuery : providersQuery,
    refetch: () => {
      void connectionsQuery.refetch()
      void providersQuery.refetch()
    },
  }
}
