/**
 * Máquina de efectivo · fase 1a: lo que el menú necesita saber de los «Cobros de la máquina en duda» sin cargar la página.
 * Vive aparte de la página (que es diferida) para que el menú no arrastre la ventana de resolver.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/api'

/** Raíz de las llaves de las dudas de un negocio: la lista de la página y el conteo del menú cuelgan de ella, así que invalidarla
 *  al resolver refresca las dos. */
export const cashMachineDoubtsKey = (venueId: string) => ['cash-machine-doubts', venueId]

/**
 * ¿Hay cobros de la máquina en duda ABIERTOS? Decide si la entrada sale en el menú (la ruta sigue abierta por URL). El SERVIDOR no
 * expone otra señal de que el negocio tenga máquina (los emparejamientos no salen al panel), así que se pide sólo el `total` de la
 * lista con `limit=1`, a lo más cada 5 min. Sin permiso o sin negocio no pregunta; un error deja la entrada escondida.
 * Sin `kind`, esa MISMA lista cuenta también las incidencias abiertas que no son duda (imposible, conflicto, sin registrar, tras
 * desemparejar, Codex r1 #7) y los folios por terminar (`POR_TERMINAR`, H5 del SERVIDOR): también piden al gerente, así que el
 * total ya los incluye sin otra consulta (el SERVIDOR sólo filtra por `kind` si se lo piden).
 */
export function useHasOpenCashMachineDoubts(venueId: string | undefined, enabled: boolean): boolean {
  const { data } = useQuery({
    queryKey: [...cashMachineDoubtsKey(venueId ?? ''), 'menu'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/cash-machine/doubts`, { params: { status: 'ABIERTO', limit: 1 } })
      return Number(res.data?.total ?? 0)
    },
    enabled: !!venueId && enabled,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return (data ?? 0) > 0
}
