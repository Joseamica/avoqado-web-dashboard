/**
 * Conector de pases — consultas del dashboard con candado de plan.
 *
 * `enabled = !!venueId && isResolved && hasFeature`. `isResolved` (de useVenueTier) es más estricto que `!isLoading`:
 * useVenueTier hace fail-open —`hasFeatureAccess()` devuelve true— mientras la consulta del plan está en vuelo Y si falló;
 * `isResolved` sólo es true cuando el plan se comprobó de verdad (o aplica un bypass: superadmin, demo, white-label).
 * Sin esto un venue SIN el plan pegaría a la API durante el cold-load o tras un error y recibiría 403 (el server gatea
 * /pass-integrations con checkFeatureAccess, salvo la vista general y desconectar — R62, pausa suave: por eso
 * `usePassIntegrationsOverview` usa su propio `enabled`). `unresolved` (ya no carga y no se resolvió) es «la consulta del
 * plan falló»: las pantallas lo dicen («recarga la página») en vez de pedir nada.
 *
 * Las claves cuelgan de ['passes', venueId] para que cada grupo de invalidación sea un prefijo: una lista que nace en
 * una clave nueva sin su invalidación se queda vieja en silencio (regla bounded-data-and-query-load.md).
 */
import { useCallback } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useVenueTier } from '@/hooks/use-tier-feature-access'
import { getPassCapacity, getPassIntegrationsOverview, getPassVisitsSummary, listPassVisits } from '@/services/passes.service'
import type { PassProvider, PassVisitStatus } from '@/types/passes'

export const PASSES_FEATURE = 'AGGREGATOR_PASSES'
/** Página del server: ≤ 100; 50 cabe en una pantalla con «Cargar más». */
export const VISITS_PAGE_SIZE = 50
/**
 * Visitas y resumen se vuelven a pedir solos cada 30 s mientras la pestaña está visible: así la recepción ve llegar un
 * check-in del kiosco, de otra recepción o del procesamiento asíncrono del server sin tocar nada (P1-4).
 */
export const PASSES_REFETCH_MS = 30_000

export type PassVisitsListFilters = { status?: PassVisitStatus; provider?: PassProvider; from?: string; to?: string }
/** Qué cambió, para invalidar SÓLO lo que lo lee. */
export type PassInvalidationGroup = 'connection' | 'rules' | 'visit'

export const passesKeys = {
  all: (venueId: string | undefined) => ['passes', venueId] as const,
  overview: (venueId: string | undefined) => ['passes', venueId, 'overview'] as const,
  capacity: (venueId: string | undefined) => ['passes', venueId, 'capacity'] as const,
  visitsAll: (venueId: string | undefined) => ['passes', venueId, 'visits'] as const,
  visits: (venueId: string | undefined, filters: PassVisitsListFilters) => ['passes', venueId, 'visits', filters] as const,
  summaryAll: (venueId: string | undefined) => ['passes', venueId, 'summary'] as const,
  summary: (venueId: string | undefined, month: string) => ['passes', venueId, 'summary', month] as const,
}

/** Consultas pesadas: locales a estas queries, nunca en el QueryClient compartido. */
const HEAVY = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const

export function usePassesAccess(venueId: string | undefined): {
  hasFeature: boolean
  tierLoading: boolean
  resolved: boolean
  unresolved: boolean
  enabled: boolean
} {
  const { hasFeatureAccess, isLoading: tierLoading, isResolved } = useVenueTier()
  const hasFeature = hasFeatureAccess(PASSES_FEATURE)
  return {
    hasFeature,
    tierLoading,
    resolved: isResolved,
    // Sin negocio todavía no hay plan que comprobar: eso no es «la consulta falló» (no se pide recargar).
    unresolved: !!venueId && !tierLoading && !isResolved,
    enabled: !!venueId && isResolved && hasFeature,
  }
}

/**
 * La vista general NO pasa por el candado del plan (R62 del server, pausa suave): un negocio que perdió el plan sigue
 * conectado y debe VER que sus clases ya no se publican (`planActive: false`) y tener a la mano Desconectar. Corre con
 * `reservations:read` (lo que exige el server) y el plan RESUELTO —tenga o no el plan—, para que la pantalla elija entre
 * el paywall y la pausa sin adivinar. Capacity, visits y summary siguen con el `enabled` de usePassesAccess.
 */
