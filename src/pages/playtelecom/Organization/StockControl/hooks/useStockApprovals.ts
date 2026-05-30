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

const LIMIT = 50

export function useStockApprovals(orgId: string | undefined, { search }: { search?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ['stock-approvals', orgId, search],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit: LIMIT }
      if (pageParam) params.cursor = pageParam as string
      if (search) params.search = search
      const { data } = await api.get(`/api/v1/dashboard/organizations/${orgId}/pending-stock-approvals`, { params })
      return data.data as StockApprovalsPage
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!orgId,
    staleTime: 15_000,
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
    mutationFn: async (vars: { serializedItemIds: string[] }) => {
      const { data } = await api.post(
        `/api/v1/dashboard/organizations/${orgId}/pending-stock-approvals/approve`,
        { serializedItemIds: vars.serializedItemIds },
      )
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
