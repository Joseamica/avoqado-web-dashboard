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
 *  - un solo envío en vuelo (un doble clic no manda dos);
 *  - el aviso honesto cuando no se sabe si se registró (`ambiguous`);
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
  const [ambiguous, setAmbiguous] = useState(false)

  const mutation = useMutation({
    mutationFn: (payload: WasteAdjustment<T>) => send(payload),
    onSuccess: response => {
      if (venueId && target) invalidateWasteQueries(queryClient, venueId, target)
      const waste = readWasteSummary(response.data)
      const unrecorded = waste ? Number(waste.unrecorded) : 0
      toast({
        title: t('waste.logged'),
        description:
          waste && unrecorded > 0
            ? t('waste.loggedWithUnrecorded', {
                quantity: formatWasteQuantity(waste.unrecorded, getIntlLocale(i18n.language)),
                unit: formatUnitWithQuantity(unrecorded, target?.unit ?? ''),
              })
            : t('waste.loggedDesc'),
      })
      setAmbiguous(false)
      onSuccess()
    },
    onError: (error: unknown) => {
      setAmbiguous(isAmbiguousWasteFailure(error))
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
      mutate(buildWasteAdjustment(type, input, keyState.current.key))
    },
    [venueId, target, type, mutate],
  )

  /** Al abrir el formulario otra vez: folio nuevo y sin aviso pendiente. */
  const restart = useCallback(() => {
    keyState.current = initialWasteKeyState()
    inFlight.current = false
    setAmbiguous(false)
  }, [])

  return { submit, restart, isPending: mutation.isPending, ambiguous }
}
