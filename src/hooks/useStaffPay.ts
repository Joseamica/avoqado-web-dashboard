import { useEffect, useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import { staffPayService } from '@/services/staffPay.service'
import type { AjusteClaseInput, AjusteManualInput, CeldaDto } from '@/types/staffPay'

export const staffPayKeys = {
  all: (venueId: string | null) => ['staff-pay', venueId] as const,
  access: (venueId: string | null) => [...staffPayKeys.all(venueId), 'access'] as const,
  levels: (venueId: string | null) => [...staffPayKeys.all(venueId), 'levels'] as const,
  assignments: (venueId: string | null) => [...staffPayKeys.all(venueId), 'assignments'] as const,
  tables: (venueId: string | null) => [...staffPayKeys.all(venueId), 'tables'] as const,
  report: (venueId: string | null) => [...staffPayKeys.all(venueId), 'report'] as const,
  periods: (venueId: string | null) => [...staffPayKeys.all(venueId), 'periods'] as const,
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
export function useStaffPayReport(p: { offset: number; limit: number; sede?: string; fecha?: string }, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({
    queryKey: [...staffPayKeys.report(venueId), p],
    queryFn: () => staffPayService.report(venueId!, p),
    enabled: !!venueId && enabled,
    // Paginar o filtrar DENTRO del mismo periodo conserva lo anterior; cambiar de periodo no: `periodo.estado` del anterior
    // haría que la pantalla pidiera excepciones/huérfanas/desglose de un periodo cerrado (409 PERIODO_CERRADO).
    placeholderData: (previo, consultaPrevia) => {
      const k = consultaPrevia?.queryKey
      return (k?.[k.length - 1] as typeof p | undefined)?.fecha === p.fecha ? previo : undefined
    },
    ...pesado,
  })
}
/**
 * Desglose clase por clase de una persona en el periodo abierto (cursor, 50 por página). Para un periodo CERRADO el
 * server responde 409 PERIODO_CERRADO (Codex R2-R1-21): la pantalla lo apaga con `enabled` y lee el recibo.
 */
export function useStaffPayDetail(staffId: string | null, sede: string | undefined, fecha?: string, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: [...staffPayKeys.report(venueId), 'detail', staffId, sede ?? null, fecha ?? null],
    queryFn: ({ pageParam }) => staffPayService.staffDetail(venueId!, staffId!, { cursor: pageParam ?? undefined, limit: LIMITE_LISTA, sede, fecha }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId && !!staffId && enabled,
    ...pesado,
  })
}
/** Clases del periodo que todavía no se pueden pagar (cursor, 50 por página). Periodo cerrado ⇒ `enabled=false` (409). */
export function useStaffPayExceptions(sede: string | undefined, fecha?: string, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: [...staffPayKeys.report(venueId), 'exceptions', sede ?? null, fecha ?? null],
    queryFn: ({ pageParam }) => staffPayService.exceptions(venueId!, { cursor: pageParam ?? undefined, limit: LIMITE_LISTA, sede, fecha }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId && enabled,
    ...pesado,
  })
}
/** Reservas de clase sin horario del periodo (offset, 50 por página). Periodo cerrado ⇒ `enabled=false` (409). */
export function useStaffPayOrphans(sede: string | undefined, fecha?: string, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: [...staffPayKeys.report(venueId), 'orphans', sede ?? null, fecha ?? null],
    queryFn: ({ pageParam }) => staffPayService.orphans(venueId!, { offset: pageParam, limit: LIMITE_LISTA, sede, fecha }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const cargadas = pages.reduce((n, p) => n + p.items.length, 0)
      return last.items.length > 0 && cargadas < last.total ? cargadas : undefined
    },
    enabled: !!venueId && enabled,
    ...pesado,
  })
}
/** Páginas de 24 periodos; `data.items` ya viene aplanado y `hasNextPage` dice si hay más viejos («Ver periodos anteriores»). */
export function useStaffPayPeriods(enabled = true) {
  const { venueId } = useCurrentVenue()
  const q = useInfiniteQuery({
    queryKey: staffPayKeys.periods(venueId),
    queryFn: ({ pageParam }) => staffPayService.periods(venueId!, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.antesDe ?? undefined,
    enabled: !!venueId && enabled,
    ...pesado,
  })
  const data = useMemo(() => (q.data ? { ...q.data.pages[0], items: q.data.pages.flatMap(p => p.items) } : undefined), [q.data])
  return { ...q, data }
}
/** Qué se cerraría hoy y con qué huella; nunca se reusa: `staleTime: 0` (la huella debe ser la de ESTE momento). */
export function useClosePreview(fecha: string | null, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({
    queryKey: [...staffPayKeys.periods(venueId), 'close-preview', fecha],
    queryFn: () => staffPayService.closePreview(venueId!, fecha!),
    enabled: !!venueId && !!fecha && enabled,
    staleTime: 0,
    // Sin caché al cerrar el diálogo: al reabrirlo no se ve un preview viejo (con su huella) mientras refetchea.
    gcTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
const LIMITE_RECIBO = 100
/**
 * El recibo por páginas (Codex R2-R1-20): `data.renglones` ya viene aplanado y `hasNextPage` dice si hay más («Cargar
 * más»); `data.total` y `data.cantidad` son del recibo ENTERO (los suma la base), nunca la suma de lo cargado.
 */
export function useStaffReceipt(staffId: string | null, fecha: string | null, enabled = true, sede?: string) {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()
  // `sede` en la llave: el cursor del server la lleva, y una página con otra sede respondería 409 RECIBO_CAMBIO.
  const queryKey = [...staffPayKeys.report(venueId), 'receipt', staffId, fecha, sede ?? null]
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => staffPayService.receipt(venueId!, staffId!, fecha!, { cursor: pageParam ?? undefined, limit: LIMITE_RECIBO, sede }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.siguiente ?? undefined,
    enabled: !!venueId && !!staffId && !!fecha && enabled,
    ...pesado,
    // El 409 RECIBO_CAMBIO es determinista: reintentarlo sólo retrasa el reinicio.
    retry: (n, e) => n < 1 && (e as { response?: { status?: number } } | null)?.response?.status !== 409,
  })
  // Codex R3-Nuevo 3: si el periodo se cerró entre dos páginas, el server responde 409 RECIBO_CAMBIO; la lista se
  // reinicia desde la página 1 (que ya es el recibo cerrado) en vez de quedarse con un error. `reset`, no `invalidate`:
  // invalidar volvería a pedir las páginas con los cursores viejos y toparía con el mismo 409.
  const codigo = (q.error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code
  useEffect(() => {
    if (codigo === 'RECIBO_CAMBIO') void qc.resetQueries({ queryKey })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `queryKey` se recrea en cada render; basta el código
  }, [codigo, qc])
  const data = useMemo(() => (q.data ? { ...q.data.pages[0], renglones: q.data.pages.flatMap(p => p.renglones) } : undefined), [q.data])
  return { ...q, data }
}
/**
 * Cuánto registraría «marcar pagado» (de todos los pendientes, o de `staffId`) y con qué huella (Codex bloque A #6). Como
 * el preview del cierre: nunca se reusa (`staleTime`/`gcTime` 0) y un 409 no se reintenta (es determinista).
 */
export function usePaidPreview(periodId: string | null, staffId: string | undefined, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({
    queryKey: [...staffPayKeys.periods(venueId), 'paid-preview', periodId, staffId ?? null],
    queryFn: () => staffPayService.paidPreview(venueId!, periodId!, staffId),
    enabled: !!venueId && !!periodId && enabled,
    staleTime: 0,
    gcTime: 0,
    retry: (n, e) => n < 1 && (e as { response?: { status?: number } } | null)?.response?.status !== 409,
    refetchOnWindowFocus: false,
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
export function useSetPeriodicity() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: 'MONTHLY' | 'SEMIMONTHLY') => staffPayService.setPeriodicity(venueId!, p), onSuccess: inv })
}
export function useClosePeriod() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (b: { fecha: string; huellaEsperada: string; confirmarHuerfanas: boolean }) => staffPayService.close(venueId!, b), onSuccess: inv })
}
export function useMarkPaid(periodId: string | null) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (b: { staffId?: string; nota?: string; huellaEsperada?: string }) => staffPayService.markPaid(venueId!, periodId!, b), onSuccess: inv })
}
export function useAddAdjustment() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (b: AjusteManualInput) => staffPayService.addAdjustment(venueId!, b), onSuccess: inv })
}
