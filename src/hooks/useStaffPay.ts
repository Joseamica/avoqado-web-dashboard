import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
const LIMITE_LISTA = 50

/** `enabled=false` para quien no tiene `staffpay:read`: el servidor respondería 403 (y con reintentos, varias veces). */
export function useStaffPayAccess(enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.access(venueId), queryFn: () => staffPayService.access(venueId!), enabled: !!venueId && enabled, staleTime: 5 * 60_000 })
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
/** Desglose clase por clase de una persona en el periodo abierto (cursor, 50 por página). */
export function useStaffPayDetail(staffId: string | null, sede: string | undefined, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: [...staffPayKeys.report(venueId), 'detail', staffId, sede ?? null],
    queryFn: ({ pageParam }) => staffPayService.staffDetail(venueId!, staffId!, { cursor: pageParam ?? undefined, limit: LIMITE_LISTA, sede }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId && !!staffId && enabled,
    ...pesado,
  })
}
/** Clases del periodo que todavía no se pueden pagar (cursor, 50 por página). */
export function useStaffPayExceptions(sede: string | undefined, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: [...staffPayKeys.report(venueId), 'exceptions', sede ?? null],
    queryFn: ({ pageParam }) => staffPayService.exceptions(venueId!, { cursor: pageParam ?? undefined, limit: LIMITE_LISTA, sede }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId && enabled,
    ...pesado,
  })
}
/** Reservas de clase sin horario del periodo (offset, 50 por página). */
export function useStaffPayOrphans(sede: string | undefined, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: [...staffPayKeys.report(venueId), 'orphans', sede ?? null],
    queryFn: ({ pageParam }) => staffPayService.orphans(venueId!, { offset: pageParam, limit: LIMITE_LISTA, sede }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const cargadas = pages.reduce((n, p) => n + p.items.length, 0)
      return last.items.length > 0 && cargadas < last.total ? cargadas : undefined
    },
    enabled: !!venueId && enabled,
    ...pesado,
  })
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
