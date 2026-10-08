import { useEffect, useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import { conCancelarEnPausa } from './staffPayPausa'
import { useDebounce } from './useDebounce'
import { commissionKeys } from './useCommissions'
import { staffPayService } from '@/services/staffPay.service'
import type { AjusteClaseInput, AjusteManualInput, AjustePreviewQuery, CeldaDto, LiquidarInput, PreviewLiquidacionDto } from '@/types/staffPay'
import type { ReglasPayload } from '@/pages/StaffPay/reglas'

export const staffPayKeys = {
  all: (venueId: string | null) => ['staff-pay', venueId] as const,
  access: (venueId: string | null) => [...staffPayKeys.all(venueId), 'access'] as const,
  levels: (venueId: string | null) => [...staffPayKeys.all(venueId), 'levels'] as const,
  assignments: (venueId: string | null) => [...staffPayKeys.all(venueId), 'assignments'] as const,
  tables: (venueId: string | null) => [...staffPayKeys.all(venueId), 'tables'] as const,
  report: (venueId: string | null) => [...staffPayKeys.all(venueId), 'report'] as const,
  sedes: (venueId: string | null) => [...staffPayKeys.all(venueId), 'sedes'] as const,
  periods: (venueId: string | null) => [...staffPayKeys.all(venueId), 'periods'] as const,
  classPay: (venueId: string | null, sessionId: string | null) => [...staffPayKeys.all(venueId), 'class', sessionId] as const,
  /** Debajo de `periods`: lo que refresca la lista de periodos refresca también sus diferencias. */
  differences: (venueId: string | null, periodId: string | null) => [...staffPayKeys.periods(venueId), 'differences', periodId] as const,
  /** Debajo de `classPay` de la sede de la CLASE: corregir la clase (que invalida su ficha) refresca también su diferencia. */
  classDifference: (classVenueId: string | null, sessionId: string | null) => [...staffPayKeys.classPay(classVenueId, sessionId), 'difference'] as const,
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
/** Diferencias pendientes de un periodo CERRADO (cursor, 50 por página). */
export function useDifferences(periodId: string | null, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useInfiniteQuery({
    queryKey: staffPayKeys.differences(venueId, periodId),
    queryFn: ({ pageParam }) => staffPayService.differences(venueId!, periodId!, { cursor: pageParam ?? undefined, limit: LIMITE_LISTA }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: !!venueId && !!periodId && enabled,
    ...pesado,
  })
}
const estado = (e: unknown) => (e as { response?: { status?: number } } | null)?.response?.status
/**
 * Qué se liquidaría de UNA clase y con qué huella. 🔴 Bajo la sede de la CLASE (Codex R1-18), que entra en la llave. La
 * huella tiene que ser la de este momento: `staleTime: 0` (abrir el diálogo vuelve a pedirla). La caché se conserva para
 * que la tarjeta de la clase y el diálogo compartan la misma consulta. Un 4xx no se reintenta (es determinista).
 */
export function useClassDifference(classVenueId: string | null, sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: staffPayKeys.classDifference(classVenueId, sessionId),
    queryFn: () => staffPayService.classDifference(classVenueId!, sessionId!),
    enabled: !!classVenueId && !!sessionId && enabled,
    staleTime: 0,
    retry: (n, e) => n < 1 && !((estado(e) ?? 0) >= 400 && (estado(e) ?? 0) < 500),
    refetchOnWindowFocus: false,
  })
}
/**
 * Liquidar la diferencia de UNA clase, bajo la sede de la clase. Al terminar refresca sólo lo que cambia: las diferencias
 * y los periodos (el destino suma la línea), el reporte y los recibos, y la ficha de la clase — de la sede actual y de la
 * de la clase —; nunca niveles, tablas ni accesos. Si los montos cambiaron (HUELLA_CAMBIO) el server manda el preview
 * nuevo y se pone en la caché tal cual: el diálogo lo muestra sin otra vuelta.
 * 🔴 `onSuccess`/`onError` DEVUELVEN la recarga: `mutateAsync` resuelve cuando la lista ya no trae la clase liquidada. Si
 * no, el diálogo cerraba, el foco volvía a un botón que desaparecía un instante después (y caía al <body>), y el aviso de
 * éxito convivía con la clase todavía en pantalla.
 */
export function useSettleDifference(classVenueId: string | null, sessionId: string | null) {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()
  const ficha = staffPayKeys.classPay(classVenueId, sessionId)
  const mutationKey = [...staffPayKeys.all(venueId), 'settle', classVenueId, sessionId]
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (b: LiquidarInput) => staffPayService.settleDifference(classVenueId!, sessionId!, b),
    onSuccess: () =>
      Promise.all([
        ...[...new Set([venueId, classVenueId])].flatMap(v => [
          qc.invalidateQueries({ queryKey: staffPayKeys.periods(v) }),
          qc.invalidateQueries({ queryKey: staffPayKeys.report(v) }),
        ]),
        qc.invalidateQueries({ queryKey: ficha }),
      ]),
    onError: err => {
      const r = (err as { response?: { status?: number; data?: { code?: string; details?: { preview?: PreviewLiquidacionDto } } } } | null)?.response
      if (!r?.status || r.status < 400 || r.status >= 500) return
      // La lista también cambió (otros montos, la clase se movió o ya se liquidó): se recarga.
      const listas = [...new Set([venueId, classVenueId])].map(v => qc.invalidateQueries({ queryKey: [...staffPayKeys.periods(v), 'differences'] }))
      if (r.data?.code === 'HUELLA_CAMBIO') {
        // El preview nuevo, si vino, va directo a la caché; si no, el diálogo lo vuelve a pedir. La ficha sí se recarga.
        const nuevo = r.data.details?.preview
        if (nuevo) qc.setQueryData(staffPayKeys.classDifference(classVenueId, sessionId), nuevo)
        return Promise.all([...listas, qc.invalidateQueries({ queryKey: ficha, exact: true })])
      }
      // Otro periodo de origen, excepción, sede fuera del destino…: la ficha y su diferencia se vuelven a leer.
      return Promise.all([...listas, qc.invalidateQueries({ queryKey: ficha })])
    },
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
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
/**
 * Lo que cambia lo PAGADO (marcar pagado) o `staffPayActive` (activar, activar o desactivar una sede) también cambia las
 * estadísticas de Comisiones («Pagado» y su aviso), que viven en otra llave y se dan por frescas 2 minutos (E6a-fix F2). Son
 * operaciones de organización: el recibo junta comisiones de varias sedes y una ventana es de otra sede, así que se
 * invalidan las estadísticas de TODAS las sedes (`['commissions', 'stats']`), no sólo las de la actual.
 */
function useInvalidarPagado() {
  const qc = useQueryClient()
  const inv = useInvalidarTodo()
  return () => Promise.all([inv(), qc.invalidateQueries({ queryKey: [...commissionKeys.all, 'stats'] })])
}
export function useCreateLevel() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), 'create-level']
  const mutacion = useMutation({ mutationKey, mutationFn: (name: string) => staffPayService.createLevel(venueId!, name), onSuccess: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useUpdateLevel() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), 'update-level']
  const mutacion = useMutation({ mutationKey, mutationFn: (p: { levelId: string; name?: string; archived?: boolean }) => staffPayService.updateLevel(venueId!, p.levelId, p), onSuccess: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
/** `simulacion`: la vista previa («cambia el pago de N clases») no escribe y lleva su propia llave: no se mezcla con el envío en pausa. */
export function useAssignLevel(simulacion = false) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), simulacion ? 'assign-level-simulation' : 'assign-level']
  const mutacion = useMutation({ mutationKey, mutationFn: (p: { staffId: string; payLevelId: string; effectiveFrom: string; simular?: boolean }) => staffPayService.assign(venueId!, p), onSuccess: (_d, p) => { if (!p.simular) inv() } })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useCreateTable() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: { name: string; productIds: string[] }) => staffPayService.createTable(venueId!, p), onSuccess: inv })
}
/** `simulacion`: como en `useAssignLevel`, la vista previa lleva su propia llave. */
export function usePublishTable(simulacion = false) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), simulacion ? 'publish-table-simulation' : 'publish-table']
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (p: { tableId: string; effectiveFrom: string; maxCount: number; cells: CeldaDto[]; simular?: boolean } & ReglasPayload) =>
      staffPayService.publish(venueId!, p.tableId, { ...p, countMode: 'BOOKED' }),
    onSuccess: (_d, p) => { if (!p.simular) inv() },
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useAdjustClass(sessionId: string | null) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: AjusteClaseInput) => staffPayService.adjustClass(venueId!, sessionId!, p), onSuccess: inv })
}
export function useSetPeriodicity() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo()
  return useMutation({ mutationFn: (p: 'MONTHLY' | 'SEMIMONTHLY') => staffPayService.setPeriodicity(venueId!, p), onSuccess: inv })
}
/**
 * Sin respuesta (o un 5xx) el periodo pudo haberse cerrado (E6a-fix2 C4): se relee todo MENOS la vista previa del cierre, que la
 * relee el modal para decir qué pasó (una sola petición, la suya); sin esperar, así el modal dice «revisando…» mientras tanto.
 */
