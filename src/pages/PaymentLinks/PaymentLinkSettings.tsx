import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import {
  paymentLinkService,
  DEFAULT_PAYMENT_LINK_SETTINGS,
  type PaymentLinkSettings as Settings,
  type TippingConfig,
} from '@/services/paymentLink.service'

// ─── Card brand icons ──────────────────────────────────────────────────────
function VisaIcon() {
  return (
    <svg className="h-7 w-10" viewBox="0 0 40 28" fill="none">
      <rect width="40" height="28" rx="4" fill="#1A1F71" />
      <text x="20" y="18" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="sans-serif">
        VISA
      </text>
    </svg>
  )
}
function McIcon() {
  return (
    <svg className="h-7 w-10" viewBox="0 0 40 28" fill="none">
      <rect width="40" height="28" rx="4" className="fill-foreground/10" />
      <circle cx="16" cy="14" r="7" fill="#EB001B" />
      <circle cx="24" cy="14" r="7" fill="#F79E1B" opacity="0.85" />
    </svg>
  )
}
function AmexIcon() {
  return (
    <svg className="h-7 w-10" viewBox="0 0 40 28" fill="none">
      <rect width="40" height="28" rx="4" fill="#006FCF" />
      <text x="20" y="18" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="700" fontFamily="sans-serif">
        AMEX
      </text>
    </svg>
  )
}

// ─── Tipping editor ────────────────────────────────────────────────────────
// Inline editor for the venue-default tipping config. Stored as
// { presets: [15, 20, 25], allowCustom: true } or null when disabled.
function TippingEditor({ value, onChange }: { value: TippingConfig | null; onChange: (v: TippingConfig | null) => void }) {
  const enabled = value !== null
  const presets = value?.presets ?? [15, 20, 25]
  const allowCustom = value?.allowCustom ?? true

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-2">
        <span className="text-sm font-medium">Habilitar propinas por defecto</span>
        <Switch
          checked={enabled}
          onCheckedChange={on => onChange(on ? { presets, allowCustom } : null)}
          className="cursor-pointer"
        />
      </div>
      {enabled && (
        <div className="space-y-3 pl-1 border-l-2 border-muted ml-1">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Porcentajes sugeridos (separados por coma, máx. 4)</label>
            <Input
              type="text"
              value={presets.join(', ')}
              onChange={e => {
                const arr = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n) && n > 0 && n <= 100)
                  .slice(0, 4)
                onChange({ presets: arr.length > 0 ? arr : [15], allowCustom })
              }}
              placeholder="15, 20, 25"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Permitir monto custom</span>
            <Switch checked={allowCustom} onCheckedChange={ac => onChange({ presets, allowCustom: ac })} className="cursor-pointer" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function PaymentLinkSettings() {
  const { t } = useTranslation('paymentLinks')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['payment-link-settings', venueId],
    queryFn: () => paymentLinkService.getSettings(venueId!),
    enabled: !!venueId,
  })

  // Local draft so toggles don't fire a network roundtrip per click. Saved
  // explicitly via the bottom "Guardar" button or auto on Switch change for
  // the simple boolean toggles (parity with the previous UX).
  const [draft, setDraft] = useState<Settings>(DEFAULT_PAYMENT_LINK_SETTINGS)
  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(data ?? DEFAULT_PAYMENT_LINK_SETTINGS), [draft, data])

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Settings>) => paymentLinkService.updateSettings(venueId!, payload),
    onSuccess: next => {
      queryClient.setQueryData(['payment-link-settings', venueId], next)
      toast({ title: t('settings.saved'), description: t('settings.savedDesc') })
    },
    onError: (err: any) => {
      toast({ title: t('settings.saveError'), description: err?.message ?? '', variant: 'destructive' })
    },
  })

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('settings.loading')}
      </div>
    )
  }

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('settings.description')}</p>
          </div>
          {isDirty && (
            <Button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('settings.save')}
            </Button>
          )}
        </div>

        <div className="space-y-10">
          {/* ── Payments ─────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('settings.payments')}</h2>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium">{t('settings.creditCard')}</span>
              <div className="flex items-center gap-1.5">
                <VisaIcon />
                <McIcon />
                <AmexIcon />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{t('settings.creditCardHint')}</p>
          </section>

          <hr className="border-border" />

          {/* ── Email notifications ───────────────────────── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t('settings.notifications')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t('settings.notificationsHint')}</p>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium">{t('settings.notifyOnPaid')}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{t('settings.notifyOnPaidHint')}</p>
              </div>
              <Switch
                checked={draft.notifyOnPaid}
                onCheckedChange={on => setDraft({ ...draft, notifyOnPaid: on })}
                className="cursor-pointer"
              />
            </div>
          </section>

          <hr className="border-border" />

          {/* ── Tips ──────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('settings.tips')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.tipsHint')}</p>
            <TippingEditor value={draft.defaultTippingConfig} onChange={tc => setDraft({ ...draft, defaultTippingConfig: tc })} />
          </section>

          <hr className="border-border" />

          {/* ── Customer info ─────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('settings.customerInfo')}</h2>
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium">{t('settings.customerNotes')}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{t('settings.customerNotesHint')}</p>
              </div>
              <Switch
                checked={draft.customerNotesEnabled}
                onCheckedChange={on => setDraft({ ...draft, customerNotesEnabled: on })}
                className="cursor-pointer"
              />
            </div>
          </section>

          <hr className="border-border" />

          {/* ── Policies ──────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('settings.policies')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.policiesHint')}</p>
            <Textarea
              value={draft.merchantPolicies ?? ''}
              onChange={e => setDraft({ ...draft, merchantPolicies: e.target.value || null })}
              placeholder={t('settings.policiesPlaceholder')}
              className="min-h-32"
              maxLength={10000}
            />
            <p className="text-xs text-muted-foreground text-right">{(draft.merchantPolicies ?? '').length}/10000</p>
          </section>
        </div>

        {/* Sticky save bar at bottom when dirty */}
        {isDirty && (
          <div className="sticky bottom-4 mt-8 flex justify-end">
            <Button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} size="lg">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('settings.save')}
            </Button>
          </div>
        )}
        {/* Keep "Coming soon" badge concept available if needed in future */}
        {false && <Badge>Muy pronto</Badge>}
      </div>
    </div>
  )
}
