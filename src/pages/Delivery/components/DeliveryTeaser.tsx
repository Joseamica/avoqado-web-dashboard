import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bike, CheckCircle2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RequestActivationDialog } from './RequestActivationDialog'

/** Brand names shown as pills — hardcoded, not translated (real trademarks). */
const CHANNEL_BRANDS = ['Uber Eats', 'Rappi', 'DiDi Food']

interface DeliveryTeaserProps {
  venueId: string
}

/**
 * TEASER state: PREMIUM but no activation request yet. Honest sales pitch (delivery isn't live
 * for anyone yet — Deliverect staging is still pending, design spec §1) + self-serve
 * "Solicitar activación" CTA that opens {@link RequestActivationDialog}.
 */
export function DeliveryTeaser({ venueId }: DeliveryTeaserProps) {
  const { t } = useTranslation('delivery')
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Bike className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t('teaser.title')}</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('teaser.description')}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {CHANNEL_BRANDS.map(brand => (
            <span key={brand} className="rounded-full border border-input bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {brand}
            </span>
          ))}
        </div>

        <ul className="w-full max-w-sm space-y-2 text-left text-sm text-muted-foreground">
          {[t('teaser.benefit1'), t('teaser.benefit2'), t('teaser.benefit3')].map(benefit => (
            <li key={benefit} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <Button onClick={() => setDialogOpen(true)}>{t('teaser.cta')}</Button>
      </CardContent>

      <RequestActivationDialog venueId={venueId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  )
}
