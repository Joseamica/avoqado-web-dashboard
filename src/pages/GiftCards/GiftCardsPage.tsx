import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Loader2, WalletCards } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { GIFT_CARDS_FEATURE, useGiftCardSettings } from '@/hooks/use-gift-cards'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import type { GiftCardNotSellableReason } from '@/types/giftCard'
import { GiftCardsList } from './components/GiftCardsList'
import { GiftCardsTeaser } from './components/GiftCardsTeaser'
import { motivoSinVenta, textoDelServidorConCodigo } from './giftCardText'
import { decidirVista } from './vista'

/** «Apagado se ve y se explica»: por qué hoy no se venden tarjetas nuevas (lo vendido siempre se cobra). */
function AvisoDeVenta({ motivo, canManage, settingsHref }: { motivo: GiftCardNotSellableReason | null; canManage: boolean; settingsHref: string }) {
  const { t } = useTranslation('giftCards')
  if (!motivo) return null
  return (
    <Alert className="border-input bg-muted/40" data-tour="gift-cards-notice">
      <Info className="h-4 w-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{t(`notice.${motivo}`)}</span>
        {canManage && motivo !== 'KEYS_MISSING' && (
          <Button asChild variant="outline" size="sm">
            <Link to={settingsHref}>{t('notice.goToSettings')}</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Clientes › Tarjetas de regalo. El plan se decide AQUÍ dentro (convención vigente: `FeatureProtectedRoute` no gatea por
 * plan, T3): sin plan y sin tarjetas nunca vendidas ⇒ el cartel de Pro sobre un teaser; con tarjetas (aunque esté apagado
 * o sin plan) ⇒ la lista con el aviso de por qué no se venden nuevas. Ver saldos e historial nunca se esconde (spec §6).
 * Con los ajustes ya cargados, una relectura fallida no cambia la vista (se usan los que hay); el aviso de error sale sólo
 * si nunca llegaron. Un error sin `code` dice el texto genérico (notas 10 y 12 del coordinador).
 */
export default function GiftCardsPage() {
  const { t } = useTranslation('giftCards')
  const { venueId, fullBasePath } = useCurrentVenue()
  const { can } = useAccess()
  const canManage = can('giftCards:manage')
  const settings = useGiftCardSettings(venueId ?? undefined)
  const tier = useTierFeatureAccess(GIFT_CARDS_FEATURE)
  const vista = decidirVista({
    settings: settings.data,
    settingsLoading: settings.isLoading,
    tierLoading: tier.isLoading,
    tierResolved: tier.isResolved,
    hasAccess: tier.hasAccess,
  })
  const settingsHref = `${fullBasePath}/settings/gift-cards`

  return (
    <div className="space-y-4 p-6" data-tour="gift-cards-page">
      <div>
        <PageTitleWithInfo title={t('page.title')} className="text-2xl font-bold text-foreground" tooltip={t('page.info')} />
        <p className="mt-1 text-muted-foreground">{t('page.subtitle')}</p>
      </div>

      {settings.isError && !settings.data && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('page.settingsError')}</AlertTitle>
          <AlertDescription>{textoDelServidorConCodigo(settings.error) ?? t('errors.generic')}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="col-start-2 mt-2 justify-self-start"
            onClick={() => void settings.refetch()}
            disabled={settings.isFetching}
          >
            {t('page.retry')}
          </Button>
        </Alert>
      )}

      {!venueId || vista === 'cargando' ? (
        <div className="flex items-center justify-center py-16" role="status" aria-label={t('page.loading')}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vista === 'cartel' ? (
        <FeatureGate feature={GIFT_CARDS_FEATURE}>
          <GiftCardsTeaser />
        </FeatureGate>
      ) : vista === 'prender' ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-muted/30 px-6 py-16 text-center"
          data-tour="gift-cards-turn-on"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <WalletCards className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t('turnOn.title')}</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('turnOn.body')}</p>
          {canManage ? (
            <Button asChild className="mt-4" data-tour="gift-cards-turn-on-cta">
              <Link to={settingsHref}>{t('turnOn.cta')}</Link>
            </Button>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">{t('turnOn.askOwner')}</p>
          )}
        </div>
      ) : (
        <>
          {settings.data && (
            <AvisoDeVenta
              motivo={motivoSinVenta(settings.data, { resolved: tier.isResolved, hasAccess: tier.hasAccess })}
              canManage={canManage}
              settingsHref={settingsHref}
            />
          )}
          <GiftCardsList key={venueId} venueId={venueId} />
        </>
      )}
    </div>
  )
}
