import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/api'

export interface SimRegRequestItem {
  id: string
  serialNumber: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE'
  rejectionReason: string | null
}
export interface SimRegRequest {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'
  createdAt: string
  items: SimRegRequestItem[]
  requestedBy: { id: string; firstName: string | null; lastName: string | null } | null
  registeredFromVenue: { id: string; name: string } | null
  proposedCategory: { id: string; name: string } | null
}

export function useSimRegistrationRequests(orgId: string | undefined) {
  return useQuery({
    queryKey: ['sim-registration-requests', orgId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboard/organizations/${orgId}/sim-registration-requests`)
      return data.data as SimRegRequest[]
    },
    enabled: !!orgId,
    staleTime: 15_000,
  })
}

export function useSimRegistrationRequestsCount(orgId: string | undefined) {
  return useQuery({
    queryKey: ['sim-registration-requests-count', orgId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboard/organizations/${orgId}/sim-registration-requests/count`)
      return (data.data?.count ?? 0) as number
    },
    enabled: !!orgId,
    staleTime: 15_000,
  })
}

export function useApproveSimRegistration(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { requestId: string; categoryId: string; serialNumbers?: string[] }) => {
      const { data } = await api.post(
        `/dashboard/organizations/${orgId}/sim-registration-requests/${vars.requestId}/approve`,
        { categoryId: vars.categoryId, serialNumbers: vars.serialNumbers },
      )
      return data.data
    },
    onSuccess: () => {
      toast.success('Solicitud aprobada')
      qc.invalidateQueries({ queryKey: ['sim-registration-requests', orgId] })
      qc.invalidateQueries({ queryKey: ['sim-registration-requests-count', orgId] })
      qc.invalidateQueries({ queryKey: ['org-stock-control', orgId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error al aprobar'),
  })
}

export function useRejectSimRegistration(orgId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { requestId: string; reason: string; serialNumbers?: string[] }) => {
      const { data } = await api.post(
        `/dashboard/organizations/${orgId}/sim-registration-requests/${vars.requestId}/reject`,
        { reason: vars.reason, serialNumbers: vars.serialNumbers },
      )
      return data.data
    },
    onSuccess: () => {
      toast.success('Solicitud rechazada')
      qc.invalidateQueries({ queryKey: ['sim-registration-requests', orgId] })
      qc.invalidateQueries({ queryKey: ['sim-registration-requests-count', orgId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error al rechazar'),
  })
}
