import { useTranslation } from 'react-i18next'
import { useMasterCatalogError } from '@/features/master-catalog/use-master-catalog-error'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { mensajeDeVariantes } from './errors'
import { useInvalidarCatalogo } from './hooks'

/**
 * El `onError` de toda escritura de familia: primero relee el catálogo (el reintento automático de `src/api.ts` pudo haberla aplicado),
 * luego deja hablar al catálogo maestro y, si no era suyo, avisa con el texto del server en el idioma del dueño.
 * Uso: `onError: alFallar(t('crecer.noAgregadas'))`.
 */
export function useErrorDeEscritura(venueId: string) {
  const { t } = useTranslation('variants')
  const { toast } = useToast()
  const { venue } = useCurrentVenue()
  const handleMasterCatalogError = useMasterCatalogError(venue?.organizationId)
  const invalidar = useInvalidarCatalogo()
  return (titulo: string) => (error: unknown) => {
    void invalidar(venueId)
    if (handleMasterCatalogError(error)) return
    toast({ variant: 'destructive', title: titulo, description: mensajeDeVariantes(error, t) })
  }
}