export function useClosePeriod() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarTodo()
  const mutationKey = [...staffPayKeys.all(venueId), 'close']
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (b: { fecha: string; huellaEsperada: string; confirmarHuerfanas: boolean }) => staffPayService.close(venueId!, b),
    onSuccess: inv,
    onError: err => {
      if ((estado(err) ?? 500) < 500) return
      void qc.invalidateQueries({ queryKey: staffPayKeys.all(venueId), predicate: q => !q.queryKey.includes('close-preview') })
    },
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useMarkPaid(periodId: string | null) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarPagado(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), 'mark-paid', periodId]
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (b: { staffId?: string; nota?: string; huellaEsperada?: string }) => staffPayService.markPaid(venueId!, periodId!, b),
    onSuccess: inv,
    // Sin respuesta (se perdió): el server pudo haber marcado; se recarga lo mismo que en el éxito (full-testing C7).
    onError: err => ((err as { response?: unknown } | null)?.response ? undefined : inv()),
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
/**
 * Sin respuesta (o un 5xx: un proxy pudo cortar después de guardar) el ajuste pudo haberse guardado: se relee lo mismo que en
 * el éxito, para que la tabla diga cómo quedó (E6a-fix2 D1). Reintentar con la misma clave no duplica.
 */
export function useAddAdjustment() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), 'adjustment']
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (b: AjusteManualInput) => staffPayService.addAdjustment(venueId!, b),
    onSuccess: inv,
    onError: err => ((estado(err) ?? 500) >= 500 ? inv() : undefined),
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
/**
 * La vista previa del ajuste manual (B13), sólo con el formulario completo (`q`): trae las devoluciones pendientes de esa
 * persona para avisar antes de guardar. Teclear no pide una por tecla (la llave se fija 300 ms después de la última); nunca se
 * reusa (`staleTime`/`gcTime` 0); un 4xx no se reintenta. Al cambiar la llave conserva la anterior: quien la pinta compara
 * `staffId` con la persona elegida.
 */
