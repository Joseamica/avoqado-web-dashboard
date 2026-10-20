import { CheckCircle2, Circle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { tieneAvisoPublicado } from '@/lib/privacy-notice'
import { PrivacyNoticeModal } from '@/pages/Customers/components/PrivacyNoticeModal'
import marketingService from '@/services/marketing.service'
import { useVenueDateTime } from '@/utils/datetime'

import { useVenueEditActions } from '../VenueEditLayout'

const USES = ['customers', 'campaigns', 'onlineOrdering'] as const

/**
 * La casa del aviso de privacidad: es UNO por negocio (la LFPDPPP hace responsable al negocio) y aquí se abre el MISMO editor que en
 * Clientes y en Pedidos en línea, con el mismo historial de versiones. Lee la misma llave que el editor (`['privacy-notice', venueId]`):
 * al publicar, el editor la invalida y esta pestaña se actualiza sola.
 */
export default function PrivacyNotice() {
  const { t } = useTranslation('venue')
  const { venueId } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()
  const [editorOpen, setEditorOpen] = useState(false)
  // La cabecera de VenueEditLayout es compartida y las pestañas hermanas no la limpian al salir: aquí no hay nada que guardar
  // arriba (el editor guarda solo), así que se vacía al entrar, o se vería el «Guardar» de la pestaña anterior. Con llaves: lo que
  // devolviera `setActions` lo tomaría React como función de limpieza.
  const { setActions } = useVenueEditActions()
  useEffect(() => {
    setActions({})
  }, [setActions])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['privacy-notice', venueId],
    queryFn: () => marketingService.getPrivacyNotice(venueId!),
    enabled: !!venueId,
  })
  const notice = data?.notice ?? null
  const published = tieneAvisoPublicado(notice)

  return (
    <div className="max-w-3xl mx-auto pt-6 pb-20 px-4 md:px-6 lg:px-8 space-y-4">
      <Card className="border-input">
        <CardHeader>
          <CardTitle>{t('edit.privacy.title')}</CardTitle>
          <CardDescription>{t('edit.privacy.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading || !venueId ? (
            <Skeleton className="h-5 w-72" />
          ) : isError ? (
            <p className="text-sm text-destructive">{t('edit.privacy.loadFailed')}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm">
              {published ? (
                // `text-success` no se genera: el @theme no registra --color-success (sólo la variable --success).
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-(--success)" />
              ) : (
                <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              {published ? t('edit.privacy.published', { date: formatDate(notice?.createdAt) }) : t('edit.privacy.notPublished')}
            </p>
          )}

          <div className="space-y-1 text-sm">
            <p className="font-medium">{t('edit.privacy.usedFor')}</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {USES.map(use => (
                <li key={use}>{t(`edit.privacy.uses.${use}`)}</li>
              ))}
            </ul>
          </div>

          <Button
            type="button"
            className="cursor-pointer"
            disabled={!venueId || isLoading}
            onClick={() => setEditorOpen(true)}
            data-tour="venue-privacy-notice-btn"
          >
            {published ? t('edit.privacy.edit') : t('edit.privacy.write')}
          </Button>
        </CardContent>
      </Card>

      {venueId && <PrivacyNoticeModal venueId={venueId} open={editorOpen} onClose={() => setEditorOpen(false)} />}
    </div>
  )
}
