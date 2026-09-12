import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { apiErrorDescription } from '@/utils/apiError'
import {
  receiptLayoutService,
  type PaperMm,
  type ReceiptBlock,
  type ReceiptLayoutRead,
  type ReceiptLayoutResponse,
  type SampleSale,
} from '@/services/receiptLayout.service'

/**
 * 🔴 La clave SIEMPRE lleva el venueId. Fue un defecto real de esta casa: invalidar
 * `['order', orderId]` cuando la clave era `['order', venueId, orderId]` **no da error, no
 * avisa, simplemente no hace nada** — y el cajero siguió viendo un total viejo. Aquí el mismo
 * descuido dejaría al dueño mirando el diseño anterior, creyendo que no se guardó.
 */
const layoutKey = (venueId: string) => ['receipt-layout', venueId] as const
const templatesKey = (venueId: string) => ['receipt-layout-templates', venueId] as const

export function useReceiptLayout(venueId: string) {
  return useQuery({
    queryKey: layoutKey(venueId),
    queryFn: () => receiptLayoutService.get(venueId),
    enabled: Boolean(venueId),
  })
}

export function useReceiptTemplates(venueId: string, enabled = true) {
  return useQuery({
    queryKey: templatesKey(venueId),
    queryFn: () => receiptLayoutService.templates(venueId),
    enabled: Boolean(venueId) && enabled,
    // Las plantillas viven en código del servidor: no cambian entre sesiones.
    staleTime: Infinity,
  })
}

/**
 * 🔴 Fusiona la respuesta de una ESCRITURA sobre lo que ya había en la caché.
 *
 * El GET devuelve `readiness` y `devices`; el PUT y el DELETE devuelven la receta pelona.
 * Reemplazar la entrada con la respuesta de un guardado borraría los dos avisos honestos justo
 * después de tocar el ticket: el dueño dejaría de ver que le falta el RFC exactamente en el
 * momento en que más le importa.
 */
function fusionar(qc: ReturnType<typeof useQueryClient>, venueId: string) {
  return (escrito: ReceiptLayoutRead) =>
    qc.setQueryData(layoutKey(venueId), (prev: ReceiptLayoutResponse | undefined) => (prev ? { ...prev, ...escrito } : undefined))
}

interface ErrorDeApi {
  response?: { status?: number; data?: { code?: string; details?: { currentRevision?: number; updatedByName?: string } } }
}

export interface ConflictoDeRevision {
  /** Quién guardó por debajo. Puede faltar (servidor viejo, o no se pudo resolver el nombre). */
  quien?: string
  revisionActual?: number
}

/** `null` si el error NO es un conflicto de revisión. Pura: la usan el hook y el diseñador. */
export function leerConflicto(error: unknown): ConflictoDeRevision | null {
  const e = error as ErrorDeApi
  if (e?.response?.status !== 409) return null
  const details = e.response.data?.details
  return { quien: details?.updatedByName, revisionActual: details?.currentRevision }
}

/** Qué hacer con un conflicto: decir QUIÉN guardó y releer lo que hay guardado. */
function useConflictHandler(venueId: string) {
  const qc = useQueryClient()
  // 🔴 Namespace PROPIO. Con `useTranslation()` pelón estas claves se buscaban en el namespace por
  // defecto y el dueño veía «receiptLayout.errors.staleTitle» en rojo — justo en el aviso más
  // importante de la pantalla. Lo cazó /full-testing contra el servidor real el 12-sep; las pruebas
  // con `t` simulado no podían verlo.
  const { t } = useTranslation('receiptLayout')
  const { toast } = useToast()

  return (error: unknown) => {
    const conflicto = leerConflicto(error)
    if (conflicto) {
      toast({
        title: t('errors.staleTitle'),
        // Con nombre el dueño sabe a quién preguntarle qué cambió; sin él, sólo que recargue.
        description: conflicto.quien ? t('errors.staleByName', { name: conflicto.quien }) : t('errors.staleAnonymous'),
        variant: 'destructive',
      })
      // 🔴 No se reintenta en silencio: reintentar sería volver a «el último que guarda gana»,
      // que es justo el defecto que el CAS del servidor existe para impedir.
      void qc.invalidateQueries({ queryKey: layoutKey(venueId) })
      return
    }
    toast({
      title: t('errors.saveFailed'),
      description: apiErrorDescription(error) || t('errors.retry'),
      variant: 'destructive',
    })
  }
}

/**
 * Relee lo guardado AHORA, sin esperar a la caché. Es la salida del conflicto: el diseñador la llama
 * cuando el dueño elige «Recargar lo guardado», y reemplaza bloques y revisión con lo que devuelve.
 */
export function useReloadReceiptLayout(venueId: string) {
  const qc = useQueryClient()
  return () => qc.fetchQuery({ queryKey: layoutKey(venueId), queryFn: () => receiptLayoutService.get(venueId), staleTime: 0 })
}

export function useSaveReceiptLayout(venueId: string) {
  const qc = useQueryClient()
  const onError = useConflictHandler(venueId)
  return useMutation({
    mutationFn: ({ blocks, expectedRevision }: { blocks: ReceiptBlock[]; expectedRevision: number }) =>
      receiptLayoutService.save(venueId, blocks, expectedRevision),
    onSuccess: fusionar(qc, venueId),
    onError,
  })
}

export function useResetReceiptLayout(venueId: string) {
  const qc = useQueryClient()
  const onError = useConflictHandler(venueId)
  return useMutation({
    mutationFn: (expectedRevision: number) => receiptLayoutService.reset(venueId, expectedRevision),
    onSuccess: fusionar(qc, venueId),
    onError,
  })
}

/**
 * La vista previa la dibuja el SERVIDOR, con el MISMO intérprete que van a usar las apps.
 * El dashboard no lo reimplementa: si lo hiciera, la vista previa podría divergir del papel —
 * y es lo único que la hace útil.
 *
 * 🔴 Con debounce de 400 ms (spec § 8) y conservando el papel anterior mientras llega el nuevo:
 * sin lo primero cada tecla del texto libre dispara un POST; sin lo segundo el papel parpadea
 * en blanco con cada pulsación.
 */
export function useReceiptPreview(venueId: string, blocks: ReceiptBlock[], paperMm: PaperMm, sample: SampleSale) {
  const serializado = JSON.stringify(blocks)
  const debounced = useDebounce(serializado, 400)

  return useQuery({
    queryKey: ['receipt-layout-preview', venueId, debounced, paperMm, sample] as const,
    queryFn: () => receiptLayoutService.preview(venueId, JSON.parse(debounced) as ReceiptBlock[], paperMm, sample),
    // 🔴 Se enciende con lo que VA A MANDAR (el debounce), no con los bloques vivos: al cargar,
    // los vivos ya traen el ticket y el debounce todavía es `[]` — y el servidor responde 400 a
    // una lista vacía. Pasaba en CADA entrada a la pantalla (/full-testing, 12-sep).
    enabled: Boolean(venueId) && debounced !== '[]',
    placeholderData: previa => previa,
    // Un layout inválido responde 400: reintentarlo tres veces no lo vuelve válido.
    retry: false,
  })
}

/** `true` mientras lo que se ve en el papel no corresponde todavía a lo que hay en la lista. */
export function usePreviewIsStale(blocks: ReceiptBlock[]) {
  const serializado = JSON.stringify(blocks)
  return useDebounce(serializado, 400) !== serializado
}
