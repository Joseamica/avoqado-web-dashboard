import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FeatureGate } from '@/components/billing/FeatureGate'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDeliveryStatus } from '@/hooks/use-delivery-status'
import { ImpresionDelCanalEditor } from '@/pages/Delivery/components/ImpresionDelCanalEditor'

/**
 * Pestaña «Delivery» de Impresoras: la segunda puerta del mismo editor que vive en los ajustes de cada canal.
 * Lee los canales con el hook de la página de Delivery (['deliveryChannels', venueId]) para que guardar en una puerta refresque la otra.
 */
export function DeliveryPrintingTab({ venueId }: { venueId: string }) {
  const { t } = useTranslation('delivery')
  const { can } = useAccess()
  const { fullBasePath } = useCurrentVenue()
  const { channels, isLoading } = useDeliveryStatus(venueId)
  const conectados = channels.filter(c => c.status !== 'DISABLED')

  return (
    <FeatureGate feature="DELIVERY_CHANNELS">
      {isLoading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      ) : conectados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('impresion.tab.sinCanales')}{' '}
          <Link className="underline" to={`${fullBasePath}/delivery`}>
            {t('impresion.tab.irADelivery')}
          </Link>
        </p>
      ) : (
        <div className="space-y-6">
          {conectados.map(c => (
            <ImpresionDelCanalEditor key={c.id} venueId={venueId} channel={c} canEdit={can('delivery-channels:manage')} />
          ))}
        </div>
      )}
    </FeatureGate>
  )
}
