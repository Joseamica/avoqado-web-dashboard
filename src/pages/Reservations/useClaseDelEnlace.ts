import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import classSessionService from '@/services/classSession.service'

/** Forma de un id de clase (cuid, como lo valida el server): con otra forma ni se pide. */
const PARECE_ID = /^c[^\s-]{8,}$/i

/**
 * `?clase=<id>` abre esa clase (p. ej. «Abrir la clase» de una diferencia de pago por servicio). La clase se pide ANTES de
 * abrir el diálogo, con la misma llave que él (así no la vuelve a esperar): si no carga (borrada, de otra sede), un aviso
 * en vez de un diálogo vacío; un id sin forma de id se ignora. El parámetro se quita siempre (atrás no la reabre).
 */
export function useClaseDelEnlace(venueId: string | null, abrir: (id: string) => void) {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const { t } = useTranslation('reservations')
  const { toast } = useToast()
  const id = params.get('clase')
  const hecho = useRef<string | null>(null)
  useEffect(() => {
    if (!id || !venueId || hecho.current === id) return
    hecho.current = id
    setParams(
      prev => {
        const sp = new URLSearchParams(prev)
        sp.delete('clase')
        return sp
      },
      { replace: true },
    )
    if (!PARECE_ID.test(id)) return
    qc.fetchQuery({ queryKey: ['class-session', venueId, id], queryFn: () => classSessionService.getClassSession(venueId, id) })
      .then(() => abrir(id))
      .catch(() => toast({ title: t('classSession.linkNotFound'), variant: 'destructive' }))
  }, [id, venueId, setParams, qc, t, toast, abrir])
}
