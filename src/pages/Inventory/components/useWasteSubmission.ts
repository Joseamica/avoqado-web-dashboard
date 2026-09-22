import { useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { getIntlLocale } from '@/utils/i18n-locale'
import { invalidateWasteQueries } from '@/lib/queryKeys/inventory'
import {
  buildWasteAdjustment,
  formatWasteQuantity,
  initialWasteKeyState,
  isAmbiguousWasteFailure,
  keyForSubmission,
  readWasteSummary,
  wasteErrorKey,
  wasteFingerprint,
  type WasteAdjustment,
  type WasteFormInput,
  type WasteKeyState,
} from '@/lib/inventoryWaste'

interface WasteTarget {
  kind: 'product' | 'ingredient'
  id: string
  unit: string
}

interface UseWasteSubmissionOptions<T extends 'SPOILAGE' | 'LOSS'> {
  venueId: string | null
  target: WasteTarget | null
  type: T
  send: (payload: WasteAdjustment<T>) => Promise<{ data: unknown }>
  onSuccess: () => void
}

/**
 * Envío de una merma desde un diálogo del dashboard. Concentra lo que los tres diálogos comparten:
 *  - el FOLIO: mismo contenido ⇒ mismo folio (el servidor reconoce el reintento, también el que
 *    `src/api.ts` hace solo ante un error de red); contenido distinto ⇒ folio nuevo;
 *  - un éxito CONFIRMADO gasta el folio aquí mismo, sin depender de que el diálogo llame `restart`:
 *    otra merma real idéntica (otro kilo de lo mismo al día siguiente) nunca pasa por reintento;
 *  - un solo envío en vuelo (un doble clic no manda dos);
 *  - el aviso honesto cuando no se sabe si se registró (`ambiguous`), que sobrevive a cerrar y
 *    reabrir el diálogo del MISMO artículo junto con su folio;
 *  - refrescar existencias, Historial y la lista de mermas.
 */
export function useWasteSubmission<T extends 'SPOILAGE' | 'LOSS'>({ venueId, target, type, send, onSuccess }: UseWasteSubmissionOptions<T>) {
  const { t, i18n } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnitWithQuantity } = useUnitTranslation()
  const keyState = useRef<WasteKeyState>(initialWasteKeyState())
  const inFlight = useRef(false)
  /**
   * Negocio y artículo del ÚLTIMO envío: el diálogo puede cambiar de artículo antes de que llegue la
   * respuesta, y la respuesta habla del enviado (refrescar, unidad del aviso, a quién se le marca la duda).
   */
  const sent = useRef<{ venueId: string; target: WasteTarget } | null>(null)
  /** Artículo cuyo último envío quedó SIN CONFIRMAR (red o 5xx), o null. `restart` lo lee. */
  const ambiguousItem = useRef<string | null>(null)
  const [ambiguousFor, setAmbiguousFor] = useState<string | null>(null)
  const markAmbiguous = useCallback((itemId: string | null) => {
    ambiguousItem.current = itemId
    setAmbiguousFor(itemId)
  }, [])

  const mutation = useMutation({
    mutationFn: (payload: WasteAdjustment<T>) => send(payload),
    onSuccess: response => {
      // Registrada de verdad: este folio ya no puede volver a viajar con otra merma.
      keyState.current = initialWasteKeyState()
      const sentTarget = sent.current?.target ?? null
      if (sent.current) invalidateWasteQueries(queryClient, sent.current.venueId, sent.current.target)
      const waste = readWasteSummary(response.data)
      const unrecorded = waste ? Number(waste.unrecorded) : 0
      toast({
        title: t('waste.logged'),
        description:
          waste && unrecorded > 0
            ? t('waste.loggedWithUnrecorded', {
                quantity: formatWasteQuantity(waste.unrecorded, getIntlLocale(i18n.language)),
                unit: formatUnitWithQuantity(unrecorded, sentTarget?.unit ?? ''),
              })
            : t('waste.loggedDesc'),
      })
      markAmbiguous(null)
      onSuccess()
    },
    onError: (error: unknown) => {
      markAmbiguous(isAmbiguousWasteFailure(error) ? (sent.current?.target.id ?? null) : null)
      const key = wasteErrorKey(error)
      const serverMessage = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message
      toast({
        title: tCommon('error'),
        description: key ? t(key) : typeof serverMessage === 'string' && serverMessage ? serverMessage : t('waste.errorLogging'),
        variant: 'destructive',
      })
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  const { mutate } = mutation

  const submit = useCallback(
    (input: WasteFormInput) => {
      if (!venueId || !target || inFlight.current) return
      keyState.current = keyForSubmission(keyState.current, wasteFingerprint(target.id, input))
      inFlight.current = true
      sent.current = { venueId, target }
      mutate(buildWasteAdjustment(type, input, keyState.current.key))
    },
    [venueId, target, type, mutate],
  )

  /**
   * Al abrir el formulario otra vez. Si hay un envío EN VUELO o el último quedó SIN CONFIRMAR, no se
   * toca nada — folio, huella, aviso ni el candado de envío: el servidor pudo haberla registrado (o
   * estar registrándola), y volver a capturar lo mismo tiene que ser el reintento que el aviso
   * promete, no una segunda merma. El desenlace lo deciden `onSuccess` / `onError` / `onSettled`.
   * Lo distinto sigue estrenando folio (`keyForSubmission` compara la huella, que incluye el
   * artículo). En cualquier otro caso: folio nuevo y sin aviso.
   */
  const restart = useCallback(() => {
    if (inFlight.current || ambiguousItem.current !== null) return
    keyState.current = initialWasteKeyState()
    markAmbiguous(null)
  }, [markAmbiguous])

  // El aviso habla del artículo que quedó sin confirmar: abrir OTRO artículo no lo muestra.
  const ambiguous = ambiguousFor !== null && ambiguousFor === target?.id

  return { submit, restart, isPending: mutation.isPending, ambiguous }
}
