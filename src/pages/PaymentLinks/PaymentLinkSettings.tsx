import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, X } from 'lucide-react'
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
/**
 * Single preset pill with a local string draft. Lets the user clear the
 * input and retype without forcing a "0" jump from parseInt('') → NaN →
 * fallback. Commits to parent only when the value parses cleanly; blur
 * normalizes empty/invalid back to a sane default (15).
 */
function PresetPill({
  value,
  index,
  showRemove,
  onChange,
  onRemove,
}: {
  value: number
  index: number
  showRemove: boolean
  onChange: (v: number) => void
  onRemove: () => void
}) {
  // Local string draft so the input doesn't snap back to the parent value
  // on every keystroke — this is what lets the user clear the field with
  // backspace without it forcing a "0" rebound. Commit to parent only when
  // the draft parses to a valid number in range.
  const [draft, setDraft] = useState(String(value))

  // Re-sync when the parent pushes a new value (add/remove neighbor pill).
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  // Server schema allows 0 (a "No tip" preset is valid alongside 15/20/25),
  // so reject only negative. 100 is the cap.
  const commit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0) return
    const clamped = Math.min(100, n)
    onChange(clamped)
  }

  // Matches the visual style of CreatePaymentLinkDialog tipping section:
  // h-10 bordered input with centered number and absolute % sign on the
  // right. Remove × floats over the top-right and only shows on hover so
  // the resting state looks identical to the dialog's fixed-3 grid.
  return (
    <div className="relative group">
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={e => {
          const next = e.target.value.replace(/[^0-9]/g, '').slice(0, 3)
          setDraft(next)
          if (next !== '') commit(next)
        }}
        onBlur={() => {
          const parsed = parseInt(draft, 10)
          if (draft === '' || isNaN(parsed) || parsed < 0) {
            setDraft(String(value))
          }
        }}
        className="h-10 text-center pr-7 text-base font-medium"
        aria-label={`Porcentaje ${index + 1}`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 rounded-full bg-background border border-input p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:border-foreground/40 transition-opacity"
          aria-label="Quitar porcentaje"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function TippingEditor({ value, onChange }: { value: TippingConfig | null; onChange: (v: TippingConfig | null) => void }) {
  const enabled = value !== null
  const presets = value?.presets ?? [15, 20, 25]
  const allowCustom = value?.allowCustom ?? true
  const MAX_PRESETS = 4

  const updatePreset = (idx: number, n: number) => {
    const next = presets.map((p, i) => (i === idx ? n : p))
    onChange({ presets: next, allowCustom })
  }

  const removePreset = (idx: number) => {
    const next = presets.filter((_, i) => i !== idx)
    onChange({ presets: next.length > 0 ? next : [15], allowCustom })
  }

  const addPreset = () => {
    if (presets.length >= MAX_PRESETS) return
    // Suggest the next round number above the current max — 15 → 20 → 25 → 30.
    const suggested = presets.length > 0 ? Math.min(100, Math.max(...presets) + 5) : 15
    onChange({ presets: [...presets, suggested], allowCustom })
  }

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center justify-between rounded-lg border border-input bg-transparent px-4 py-3">
        <div>
          <div className="text-sm font-medium">Habilitar propinas por defecto</div>
          <div className="text-xs text-muted-foreground mt-0.5">El cliente verá los porcentajes al pagar.</div>
        </div>
        <Switch checked={enabled} onCheckedChange={on => onChange(on ? { presets, allowCustom } : null)} className="cursor-pointer" />
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-input bg-card p-4">
          <div className="space-y-2.5">
            <label className="text-sm font-medium">Porcentajes de propina</label>
            {/* 4-col grid: 3 presets fill a row, 4th wraps to dedicated row.
                Add button takes the last cell when slot is free. Matches the
                CreatePaymentLinkDialog tipping section visually. */}
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p, idx) => (
                <PresetPill
                  key={idx}
                  index={idx}
                  value={p}
                  showRemove={presets.length > 1}
                  onChange={n => updatePreset(idx, n)}
                  onRemove={() => removePreset(idx)}
                />
              ))}
              {presets.length < MAX_PRESETS && (
                <button
                  type="button"
                  onClick={addPreset}
                  className="flex h-10 items-center justify-center gap-1 rounded-md border border-dashed border-input text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <div>
              <div className="text-sm font-medium">Permitir monto custom</div>
              <div className="text-xs text-muted-foreground mt-0.5">El cliente puede teclear un porcentaje propio.</div>
            </div>
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
      </div>
    </div>
  )
}