export function useAdjustmentPreview(q: AjustePreviewQuery | null, enabled = true) {
  const { venueId } = useCurrentVenue()
  const clave = useDebounce(q && enabled ? JSON.stringify(q) : null, 300)
  return useQuery({
    queryKey: [...staffPayKeys.all(venueId), 'adjustment-preview', clave],
    queryFn: () => staffPayService.adjustmentPreview(venueId!, JSON.parse(clave!) as AjustePreviewQuery),
    enabled: !!venueId && !!clave && !!q && enabled,
    staleTime: 0,
    gcTime: 0,
    retry: (n, e) => n < 1 && (estado(e) ?? 500) >= 500,
    refetchOnWindowFocus: false,
    placeholderData: previo => previo,
  })
}

/** Activar pago al personal: fija la periodicidad, la fecha de inicio y las sedes. Refresca acceso, periodos, sedes y reporte. */
export function useActivateStaffPay() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarPagado(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), 'activate']
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (b: { periodicidad: 'MONTHLY' | 'SEMIMONTHLY'; inicioEsperado: string; sedes?: string[] }) => staffPayService.activate(venueId!, b),
    onSuccess: inv,
    // Sin respuesta pudo haberse activado (el servidor es idempotente): se recarga lo mismo que en el éxito.
    onError: err => (estado(err) ? undefined : inv()),
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
/** Prender o apagar «Pagar las propinas en el recibo» (abre o cierra una ventana, spec §7.1). */
export function useSetTips() {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarTodo(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), 'tips']
  const mutacion = useMutation({ mutationKey, mutationFn: (encender: boolean) => staffPayService.setTips(venueId!, encender), onSuccess: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
/** Estado de activación por sede (sin puerta de plan: una sede que perdió el plan tiene que poder verse). */
export function useStaffPaySedes(enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: staffPayKeys.sedes(venueId), queryFn: () => staffPayService.sedes(venueId!), enabled: !!venueId && enabled, ...pesado })
}
/**
 * Qué entra y qué queda fuera al activar o desactivar UNA sede desde `fecha` (sin ella, hoy de la sede). Nunca se reusa: es
 * dinero (`staleTime`/`gcTime` 0). Al mover la fecha se conserva la vista anterior mientras llega la nueva (no parpadea;
 * `isFetching` apaga el botón). Un 4xx no se reintenta: es determinista (YA_ACTIVA, FECHA_FUERA_DE_RANGO…).
 */
