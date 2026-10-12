import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import { conCancelarEnPausa } from './staffPayPausa'
import { rhService } from '@/services/rh.service'

export const rhKeys = {
  all: (venueId?: string | null) => ['rh', venueId] as const,
  positions: (venueId?: string | null, o?: object) => [...rhKeys.all(venueId), 'positions', o ?? {}] as const,
  suggestions: (venueId?: string | null) => [...rhKeys.all(venueId), 'suggestions'] as const,
  assignments: (venueId?: string | null, staffId?: string, page = 0) => [...rhKeys.all(venueId), 'assignments', staffId, page] as const,
  payOverview: (venueId?: string | null, staffId?: string) => [...rhKeys.all(venueId), 'pay-overview', staffId] as const,
}
/**
 * Los «Cómo se le paga hoy» de UNA persona (sin `staffId`: de todas) en TODAS las sedes: el nivel de pago de clase es de la
 * organización, no de la sede.
 */
export const esPayOverviewDe = (staffId?: string) => (q: { queryKey: readonly unknown[] }) =>
  q.queryKey[0] === 'rh' && q.queryKey[2] === 'pay-overview' && (staffId === undefined || q.queryKey[3] === staffId)
const pesado = { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } as const

export function usePositions(o: { includeArchived?: boolean; limit?: number; offset?: number } = {}, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: rhKeys.positions(venueId, o), queryFn: () => rhService.positions(venueId!, o), enabled: !!venueId && enabled, ...pesado })
}
export function usePositionSuggestions(enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: rhKeys.suggestions(venueId), queryFn: () => rhService.suggestions(venueId!), enabled: !!venueId && enabled, ...pesado })
}
export function useStaffAssignments(staffId?: string, page = 0) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: rhKeys.assignments(venueId, staffId, page), queryFn: () => rhService.history(venueId!, staffId!, page), enabled: !!venueId && !!staffId, ...pesado })
}
export function usePayOverview(staffId?: string, enabled = true) {
  const { venueId } = useCurrentVenue()
  return useQuery({ queryKey: rhKeys.payOverview(venueId, staffId), queryFn: () => rhService.payOverview(venueId!, staffId!), enabled: !!venueId && !!staffId && enabled, ...pesado })
}

/**
 * Un puesto nuevo, editado o archivado, o una asignación, cambia lo que leen las pantallas de RH (`['rh', sede]`), la lista
 * del equipo (`['team-members', sede, …]`, que trae `currentAssignments`) y la ficha (`['team-member', sede, miembro]`,
 * TeamId.tsx): se refrescan las tres y sólo de ESTA sede.
 */
function useInvalidarRh() {
  const qc = useQueryClient()
  const { venueId } = useCurrentVenue()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: rhKeys.all(venueId) }),
      qc.invalidateQueries({ queryKey: ['team-members', venueId] }),
      qc.invalidateQueries({ queryKey: ['team-member', venueId] }),
    ])
}
/**
 * Activar, desactivar o dar de baja a una persona cambia cuántas personas vigentes tiene cada puesto (los chips de Personas y
 * `personasVigentes` del catálogo de Puestos, que cuelgan de `['rh', sede]`). Devuelve la función que los refresca.
 */
export function useInvalidarConteosDePuesto() {
  const qc = useQueryClient()
  const { venueId } = useCurrentVenue()
  return () => qc.invalidateQueries({ queryKey: rhKeys.all(venueId) })
}
// Mismo patrón que pago al personal: sin red la mutación queda en pausa y `cancelarEnPausa` la saca de la cola (E6a-fix2 C5).
// Asignar, cambiar y terminar refrescan también al FALLAR (`onSettled`): un 409/400 casi siempre dice que la pantalla está vieja
// (otra pestaña ya cambió la asignación). Una en pausa sólo se asienta cuando por fin se resuelve.
export function useCreatePosition() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarRh()
  const mutationKey = [...rhKeys.all(venueId), 'create-position']
  const mutacion = useMutation({ mutationKey, mutationFn: (b: Parameters<typeof rhService.createPosition>[1]) => rhService.createPosition(venueId!, b), onSuccess: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useUpdatePosition() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarRh()
  const mutationKey = [...rhKeys.all(venueId), 'update-position']
  const mutacion = useMutation({ mutationKey, mutationFn: (v: { id: string; body: Parameters<typeof rhService.updatePosition>[2] }) => rhService.updatePosition(venueId!, v.id, v.body), onSuccess: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useArchivePosition() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarRh()
  const mutationKey = [...rhKeys.all(venueId), 'archive-position']
  const mutacion = useMutation({ mutationKey, mutationFn: (id: string) => rhService.archivePosition(venueId!, id), onSuccess: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useAssignPosition() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarRh()
  const mutationKey = [...rhKeys.all(venueId), 'assign']
  const mutacion = useMutation({ mutationKey, mutationFn: (v: { staffId: string; body: Parameters<typeof rhService.assign>[2] }) => rhService.assign(venueId!, v.staffId, v.body), onSettled: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useChangeAssignment() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarRh()
  const mutationKey = [...rhKeys.all(venueId), 'change']
  const mutacion = useMutation({ mutationKey, mutationFn: (v: { assignmentId: string; body: Parameters<typeof rhService.change>[2] }) => rhService.change(venueId!, v.assignmentId, v.body), onSettled: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
export function useEndAssignment() {
  const { venueId } = useCurrentVenue(); const qc = useQueryClient(); const inv = useInvalidarRh()
  const mutationKey = [...rhKeys.all(venueId), 'end']
  const mutacion = useMutation({ mutationKey, mutationFn: (v: { assignmentId: string; fecha?: string }) => rhService.end(venueId!, v.assignmentId, v.fecha), onSettled: inv })
  return conCancelarEnPausa(mutacion, qc, mutationKey)
}
