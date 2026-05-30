import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import api from '@/api'

export interface StockApprovalItem {
  id: string
  serialNumber: string
  custodyState: 'ADMIN_HELD' | 'SUPERVISOR_HELD' | 'PROMOTER_PENDING' | 'PROMOTER_HELD' | 'PROMOTER_REJECTED'
  category: { id: string; name: string } | null
  registeredFromVenue: { id: string; name: string } | null
}

interface StockApprovalsPage {
  items: StockApprovalItem[]
  nextCursor: string | null
}

export function useStockApprovals(orgId: string | undefined, search?: string) {
  return useInfiniteQuery({
    queryKey: ['stock-approvals', orgId, search],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get(`/api/v1/dashboard/organizations/${orgId}/pending-stock-approvals`, {
        params: {
          cursor: pageParam,
          limit: 50,
          search: search || undefined,
        },
      })
      return data.data as StockApprovalsPage
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: StockApprovalsPage) => last.nextCursor ?? undefined,
    enabled: !!orgId,
  })
}

export function useStockApprovalsCount(orgId: string | undefined) {
  return useQuery({
    queryKey: ['stock-approvals-count', orgId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/dashboard/organizations/${orgId}/pending-stock-approvals/count`)
      return (data.data?.count ?? 0) as number
    },
    enabled: !!orgId,
    staleTime: 15_000,
  })
}

export function useApproveStock(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (serializedItemIds: string[]) => {
      const { data } = await api.post(`/api/v1/dashboard/organizations/${orgId}/pending-stock-approvals/approve`, {
        serializedItemIds,
      })
      return data.data
    },
    onSuccess: () => {
      toast({ title: 'SIM(s) aprobado(s) — enviados al almacén' })
      qc.invalidateQueries({ queryKey: ['stock-approvals', orgId] })
      qc.invalidateQueries({ queryKey: ['stock-approvals-count', orgId] })
      qc.invalidateQueries({ queryKey: ['org-stock-control', orgId] })
    },
    onError: (err: any) =>
      toast({ title: err?.response?.data?.message ?? 'Error al aprobar', variant: 'destructive' }),
  })
}
