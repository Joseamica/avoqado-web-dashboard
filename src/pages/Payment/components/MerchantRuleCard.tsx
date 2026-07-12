import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  deleteMerchantRoutingRule,
  upsertMerchantRoutingRule,
  type MerchantRuleView,
  type RoutingConditions,
  type RoutingWindow,
} from '@/services/merchantRouting.service'

// Orden de despliegue L-D; los valores siguen la convención 0=domingo…6=sábado del motor.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'HOST', 'KITCHEN'] as const
const PERIODS = ['DAY', 'WEEK', 'MONTH'] as const

const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))

/** Editor de la regla de UN merchant: toggles por condición + guardar/quitar. */
export function MerchantRuleCard({ venueId, merchant }: { venueId: string; merchant: MerchantRuleView }) {
  const { t } = useTranslation('merchantRouting')
  const { toast } = useToast()
  const qc = useQueryClient()
  const c = merchant.rule?.conditions

  const [active, setActive] = useState(merchant.rule?.active ?? true)
  const [enabled, setEnabled] = useState({
    schedule: !!c?.schedule,
    geofence: !!c?.geofence,
    volumeCap: !!c?.volumeCap,
    ticketAmount: !!c?.ticketAmount,
    staff: !!c?.staff,
    circuitBreaker: !!c?.circuitBreaker,
  })
  const [days, setDays] = useState<number[]>(c?.schedule?.days ?? [1, 2, 3, 4, 5, 6, 0])
  const [windows, setWindows] = useState<RoutingWindow[]>(c?.schedule?.windows ?? [{ start: '09:00', end: '18:00' }])
  const [geo, setGeo] = useState({
    lat: c?.geofence?.lat?.toString() ?? '',
    lng: c?.geofence?.lng?.toString() ?? '',
    radiusM: c?.geofence?.radiusM?.toString() ?? '150',
  })
  const [cap, setCap] = useState({
    period: (c?.volumeCap?.period ?? 'DAY') as (typeof PERIODS)[number],
    maxAmount: c?.volumeCap?.maxAmount?.toString() ?? '',
    maxTxCount: c?.volumeCap?.maxTxCount?.toString() ?? '',
  })
  const [ticket, setTicket] = useState({ min: c?.ticketAmount?.min?.toString() ?? '', max: c?.ticketAmount?.max?.toString() ?? '' })
  const [roles, setRoles] = useState<string[]>(c?.staff?.roles ?? [])
  const [breaker, setBreaker] = useState({
    consecutiveFailures: c?.circuitBreaker?.consecutiveFailures?.toString() ?? '3',
    cooldownMinutes: c?.circuitBreaker?.cooldownMinutes?.toString() ?? '15',
  })

  const buildConditions = (): RoutingConditions => {
    const out: RoutingConditions = {}
    if (enabled.schedule) out.schedule = { days, windows }
    if (enabled.geofence) out.geofence = { lat: Number(geo.lat), lng: Number(geo.lng), radiusM: Number(geo.radiusM) }
    if (enabled.volumeCap) out.volumeCap = { period: cap.period, maxAmount: num(cap.maxAmount), maxTxCount: num(cap.maxTxCount) }
    if (enabled.ticketAmount) out.ticketAmount = { min: num(ticket.min), max: num(ticket.max) }
    if (enabled.staff) out.staff = { roles }
    if (enabled.circuitBreaker) {
      out.circuitBreaker = { consecutiveFailures: Number(breaker.consecutiveFailures), cooldownMinutes: Number(breaker.cooldownMinutes) }
    }
    return out
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['merchantRoutingRules', venueId] })
  const apiError = (e: any): string => e?.response?.data?.message ?? e?.response?.data?.error ?? t('errorGeneric')

  const saveMut = useMutation({
    mutationFn: () => upsertMerchantRoutingRule(venueId, { merchantAccountId: merchant.merchantAccountId, active, conditions: buildConditions() }),
    onSuccess: () => {
      toast({ title: t('saved', { name: merchant.displayName }) })
      invalidate()
    },
    onError: e => toast({ title: t('errorTitle'), description: apiError(e), variant: 'destructive' }),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteMerchantRoutingRule(venueId, merchant.merchantAccountId),
    onSuccess: () => {
      toast({ title: t('deleted', { name: merchant.displayName }) })
      invalidate()
    },
    onError: e => toast({ title: t('errorTitle'), description: apiError(e), variant: 'destructive' }),
  })

  const anyCondition = Object.values(enabled).some(Boolean)

  return (
    <Card className="border-input">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{merchant.displayName}</CardTitle>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{merchant.providerCode}</Badge>
            {merchant.rule ? (
              <Badge variant={merchant.rule.active ? 'default' : 'secondary'}>
                {merchant.rule.active ? t('ruleActive') : t('rulePaused')}
              </Badge>
            ) : (
              <Badge variant="secondary">{t('alwaysVisible')}</Badge>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('activeSwitch')}</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Horario */}
        <ConditionBlock
          label={t('conditions.schedule')}
          hint={t('conditions.scheduleHint')}
          checked={enabled.schedule}
          onChange={v => setEnabled(s => ({ ...s, schedule: v }))}
        >
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))}
                className={`h-8 w-8 rounded-full border border-input text-xs font-medium transition-colors ${
                  days.includes(d) ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                }`}
              >
                {t(`days.${d}`)}
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {windows.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  value={w.start}
                  onChange={e => setWindows(ws => ws.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="time"
                  className="w-32"
                  value={w.end}
                  onChange={e => setWindows(ws => ws.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                />
                {windows.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setWindows(ws => ws.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {windows.length < 4 && (
              <Button variant="outline" size="sm" onClick={() => setWindows(ws => [...ws, { start: '18:00', end: '23:00' }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> {t('conditions.addWindow')}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{t('conditions.midnightHint')}</p>
          </div>
        </ConditionBlock>

        {/* Geocerca */}
        <ConditionBlock
          label={t('conditions.geofence')}
          hint={t('conditions.geofenceHint')}
          checked={enabled.geofence}
          onChange={v => setEnabled(s => ({ ...s, geofence: v }))}
        >
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" step="0.000001" placeholder={t('conditions.lat')} value={geo.lat} onChange={e => setGeo(g => ({ ...g, lat: e.target.value }))} />
            <Input type="number" step="0.000001" placeholder={t('conditions.lng')} value={geo.lng} onChange={e => setGeo(g => ({ ...g, lng: e.target.value }))} />
            <Input type="number" min="10" placeholder={t('conditions.radiusM')} value={geo.radiusM} onChange={e => setGeo(g => ({ ...g, radiusM: e.target.value }))} />
          </div>
        </ConditionBlock>

        {/* Tope de volumen */}
        <ConditionBlock
          label={t('conditions.volumeCap')}
          hint={t('conditions.volumeCapHint')}
          checked={enabled.volumeCap}
          onChange={v => setEnabled(s => ({ ...s, volumeCap: v }))}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCap(cp => ({ ...cp, period: p }))}
                  className={`rounded-md border border-input px-3 py-1.5 text-xs font-medium ${
                    cap.period === p ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                  }`}
                >
                  {t(`periods.${p}`)}
                </button>
              ))}
            </div>
            <Input type="number" min="0" step="0.01" className="w-40" placeholder={t('conditions.maxAmount')} value={cap.maxAmount} onChange={e => setCap(cp => ({ ...cp, maxAmount: e.target.value }))} />
            <Input type="number" min="0" className="w-40" placeholder={t('conditions.maxTxCount')} value={cap.maxTxCount} onChange={e => setCap(cp => ({ ...cp, maxTxCount: e.target.value }))} />
          </div>
        </ConditionBlock>

        {/* Monto del ticket */}
        <ConditionBlock
          label={t('conditions.ticketAmount')}
          hint={t('conditions.ticketAmountHint')}
          checked={enabled.ticketAmount}
          onChange={v => setEnabled(s => ({ ...s, ticketAmount: v }))}
        >
          <div className="flex gap-2">
            <Input type="number" min="0" step="0.01" className="w-40" placeholder={t('conditions.min')} value={ticket.min} onChange={e => setTicket(tk => ({ ...tk, min: e.target.value }))} />
            <Input type="number" min="0" step="0.01" className="w-40" placeholder={t('conditions.max')} value={ticket.max} onChange={e => setTicket(tk => ({ ...tk, max: e.target.value }))} />
          </div>
        </ConditionBlock>

        {/* Staff (por rol) */}
        <ConditionBlock
          label={t('conditions.staff')}
          hint={t('conditions.staffHint')}
          checked={enabled.staff}
          onChange={v => setEnabled(s => ({ ...s, staff: v }))}
        >
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRoles(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]))}
                className={`rounded-md border border-input px-3 py-1.5 text-xs font-medium ${
                  roles.includes(r) ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                }`}
              >
                {t(`roles.${r}`)}
              </button>
            ))}
          </div>
        </ConditionBlock>

        {/* Circuit breaker */}
        <ConditionBlock
          label={t('conditions.circuitBreaker')}
          hint={t('conditions.circuitBreakerHint')}
          checked={enabled.circuitBreaker}
          onChange={v => setEnabled(s => ({ ...s, circuitBreaker: v }))}
        >
          <div className="flex items-center gap-2 text-sm">
            <Input type="number" min="1" max="20" className="w-20" value={breaker.consecutiveFailures} onChange={e => setBreaker(b => ({ ...b, consecutiveFailures: e.target.value }))} />
            <span className="text-muted-foreground">{t('conditions.failures')}</span>
            <Input type="number" min="1" max="1440" className="w-20" value={breaker.cooldownMinutes} onChange={e => setBreaker(b => ({ ...b, cooldownMinutes: e.target.value }))} />
            <span className="text-muted-foreground">{t('conditions.cooldown')}</span>
          </div>
        </ConditionBlock>

        <div className="flex items-center justify-between border-t border-input pt-4">
          <div>
            {merchant.rule && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                {t('removeRule')}
              </Button>
            )}
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !anyCondition}>
            {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('save')}
          </Button>
        </div>
        {!anyCondition && <p className="text-xs text-muted-foreground">{t('needOneCondition')}</p>}
      </CardContent>
    </Card>
  )
}

function ConditionBlock({
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-input p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={v => onChange(v === true)} className="mt-0.5" />
        <span>
          <span className="text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </label>
      {checked && <div className="mt-3 pl-7">{children}</div>}
    </div>
  )
}
