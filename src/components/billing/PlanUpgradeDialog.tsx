// src/components/billing/PlanUpgradeDialog.tsx
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getTierDef, salesWhatsAppLink, type TierId } from '@/config/plan-catalog'

export function PlanUpgradeDialog({ tier, onClose }: { tier: TierId | null; onClose: () => void }) {
  const { t } = useTranslation('billing')
  if (!tier) return null
  const def = getTierDef(tier)
  const tierName = t(`plan.tiers.${def.key}.name`)
  const Icon = def.icon

  return (
    <Dialog open={!!tier} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" /> {t('plan.cta.upgrade', { tier: tierName })}
          </DialogTitle>
          <DialogDescription>{t(`plan.tiers.${def.key}.pitch`)}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('plan.assistedBody')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('confirmSubscribe.cancel')}
          </Button>
          <Button asChild className="cursor-pointer">
            <a
              href={salesWhatsAppLink(`Hola, quiero activar el plan ${tierName} de Avoqado para mi negocio.`)}
              target="_blank"
              rel="noreferrer"
            >
              {t('plan.assistedCta')}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
