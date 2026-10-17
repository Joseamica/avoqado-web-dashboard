import { AlertTriangle, Loader2, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { GIFT_CARDS_FEATURE, useGiftCardSettings } from '@/hooks/use-gift-cards'
import { textoDelServidorConCodigo } from '@/pages/GiftCards/giftCardText'
import { GiftCardRulesForm } from './components/giftCards/GiftCardRulesForm'
import { GiftCardsSwitch } from './components/giftCards/GiftCardsSwitch'

/**
 * Configuración › Tarjetas de regalo: el switch canónico (apagado de fábrica, spec §9), las reglas de venta y los términos
 * que se aceptan al prender.
 *
 * El plan (Pro) se decide AQUÍ dentro, como en Pases: apagado, todo va dentro de <FeatureGate> (sin plan se ve borroso con
 * el cartel; con plan pasa directo). Prendido, la página NUNCA se esconde: si bajó de plan, el switch explica y deja
 * apagar («apagado se ve y se explica»). Sin datos todavía (cargando o con error) no se decide el cartel. Sin
 * `giftCards:manage` todo se ve en sólo lectura.
 */
export default function GiftCardSettings() {
  const { t } = useTranslation('giftCards')
  const { venueId } = useCurrentVenue()
  const { can } = useAccess()
  const canManage = can('giftCards:manage')
  const settings = useGiftCardSettings(venueId ?? undefined)
  const data = settings.data

  const page = (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6" data-tour="gift-card-settings-page">
      <div>
        <PageTitleWithInfo title={t('settings.title')} className="text-2xl font-bold text-foreground" tooltip={t('settings.info')} />
        <p className="mt-1 text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {!canManage && (
        <Alert className="border-input bg-muted/40">
          <AlertDescription className="text-sm text-muted-foreground">{t('settings.readOnly')}</AlertDescription>
        </Alert>
      )}

      {settings.isLoading || !venueId ? (
        <div className="flex items-center justify-center py-16" role="status" aria-label={t('page.loading')}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : settings.isError || !data ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('settings.loadError')}</AlertTitle>
          {/* Sólo el texto de un error CON `code` (nota 12): un 401/500 sin código llega en inglés. */}
          <AlertDescription>{textoDelServidorConCodigo(settings.error) ?? t('errors.generic')}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="col-start-2 mt-2 justify-self-start"
            onClick={() => void settings.refetch()}
            disabled={settings.isFetching}
            data-tour="gift-card-settings-retry"
          >
            {t('page.retry')}
          </Button>
        </Alert>
      ) : (
        <>
          {/* key: el diálogo abierto o el borrador no cruzan a otra sucursal (cambiar de sucursal no desmonta la ruta). */}
          <GiftCardsSwitch key={`switch-${venueId}`} venueId={venueId} settings={data} canManage={canManage} />
          <GiftCardRulesForm key={`rules-${venueId}`} venueId={venueId} settings={data} canManage={canManage} />
          <div className="rounded-2xl border border-input bg-card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              {t('settings.howTitle')}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>{t('settings.how.sell')}</li>
              <li>{t('settings.how.pay')}</li>
              <li>{t('settings.how.noCash')}</li>
              <li>{t('settings.how.invoice')}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )

  return data && !data.enabled ? <FeatureGate feature={GIFT_CARDS_FEATURE}>{page}</FeatureGate> : page
}
