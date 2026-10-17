import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, WalletCards } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { LegalConsentCheckbox } from '@/components/legal/LegalConsentCheckbox'
import { GIFT_CARDS_FEATURE, useUpdateGiftCardSettings } from '@/hooks/use-gift-cards'
import { planTierQueryKey, useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import { textoDelServidorConCodigo } from '@/pages/GiftCards/giftCardText'
import type { GiftCardSettingsView } from '@/types/giftCard'

/**
 * El switch canónico de tarjetas de regalo (spec §9). Molde: CashReconciliationSetting.
 * - Prender exige el plan COMPROBADO (`isResolved && hasAccess`), nunca el fail-open del gate, y aceptar las reglas: un
 *   diálogo con las reglas en lenguaje llano y la casilla de Términos; viaja `aceptaTerminos: true` (contrato de A5: sin
 *   eso el server responde 400 GIFT_CARD_TERMS_REQUIRED y guarda la versión vigente de los términos al prender).
 * - Apagar también confirma y explica que lo vendido se sigue cobrando (cobrar con saldo nunca se apaga, spec §6).
 * - Prendido y sin plan (bajó de plan) se ve, se explica y se puede apagar: «apagado se ve y se explica».
 * - `enabled` viaja SÓLO desde aquí (nota 6): el server pide el plan sólo al prender; guardar montos va sin él.
 * - No es optimista: el switch refleja lo GUARDADO. Candado síncrono (`useRef`): dos clics en «Prender» no mandan dos PUT.
 * - Si la consulta del plan FALLÓ (sin resolver y sin cargar: el gate hace fail-open), apagado no se queda muerto sin
 *   explicar: lo dice y deja volver a pedir el plan (lote ⭐).
 */
export function GiftCardsSwitch({ venueId, settings, canManage }: { venueId: string; settings: GiftCardSettingsView; canManage: boolean }) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const { hasAccess, isResolved, isLoading } = useTierFeatureAccess(GIFT_CARDS_FEATURE)
  const update = useUpdateGiftCardSettings(venueId)
  const queryClient = useQueryClient()
  const [dialogo, setDialogo] = useState<'prender' | 'apagar' | null>(null)
  const [acepta, setAcepta] = useState(false)
  const enVuelo = useRef(false)
  const planComprobado = isResolved && hasAccess
  const prendido = settings.enabled
  const planSinConfirmar = !prendido && canManage && !isResolved && !isLoading

  const guardar = async (prender: boolean) => {
    if (enVuelo.current) return
    enVuelo.current = true
    try {
      await update.mutateAsync(prender ? { enabled: true, aceptaTerminos: true } : { enabled: false })
      toast({ title: t(prender ? 'settings.switch.onToast' : 'settings.switch.offToast') })
      setDialogo(null)
      setAcepta(false)
    } catch (err) {
      // Sólo el texto de un error CON `code` (nota 12): un 401/500 sin código llega en inglés.
      toast({
        title: t('settings.switch.errorTitle'),
        description: textoDelServidorConCodigo(err) ?? t('errors.generic'),
        variant: 'destructive',
      })
    } finally {
      enVuelo.current = false
    }
  }

  const alCambiar = (prender: boolean) => {
    if (!canManage || update.isPending) return
    if (prender && !planComprobado) return
    setAcepta(false)
    setDialogo(prender ? 'prender' : 'apagar')
  }

  const cerrarDialogo = (abierto: boolean) => {
    if (!abierto && !update.isPending) setDialogo(null)
  }

  return (
    <div data-tour="gift-cards-switch" className="rounded-2xl border border-input bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <WalletCards className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{t('settings.switch.title')}</p>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 px-2 py-0 text-[10px] text-primary">
                {t('settings.switch.proBadge')}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(prendido ? 'settings.switch.onDescription' : 'settings.switch.offDescription')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {(update.isPending || isLoading) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={prendido}
            onCheckedChange={alCambiar}
            disabled={!canManage || update.isPending || (!prendido && !planComprobado)}
            aria-label={t('settings.switch.label')}
          />
        </div>
      </div>

      {planSinConfirmar && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-input pt-3">
          <p className="text-xs leading-relaxed text-warning-foreground">{t('settings.switch.planUnknown')}</p>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => void queryClient.invalidateQueries({ queryKey: planTierQueryKey(venueId) })}
            data-tour="gift-cards-plan-retry"
          >
            {t('settings.switch.planRetry')}
          </Button>
        </div>
      )}
      {prendido && isResolved && !hasAccess && (
        <p className="mt-3 border-t border-input pt-3 text-xs leading-relaxed text-warning-foreground">{t('settings.switch.downgraded')}</p>
      )}
      {prendido && !settings.llavesConfiguradas && (
        <p className="mt-3 border-t border-input pt-3 text-xs leading-relaxed text-warning-foreground">{t('notice.KEYS_MISSING')}</p>
      )}

      <AlertDialog open={dialogo === 'prender'} onOpenChange={cerrarDialogo}>
        <AlertDialogContent data-tour="gift-cards-activate-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activate.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('activate.intro')}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
            <li>{t('activate.rules.debt')}</li>
            <li>{t('activate.rules.noCash')}</li>
            <li>{t('activate.rules.limits')}</li>
            <li>{t('activate.rules.invoice')}</li>
            <li>{t('activate.rules.cancel')}</li>
          </ul>
          <LegalConsentCheckbox id="gift-cards-consent" checked={acepta} onCheckedChange={setAcepta} disabled={update.isPending} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>{t('activate.cancel')}</AlertDialogCancel>
            <Button onClick={() => void guardar(true)} disabled={!acepta || update.isPending} data-tour="gift-cards-activate-confirm">
              {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('activate.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogo === 'apagar'} onOpenChange={cerrarDialogo}>
        <AlertDialogContent data-tour="gift-cards-deactivate-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deactivate.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deactivate.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>{t('deactivate.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void guardar(false)}
              disabled={update.isPending}
              data-tour="gift-cards-deactivate-confirm"
            >
              {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('deactivate.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
