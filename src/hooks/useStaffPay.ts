import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import { staffPayService } from '@/services/staffPay.service'
import type { AjusteClaseInput, CeldaDto } from '@/types/staffPay'

export const staffPayKeys = {
  all: (venueId: string | null) => ['staff-pay', venueId] as const,
  access: (venueId: string | null) => [...staffPayKeys.all(venueId), 'access'] as const,
  levels: (venueId: string | null) => [...staffPayKeys.all(venueId), 'levels'] as const,
  assignments: (venueId: string | null) => [...staffPayKeys.all(venueId), 'assignments'] as const,
  tables: (venueId: string | null) => [...staffPayKeys.all(venueId), 'tables'] as const,
  report: (venueId: string | null) => [...staffPayKeys.all(venueId), 'report'] as const,
  classPay: (venueId: string | null, sessionId: string | null) => [...staffPayKeys.all(venueId), 'class', sessionId] as const,
}
const pesado = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const

export function useStaffPayAccess() {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.access(venueId), queryFn: () => staffPayService.access(venueId!), enabled: !!venueId, staleTime: 5 * 60_000 })
}
export function useStaffPayLevels(enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.levels(venueId), queryFn: () => staffPayService.levels(venueId!), enabled: !!venueId && enabled, ...pesado })
}
export function useStaffPayAssignments(enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.assignments(venueId), queryFn: () => staffPayService.assignments(venueId!), enabled: !!venueId && enabled, ...pesado })
}
export function useStaffPayTables(enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.tables(venueId), queryFn: () => staffPayService.tables(venueId!), enabled: !!venueId && enabled, ...pesado })
}
export function useStaffPayReport(p: { offset: number; limit: number; sede?: string }, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: [...staffPayKeys.report(venueId), p], queryFn: () => staffPayService.report(venueId!, p), enabled: !!venueId && enabled, placeholderData: keepPreviousData, ...pesado })
}
export function useClassPay(sessionId: string | null, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.classPay(venueId, sessionId), queryFn: () => staffPayService.classPay(venueId!, sessionId!), enabled: !!venueId && !!sessionId && enabled, retry: false })
}

function useInvalidarTodo() {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: staffPayKeys.all(venueId) })
}
export function useCreateLevel() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (name: string) => staffPayService.createLevel(venueId!, name), onSuccess: inv })
}
export function useUpdateLevel() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: { levelId: string; name?: string; archived?: boolean }) => staffPayService.updateLevel(venueId!, p.levelId, p), onSuccess: inv })
}
export function useAssignLevel() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: { staffId: string; payLevelId: string; effectiveFrom: string; simular?: boolean }) => staffPayService.assign(venueId!, p), onSuccess: (_d, p) => { if (!p.simular) inv() } })
}
export function useCreateTable() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: { name: string; productIds: string[] }) => staffPayService.createTable(venueId!, p), onSuccess: inv })
}
export function usePublishTable() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({
    mutationFn: (p: { tableId: string; effectiveFrom: string; maxCount: number; cells: CeldaDto[]; simular?: boolean }) => staffPayService.publish(venueId!, p.tableId, { ...p, countMode: 'BOOKED' }),
    onSuccess: (_d, p) => { if (!p.simular) inv() },
  })
}
export function useAdjustClass(sessionId: string | null) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: AjusteClaseInput) => staffPayService.adjustClass(venueId!, sessionId!, p), onSuccess: inv })
}
