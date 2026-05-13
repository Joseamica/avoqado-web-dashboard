import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import paymentLinkService, { DEFAULT_PAYMENT_LINK_BRANDING, type PaymentLinkBranding } from '@/services/paymentLink.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontPicker } from './components/FontPicker'
import { fontFamilyValue, loadFontPreview } from './font-loader'

const BUTTON_SHAPES = ['rounded', 'square', 'pill'] as const
type ButtonShape = (typeof BUTTON_SHAPES)[number]

const PRESET_COLORS = [
  '#006aff', // blue
  '#000000', // black
  '#e53935', // red
  '#43a047', // green
  '#f4511e', // orange
  '#8e24aa', // purple
]

const SHAPE_CLASSES: Record<ButtonShape, string> = {
  rounded: 'rounded-lg',
  square: 'rounded-none',
  pill: 'rounded-full',
}

export default function PaymentLinkBranding() {
  const { t } = useTranslation('paymentLinks')
  const { venue, venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Load persisted branding. Backend always merges with defaults so the
  // response shape is guaranteed — no nullable fields to handle here.
  const { data: branding } = useQuery({
    queryKey: ['payment-link-branding', venueId],
    queryFn: () => paymentLinkService.getBranding(venueId),
    enabled: !!venueId,
    staleTime: 60_000,
  })

  // Local editable copy, hydrated from the server. `dirty` tracks whether
  // the user has unsaved edits — Save button is disabled until something
  // changes (Stripe Dashboard pattern).
  const [draft, setDraft] = useState<PaymentLinkBranding>(DEFAULT_PAYMENT_LINK_BRANDING)
  const [dirty, setDirty] = useState(false)

  // Hydrate the draft once the server responds. If the user has already
  // started editing (dirty=true) we keep their in-flight changes; otherwise
  // we replace the draft so the UI reflects the latest persisted state.
  useEffect(() => {
    if (branding && !dirty) {
      setDraft(branding)
    }
  }, [branding, dirty])

  // Preload the font currently applied to the preview so the @font-face is
  // available the moment the user lands on the page (avoids a brief flash
  // of system-ui in the preview card + picker trigger).
  useEffect(() => {
    if (draft.fontFamily) loadFontPreview(draft.fontFamily)
  }, [draft.fontFamily])

  const update = <K extends keyof PaymentLinkBranding>(key: K, value: PaymentLinkBranding[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const mutation = useMutation({
    mutationFn: () => paymentLinkService.updateBranding(venueId, draft),
    onSuccess: data => {
      queryClient.setQueryData(['payment-link-branding', venueId], data)
      setDirty(false)
      toast({ title: t('branding.savedTitle', { defaultValue: 'Cambios guardados' }) })
    },
    onError: (err: any) => {
      toast({
        title: t('branding.saveErrorTitle', { defaultValue: 'No se pudo guardar' }),
        description: err?.response?.data?.error || err?.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('branding.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('branding.description')}</p>
          </div>
          {/* Top-right actions. Discard only shows when there are unsaved
              changes — destructive action shouldn't be one click away when
              nothing is at stake. */}
          <div className="flex items-center gap-2">
            {dirty && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (branding) setDraft(branding)
                  setDirty(false)
                }}
                disabled={mutation.isPending}
                className="cursor-pointer"
              >
                {t('branding.discard', { defaultValue: 'Descartar' })}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={!dirty || mutation.isPending}
              className="cursor-pointer"
              data-tour="payment-link-branding-save"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('branding.saving', { defaultValue: 'Guardando…' })}
                </>
              ) : !dirty ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('branding.saved', { defaultValue: 'Guardado' })}
                </>
              ) : (
                t('branding.save', { defaultValue: 'Guardar cambios' })
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left: Settings */}
          <div className="lg:col-span-3 space-y-10">
            {/* ── Venue selector ──────────────────────────── */}
            <section className="space-y-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('branding.venue')}</Label>
              <div className="flex items-center gap-3 rounded-xl border border-input p-4">
                {venue?.logo ? (
                  <img src={venue.logo} alt={venue?.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{(venue?.name || 'A').charAt(0)}</span>
                  </div>
                )}
                <span className="font-medium">{venue?.name}</span>
              </div>
            </section>

            {/* ── Logo ────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t('branding.logo')}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('branding.logoHint')}</p>
                </div>
                <Switch checked={draft.showLogo} onCheckedChange={v => update('showLogo', v)} className="cursor-pointer" />
              </div>
            </section>

            <hr className="border-border" />

            {/* ── Button ──────────────────────────────────── */}
            <section className="space-y-5">
              <h3 className="font-semibold">{t('branding.button')}</h3>

              {/* Color */}
              <div className="space-y-3">
                <Label className="text-sm">{t('branding.buttonColor')}</Label>
                <div className="flex items-center gap-3">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => update('buttonColor', color)}
                      className={`w-8 h-8 rounded-full transition-all cursor-pointer ${
                        draft.buttonColor === color ? 'ring-2 ring-offset-2 ring-foreground/50' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      value={draft.buttonColor}
                      onChange={e => update('buttonColor', e.target.value)}
                      className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-foreground/50 transition-colors">
                      <span className="text-xs text-muted-foreground">+</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{draft.buttonColor}</p>
              </div>

              {/* Shape */}
              <div className="space-y-3">
                <Label className="text-sm">{t('branding.buttonShape')}</Label>
                <div className="flex rounded-lg border border-input bg-muted/50 p-1">
                  {BUTTON_SHAPES.map(shape => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => update('buttonShape', shape)}
                      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        draft.buttonShape === shape ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t(`branding.buttonShape${shape.charAt(0).toUpperCase() + shape.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <hr className="border-border" />

            {/* ── Font ────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="font-semibold">{t('branding.font')}</h3>
              <p className="text-xs text-muted-foreground -mt-1">
                {t('branding.fontHint', {
                  defaultValue: '40 fuentes auto-hostadas. Solo se descarga la que elijas.',
                })}
              </p>
              <FontPicker value={draft.fontFamily} onChange={v => update('fontFamily', v)} />
            </section>

            <hr className="border-border" />

            {/* ── Toggle visibility ───────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">{t('branding.showImage')}</span>
                <Switch checked={draft.showImage} onCheckedChange={v => update('showImage', v)} className="cursor-pointer" />
              </div>
              <hr className="border-border" />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">{t('branding.showTitle')}</span>
                <Switch checked={draft.showTitle} onCheckedChange={v => update('showTitle', v)} className="cursor-pointer" />
              </div>
              <hr className="border-border" />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">{t('branding.showPrice')}</span>
                <Switch checked={draft.showPrice} onCheckedChange={v => update('showPrice', v)} className="cursor-pointer" />
              </div>
            </section>
          </div>

          {/* Right: Button Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-6">
              <p className="text-sm font-medium text-muted-foreground text-center">{t('branding.buttonPreview')}</p>

              <div
                className="rounded-2xl border border-input bg-muted/30 p-8 flex flex-col items-center gap-6"
                style={{ fontFamily: fontFamilyValue(draft.fontFamily) }}
              >
                <div className="w-full max-w-[240px] rounded-xl border border-input bg-card overflow-hidden shadow-sm">
                  {draft.showImage && (
                    <div className="h-32 bg-muted flex items-center justify-center">
                      {draft.showLogo && venue?.logo ? (
                        <img src={venue.logo} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-foreground/5 flex items-center justify-center">
                          <span className="text-lg text-foreground/20">{(venue?.name || 'A').charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    {draft.showTitle && <span className="text-sm font-medium text-foreground/70">{t('form.titlePlaceholder')}</span>}
                    {draft.showPrice && <p className="text-sm font-semibold">$250.00 MXN</p>}
                    <button
                      className={`w-full py-2.5 text-sm font-semibold text-white transition-all ${SHAPE_CLASSES[draft.buttonShape]}`}
                      style={{ backgroundColor: draft.buttonColor }}
                    >
                      {t('branding.buttonText')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
