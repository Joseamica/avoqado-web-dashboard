import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Loader2, PlayCircle, ShieldCheck } from 'lucide-react'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  getMerchantRoutingRules,
  previewMerchantEligibility,
  type EligibilityPreview,
} from '@/services/merchantRouting.service'
import { MerchantRuleCard } from './components/MerchantRuleCard'

/**
 * Reglas de cuentas de cobro (MERCHANT_ROUTING_RULES, PREMIUM).
 * El admin configura cuándo aparece cada cuenta en la TPV; incluye simulador
 * que usa EXACTAMENTE el mismo motor del server que usa la terminal.
 */
export default function MerchantRoutingRules() {
  const { t } = useTranslation('merchantRouting')
  const { venueId } = useCurrentVenue()

  const { data, isLoading } = useQuery({
    queryKey: ['merchantRoutingRules', venueId],
    queryFn: () => getMerchantRoutingRules(venueId!),
    enabled: !!venueId,
  })

  return (
    <FeatureGate feature="MERCHANT_ROUTING_RULES">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/40 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p>{t('semantics')}</p>
            <p className="text-muted-foreground">{t('fallbackInfo')}</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
          </div>
        )}

        {!isLoading && (data?.merchants.length ?? 0) === 0 && (
          <Card className="border-input">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</CardContent>
          </Card>
        )}

        {data?.merchants.map(m => <MerchantRuleCard key={m.merchantAccountId} venueId={venueId!} merchant={m} />)}

        {(data?.merchants.length ?? 0) > 0 && <Simulator venueId={venueId!} />}
      </div>
    </FeatureGate>
  )
}

function Simulator({ venueId }: { venueId: string }) {
  const { t } = useTranslation('merchantRouting')
  const qc = useQueryClient()
  const [amount, setAmount] = useState('250')
  const [when, setWhen] = useState('') // datetime-local (hora local del navegador)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [result, setResult] = useState<EligibilityPreview | null>(null)

  const merchants = qc.getQueryData<{ merchants: { merchantAccountId: string; displayName: string }[] }>([
    'merchantRoutingRules',
    venueId,
  ])?.merchants
  const nameOf = (id: string) => merchants?.find(m => m.merchantAccountId === id)?.displayName ?? id

  const simMut = useMutation({
    mutationFn: () =>
      previewMerchantEligibility(venueId, {
        amount: Number(amount) || 0,
        simulateAt: when ? new Date(when).toISOString() : undefined,
        lat: lat !== '' ? Number(lat) : undefined,
        lng: lng !== '' ? Number(lng) : undefined,
      }),
    onSuccess: setResult,
  })

  return (
    <Card className="border-input">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlayCircle className="h-5 w-5" /> {t('simulator.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('simulator.description')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('simulator.amount')}</span>
            <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('simulator.when')}</span>
            <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('simulator.lat')}</span>
            <Input type="number" step="0.000001" placeholder="19.4326" value={lat} onChange={e => setLat(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('simulator.lng')}</span>
            <Input type="number" step="0.000001" placeholder="-99.1332" value={lng} onChange={e => setLng(e.target.value)} />
          </label>
        </div>
        <Button onClick={() => simMut.mutate()} disabled={simMut.isPending}>
          {simMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          {t('simulator.run')}
        </Button>

        {result && (
          <div className="space-y-3 rounded-lg border border-input p-4">
            {!result.routingFeatureActive && (
              <p className="text-sm text-muted-foreground">{t('simulator.featureInactive')}</p>
            )}
            {result.fallbackAll && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                {t('simulator.fallback')}
              </div>
            )}
            {result.autoSelectMerchantAccountId && (
              <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {t('simulator.autoSelect', { name: nameOf(result.autoSelectMerchantAccountId) })}
              </div>
            )}
            <ul className="space-y-2">
              {result.merchants.map(m => (
                <li key={m.merchantAccountId} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={m.eligible ? 'default' : 'outline'}>
                    {m.eligible ? t('simulator.eligible') : t('simulator.notEligible')}
                  </Badge>
                  <span className="font-medium">{nameOf(m.merchantAccountId)}</span>
                  {m.reasons.map(r => (
                    <span key={r} className="text-xs text-muted-foreground">
                      {t(`reasons.${r}`, { defaultValue: r })}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