export function useParticipationPreview(sedeId: string | null, accion: 'activar' | 'desactivar', fecha?: string, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({
    queryKey: [...staffPayKeys.sedes(venueId), sedeId, 'preview', accion, fecha ?? null],
    queryFn: () => staffPayService.participationPreview(venueId!, sedeId!, accion, fecha),
    enabled: !!venueId && !!sedeId && enabled,
    staleTime: 0,
    gcTime: 0,
    retry: (n, e) => n < 1 && (estado(e) ?? 500) >= 500,
    refetchOnWindowFocus: false,
    placeholderData: previo => previo,
  })
}
/**
 * Activar o desactivar una sede refresca todo lo de pago al personal (el cierre, los reportes y el acceso dependen de las
 * ventanas). Un rechazo 4xx dice que la sede cambió del otro lado: se relee la lista. Sin respuesta pudo haberse aplicado:
 * se relee todo, como en el éxito.
 */
function useCambiarSede<B, R>(clave: 'activate-sede' | 'deactivate-sede', llamar: (venueId: string, b: B) => Promise<R>) {
  const { venueId } = useCurrentVenue(); const inv = useInvalidarPagado(); const qc = useQueryClient()
  const mutationKey = [...staffPayKeys.all(venueId), clave]
  const mutacion = useMutation({
    mutationKey,
    mutationFn: (b: B) => llamar(venueId!, b),
    onSuccess: inv,
    onError: err => {
      const s = estado(err)
      if (!s) return inv()
      if (s >= 400 && s < 500) return qc.invalidateQueries({ queryKey: staffPayKeys.sedes(venueId), exact: true })
    },
  })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useActivateSede() {
  return useCambiarSede('activate-sede', (venueId, p: { sedeId: string; desde: string; fechaEsperada: string }) =>
    staffPayService.activateSede(venueId, p.sedeId, { desde: p.desde, fechaEsperada: p.fechaEsperada }),
  )
}
export function useDeactivateSede() {
  return useCambiarSede('deactivate-sede', (venueId, p: { sedeId: string; hasta: string; fechaEsperada: string }) =>
    staffPayService.deactivateSede(venueId, p.sedeId, { hasta: p.hasta, fechaEsperada: p.fechaEsperada }),
  )
}