export function usePassIntegrationsOverview(venueId: string | undefined) {
  const { resolved } = usePassesAccess(venueId)
  const { can } = useAccess()
  const enabled = !!venueId && resolved && can('reservations:read')
  return useQuery({ queryKey: passesKeys.overview(venueId), queryFn: () => getPassIntegrationsOverview(venueId!), enabled, ...HEAVY })
}

export function usePassCapacity(venueId: string | undefined) {
  const { enabled } = usePassesAccess(venueId)
  return useQuery({ queryKey: passesKeys.capacity(venueId), queryFn: () => getPassCapacity(venueId!), enabled, ...HEAVY })
}

export function usePassVisits(venueId: string | undefined, filters: PassVisitsListFilters) {
  const { enabled } = usePassesAccess(venueId)
  return useInfiniteQuery({
    queryKey: passesKeys.visits(venueId, filters),
    queryFn: ({ pageParam }) => listPassVisits(venueId!, { ...filters, limit: VISITS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: last => last.nextOffset ?? undefined,
    enabled,
    // Cambiar de pestaña o de filtro cambia la clave: sin esto `data` queda undefined y la lista se desmonta.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: 1,
    refetchOnWindowFocus: false,
    // `false` (no un número) sin plan: un reloj encendido sin permiso pegaría a la API cada 30 s.
    refetchInterval: enabled ? PASSES_REFETCH_MS : false,
    refetchIntervalInBackground: false,
  })
}

export function usePassVisitsSummary(venueId: string | undefined, month: string) {
  const { enabled } = usePassesAccess(venueId)
  const on = enabled && !!month
  return useQuery({
    queryKey: passesKeys.summary(venueId, month),
    queryFn: () => getPassVisitsSummary(venueId!, month),
    enabled: on,
    ...HEAVY,
    refetchInterval: on ? PASSES_REFETCH_MS : false,
    refetchIntervalInBackground: false,
  })
}

/**
 * Invalida SÓLO lo que lee lo que cambió, y devuelve la promesa para que el `onSuccess` de cada mutación la DEVUELVA:
 * así `isPending` dura hasta que los datos nuevos llegaron y los controles no se rehabilitan sobre valores viejos (P2-8).
 *   'connection' — conectar, modo, ligar clases, desconectar ⇒ overview.
 *   'rules'      — tope general, excepciones, sugerencia aplicada, cupo por sesión ⇒ capacity + «Pases: X de Y» del
 *                  calendario (['class-sessions', venueId]) y del detalle de sesión (['class-session', venueId]).
 *   'visit'      — confirmar/rechazar: además de visits y summary, confirmar hace check-in de la reserva (Plan 2a,
 *                  `checkInReservation`; rechazar lo deshace), así que cambia la asistencia que muestran las pantallas de
 *                  reservas: la lista (['reservations', venueId], Reservations.tsx), el detalle (['reservation', venueId],
 *                  ReservationDetail.tsx), las cifras de hoy (['reservation-stats', venueId]), el calendario
 *                  (['reservation-calendar', venueId]) y los asistentes del detalle de clase (['class-session', venueId],
 *                  EditClassSessionDialog.tsx).
 */
export function useInvalidatePasses(): (venueId: string, group: PassInvalidationGroup) => Promise<unknown> {
  const queryClient = useQueryClient()
  return useCallback(
    (venueId: string, group: PassInvalidationGroup) => {
      const keys: ReadonlyArray<readonly unknown[]> =
        group === 'connection'
          ? [passesKeys.overview(venueId)]
          : group === 'rules'
            ? [passesKeys.capacity(venueId), ['class-sessions', venueId], ['class-session', venueId]]
            : [
                passesKeys.visitsAll(venueId),
                passesKeys.summaryAll(venueId),
                ['reservations', venueId],
                ['reservation', venueId],
                ['reservation-stats', venueId],
                ['reservation-calendar', venueId],
                ['class-session', venueId],
              ]
      return Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })))
    },
    [queryClient],
  )
}
