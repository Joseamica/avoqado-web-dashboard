import { useQuery } from '@tanstack/react-query'
import { exportRunsService } from '@/services/exportRuns.service'

const statusDe = (error: unknown) => (error as { response?: { status?: number } } | null)?.response?.status

export function useExportRun(venueId: string, runId: string | null) {
  const q = useQuery({
    queryKey: ['export-run', venueId, runId],
    queryFn: () => exportRunsService.estado(venueId, runId!),
    enabled: !!runId,
    retry: false, // api.ts ya reintenta una vez los errores de red; un 404/403 no se arregla solo
    // TanStack Query v5 (^5.90): refetchInterval recibe la query.
    refetchInterval: query => {
      if (query.state.status === 'error') return false
      const s = query.state.data?.status
      return !s || s === 'QUEUED' || s === 'RUNNING' ? 1500 : false
    },
  })
  const d = q.data
  const codigo = statusDe(q.error)
  const percent = !d ? 0 : d.totalRows === 0 ? (d.status === 'READY' ? 100 : 0) : Math.min(100, Math.floor((d.processedRows / d.totalRows) * 100))
  return {
    status: d?.status,
    processedRows: d?.processedRows ?? 0,
    totalRows: d?.totalRows ?? 0,
    percent,
    waitingForPayments: !!d?.waitingForPayments,
    changedToFormat: d?.changedToFormat,
    failureCode: d?.failureCode ?? null,
    isDone: d?.status === 'READY',
    isFailed: d?.status === 'FAILED' || d?.status === 'EXPIRED',
    notFound: q.isError && (codigo === 404 || codigo === 403),
    loadError: q.isError && codigo !== 404 && codigo !== 403,
    refetch: q.refetch,
  }
}

/** El pedido de ese exporte que sigue armándose (o quedó listo hace menos de 1 h): reabrir el diálogo vuelve a su barra. */
export function useExporteVivo(venueId: string | null | undefined, kind: string, enabled: boolean): string | null {
  const { data } = useQuery({
    queryKey: ['export-runs', venueId, kind],
    queryFn: () => exportRunsService.recientes(venueId!, kind),
    enabled: enabled && !!venueId,
    staleTime: 0,
    retry: false,
  })
  const vivo = data?.find(
    r => r.status === 'QUEUED' || r.status === 'RUNNING' || (r.status === 'READY' && Date.now() - +new Date(r.createdAt) < 60 * 60_000),
  )
  return vivo?.id ?? null
}
