import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getAutoReorderSettings,
  updateAutoReorderSettings,
  runAutoReorderNow,
  type AutoReorderConfig,
  type ReorderUrgency,
} from '@/services/inventory.service'

const URGENCIES: ReorderUrgency[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export default function AutoReorderSettings() {
  const { t } = useTranslation('inventory')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['autoReorderSettings', venueId],
    queryFn: () => getAutoReorderSettings(venueId!),
    enabled: !!venueId,
  })

  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  const [cap, setCap] = useState<number | null | undefined>(undefined)
  const [minUrgency, setMinUrgency] = useState<ReorderUrgency | undefined>(undefined)

  const config: AutoReorderConfig = useMemo(
    () => ({
      enabled: enabled ?? data?.config.enabled ?? false,
      dailyCapMxn: cap !== undefined ? cap : (data?.config.dailyCapMxn ?? null),
      minUrgency: minUrgency ?? data?.config.minUrgency ?? 'LOW',
    }),
    [enabled, cap, minUrgency, data],
  )

  const saveMut = useMutation({
    mutationFn: () => updateAutoReorderSettings(venueId!, config),
    onSuccess: () => {
      toast({ title: t('autoReorder.saved') })
      qc.invalidateQueries({ queryKey: ['autoReorderSettings', venueId] })
    },
  })

  const runMut = useMutation({
    mutationFn: () => runAutoReorderNow(venueId!),
    onSuccess: r => toast({ title: t('autoReorder.runNowDone', { orders: r.result.ordersCreated, emails: r.result.emailsSent }) }),
  })

  return (
    <FeatureGate feature="AUTO_REORDER">
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('autoReorder.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('autoReorder.subtitle')}</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-input bg-card p-6">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-foreground">{t('autoReorder.enable')}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t('autoReorder.enableHelp')}</span>
            </span>
            <Switch data-tour="auto-reorder-toggle" checked={config.enabled} onCheckedChange={setEnabled} />
          </label>

          <div>
            <label className="block text-sm font-medium text-foreground">{t('autoReorder.dailyCap')}</label>
            <Input
              type="number"
              className="mt-1 h-12 text-base"
              value={config.dailyCapMxn ?? ''}
              onChange={e => setCap(e.target.value === '' ? null : parseFloat(e.target.value))}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('autoReorder.dailyCapHelp')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">{t('autoReorder.minUrgency')}</label>
            <div className="mt-2 flex gap-2">
              {URGENCIES.map(u => (
                <Button
                  key={u}
                  type="button"
                  variant={config.minUrgency === u ? 'default' : 'outline'}
                  className="cursor-pointer rounded-full"
                  onClick={() => setMinUrgency(u)}
                >
                  {t(`autoReorder.urgency.${u}`)}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('autoReorder.minUrgencyHelp')}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button className="cursor-pointer" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {t('autoReorder.save')}
            </Button>
            <Button variant="outline" className="cursor-pointer" disabled={runMut.isPending || !config.enabled} onClick={() => runMut.mutate()}>
              {t('autoReorder.runNow')}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-input bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">{t('autoReorder.previewTitle')}</h3>
          {isLoading ? null : !data?.preview.items.length ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('autoReorder.previewEmpty')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.preview.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{it.name}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline">{t(`autoReorder.urgency.${it.urgency}`)}</Badge>
                    {it.supplier ?? '—'} · {it.suggestedQuantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </FeatureGate>
  )
}
