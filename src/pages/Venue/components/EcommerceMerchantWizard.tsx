/**
 * EcommerceMerchantWizard — interactive create / edit / resume flow for
 * ecommerce merchant channels.
 *
 * Replaces the legacy EcommerceMerchantDialog (raw JSON credentials form).
 *
 * Flow:
 *   - Create: Step 1 (provider tiles) → Step 2 (provider-aware form)
 *   - Edit / resume: opens directly to a state-aware view based on
 *     merchant.onboardingStatus (NOT_STARTED / IN_PROGRESS / RESTRICTED /
 *     COMPLETED) — see resume views below.
 *
 * For Stripe Connect, submitting Step 2 triggers:
 *   1. POST /ecommerce-merchants                (create record, status=NOT_STARTED)
 *   2. POST /ecommerce-merchants/:id/stripe-onboard (create Stripe account + onboarding URL)
 *   3. window.location.assign(url)              (browser navigates to Stripe hosted onboarding)
 *
 * Stripe redirects back to /ecommerce-merchants?status=success&merchantId=X.
 * The list page handles that return — see EcommerceMerchants.tsx.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, Eye, EyeOff, Info, Loader2, Sparkles } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  ecommerceMerchantAPI,
  type AvailablePaymentProvider,
  type CreateEcommerceMerchantData,
  type EcommerceMerchant,
} from '@/services/ecommerceMerchant.service'
import { formatStripeRequirement } from './stripeRequirementLabels'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  /** Provided in edit/resume mode. Omit for create. */
  merchant?: EcommerceMerchant | null
}

interface FormData {
  channelName: string
  businessName: string
  rfc: string
  contactEmail: string
  contactPhone: string
  website: string
  businessType: 'company' | 'individual'
  /** Credentials for non-Stripe providers (driven by provider.configSchema) */
  credentials: Record<string, string>
  sandboxMode: boolean
}

const emptyForm: FormData = {
  channelName: 'Web Principal',
  businessName: '',
  rfc: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  businessType: 'company',
  credentials: {},
  sandboxMode: true,
}

// ─── Helper: Stripe Connect provider tile ──────────────────────────────────

function StripeConnectTile({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation('ecommerce')
  return (
    <button
      type="button"
      onClick={onSelect}
      data-tour="ecommerce-wizard-provider-stripe"
      className={`relative flex flex-col gap-3 rounded-2xl border-2 p-6 text-left transition-all cursor-pointer hover:shadow-md ${
        selected ? 'border-primary bg-primary/5' : 'border-input bg-card hover:border-primary/30'
      }`}
    >
      <div className="absolute top-3 right-3">
        <Badge variant="default" className="text-[10px] gap-1">
          <Sparkles className="h-3 w-3" />
          {t('wizard.step1.recommendedBadge')}
        </Badge>
      </div>
      <div className="text-3xl" aria-hidden>
        🟦
      </div>
      <div>
        <div className="font-semibold text-base">{t('wizard.step1.stripe.title')}</div>
        <div className="text-sm text-muted-foreground mt-1">{t('wizard.step1.stripe.subtitle')}</div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{t('wizard.step1.stripe.description')}</p>
      </div>
    </button>
  )
}

function GenericProviderTile({
  provider,
  selected,
  onSelect,
}: {
  provider: AvailablePaymentProvider
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation('ecommerce')
  return (
    <button
      type="button"
      onClick={onSelect}
      data-tour={`ecommerce-wizard-provider-${provider.code.toLowerCase()}`}
      className={`relative flex flex-col gap-3 rounded-2xl border-2 p-6 text-left transition-all cursor-pointer hover:shadow-md ${
        selected ? 'border-primary bg-primary/5' : 'border-input bg-card hover:border-primary/30'
      }`}
    >
      <div className="text-3xl" aria-hidden>
        🟧
      </div>
      <div>
        <div className="font-semibold text-base">{provider.name}</div>
        <div className="text-sm text-muted-foreground mt-1">{t('wizard.step1.generic.subtitle')}</div>
      </div>
    </button>
  )
}

// ─── Step 1: pick provider ─────────────────────────────────────────────────

function Step1ProviderPicker({
  providers,
  loading,
  selectedId,
  onSelect,
}: {
  providers: AvailablePaymentProvider[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('ecommerce')
  const stripeProvider = providers.find(p => p.code === 'STRIPE_CONNECT')
  const otherProviders = providers.filter(p => p.code !== 'STRIPE_CONNECT')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="text-sm">{t('wizard.step1.providerLoading')}</p>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('wizard.step1.providerEmpty')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t('wizard.step1.title')}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t('wizard.step1.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stripeProvider && (
          <StripeConnectTile selected={selectedId === stripeProvider.id} onSelect={() => onSelect(stripeProvider.id)} />
        )}
        {otherProviders.map(p => (
          <GenericProviderTile key={p.id} provider={p} selected={selectedId === p.id} onSelect={() => onSelect(p.id)} />
        ))}
      </div>
    </div>
  )
}

// ─── Step 2A: Stripe Connect minimal form ──────────────────────────────────

function Step2Stripe({
  form,
  setForm,
  onBack,
  showBack,
}: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
  onBack: () => void
  showBack: boolean
}) {
  const { t } = useTranslation('ecommerce')

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {showBack && (
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-3">
          <ArrowLeft className="h-4 w-4" /> {t('wizard.step2.backButton')}
        </Button>
      )}

      <div>
        <h2 className="text-2xl font-semibold">{t('wizard.step1.stripe.title')}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t('wizard.step1.stripe.description')}</p>
      </div>

      <div className="rounded-2xl border border-input bg-card p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="channelName">
            {t('wizard.step2.channelNameLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="channelName"
            className="h-12 text-base"
            value={form.channelName}
            onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))}
            placeholder={t('wizard.step2.channelNamePlaceholder')}
            autoComplete="off"
            data-1p-ignore
          />
          <p className="text-xs text-muted-foreground">{t('wizard.step2.channelNameHelp')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactEmail">
            {t('wizard.step2.contactEmailLabel')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contactEmail"
            type="email"
            className="h-12 text-base"
            value={form.contactEmail}
            onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
            placeholder={t('wizard.step2.contactEmailPlaceholder')}
            autoComplete="off"
            data-1p-ignore
          />
        </div>

        <div className="space-y-3" data-tour="ecommerce-wizard-business-type">
          <Label>
            {t('wizard.stripe.businessTypeLabel')} <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={form.businessType}
            onValueChange={v => setForm(f => ({ ...f, businessType: v as 'company' | 'individual' }))}
            className="gap-3"
          >
            <Label
              htmlFor="bt-company"
              className="flex items-center gap-3 rounded-xl border border-input p-4 cursor-pointer hover:bg-muted/30"
            >
              <RadioGroupItem id="bt-company" value="company" />
              <span className="font-normal">{t('wizard.stripe.businessTypeCompany')}</span>
            </Label>
            <Label
              htmlFor="bt-personal"
              className="flex items-center gap-3 rounded-xl border border-input p-4 cursor-pointer hover:bg-muted/30"
            >
              <RadioGroupItem id="bt-personal" value="individual" />
              <span className="font-normal">{t('wizard.stripe.businessTypePersonal')}</span>
            </Label>
          </RadioGroup>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">{t('wizard.stripe.infoText')}</AlertDescription>
      </Alert>

      {/* "Ya tengo Stripe" — collapsible note for users who already have
          a standalone Stripe account and might wonder why they need to do
          this. Stripe Connect creates a linked account under the platform,
          it doesn't import their existing one. */}
      <details className="rounded-xl border border-input bg-card p-4 text-sm group">
        <summary className="cursor-pointer font-medium select-none flex items-center justify-between gap-2 list-none">
          <span>{t('wizard.stripe.alreadyHaveStripeTitle')}</span>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <p className="mt-3 text-muted-foreground leading-relaxed">{t('wizard.stripe.alreadyHaveStripeBody')}</p>
      </details>
    </div>
  )
}

// ─── Step 2B: generic schema-driven form ───────────────────────────────────

function Step2Generic({
  provider,
  form,
  setForm,
  onBack,
}: {
  provider: AvailablePaymentProvider
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
  onBack: () => void
}) {
  const { t } = useTranslation('ecommerce')
  const [showCredentials, setShowCredentials] = useState(false)
  const credentialFields = useMemo(() => {
    const props = provider.configSchema?.properties ?? {}
    const required = new Set(provider.configSchema?.required ?? [])
    return Object.entries(props).map(([key, def]) => ({ key, def, required: required.has(key) }))
  }, [provider])

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-3">
        <ArrowLeft className="h-4 w-4" /> {t('wizard.step2.backButton')}
      </Button>

      <div>
        <h2 className="text-2xl font-semibold">{provider.name}</h2>
      </div>

      {/* Channel info */}
      <div className="rounded-2xl border border-input bg-card p-6 space-y-5">
        <Field
          id="channelName"
          label={t('wizard.step2.channelNameLabel')}
          required
          value={form.channelName}
          onChange={v => setForm(f => ({ ...f, channelName: v }))}
          placeholder={t('wizard.step2.channelNamePlaceholder')}
          help={t('wizard.step2.channelNameHelp')}
        />
        <Field
          id="businessName"
          label={t('wizard.step2.businessNameLabel')}
          required
          value={form.businessName}
          onChange={v => setForm(f => ({ ...f, businessName: v }))}
          placeholder={t('wizard.step2.businessNamePlaceholder')}
        />
        <Field
          id="rfc"
          label={t('wizard.step2.rfcLabel')}
          value={form.rfc}
          onChange={v => setForm(f => ({ ...f, rfc: v.toUpperCase() }))}
          placeholder={t('wizard.step2.rfcPlaceholder')}
        />
        <Field
          id="contactEmail"
          label={t('wizard.step2.contactEmailLabel')}
          type="email"
          required
          value={form.contactEmail}
          onChange={v => setForm(f => ({ ...f, contactEmail: v }))}
          placeholder={t('wizard.step2.contactEmailPlaceholder')}
        />
        <Field
          id="contactPhone"
          label={t('wizard.step2.contactPhoneLabel')}
          type="tel"
          value={form.contactPhone}
          onChange={v => setForm(f => ({ ...f, contactPhone: v }))}
          placeholder={t('wizard.step2.contactPhonePlaceholder')}
        />
        <Field
          id="website"
          label={t('wizard.step2.websiteLabel')}
          type="url"
          value={form.website}
          onChange={v => setForm(f => ({ ...f, website: v }))}
          placeholder={t('wizard.step2.websitePlaceholder')}
        />
      </div>

      {/* Credentials (schema-driven) */}
      {credentialFields.length > 0 && (
        <div className="rounded-2xl border border-input bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('wizard.credentials.title')}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCredentials(s => !s)} className="gap-2">
              {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showCredentials ? t('wizard.credentials.hideButton') : t('wizard.credentials.showButton')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('wizard.credentials.help')}</p>
          {credentialFields.map(({ key, def, required }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`cred-${key}`}>
                {key} {required && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id={`cred-${key}`}
                type={showCredentials ? 'text' : 'password'}
                className="h-12 text-base font-mono"
                value={form.credentials[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, credentials: { ...f.credentials, [key]: e.target.value } }))}
                placeholder={def.description ?? key}
                autoComplete="new-password"
                data-1p-ignore
              />
              {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Sandbox toggle */}
      <div className="rounded-2xl border border-input bg-card p-6 flex items-center justify-between">
        <div className="space-y-1">
          <Label>{t('wizard.step2.sandboxLabel')}</Label>
          <p className="text-xs text-muted-foreground">{t('wizard.step2.sandboxHelp')}</p>
        </div>
        <Switch checked={form.sandboxMode} onCheckedChange={v => setForm(f => ({ ...f, sandboxMode: v }))} />
      </div>
    </div>
  )
}

// Small helper for repeated input rows
function Field({
  id,
  label,
  type = 'text',
  required,
  value,
  onChange,
  placeholder,
  help,
}: {
  id: string
  label: string
  type?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  help?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        className="h-12 text-base"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        data-1p-ignore
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

// ─── Resume views ──────────────────────────────────────────────────────────

/**
 * Inline editor for the 3 fields Stripe doesn't own: channelName,
 * contactEmail, website. Visible inside the COMPLETED ResumeView (and
 * conceptually usable in other states too, but we only show it once
 * onboarding finished to keep the flow focused).
 */
function LocalInfoEditor({ merchant, venueId }: { merchant: EcommerceMerchant; venueId: string }) {
  const { t } = useTranslation('ecommerce')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [channelName, setChannelName] = useState(merchant.channelName)
  const [contactEmail, setContactEmail] = useState(merchant.contactEmail)
  const [website, setWebsite] = useState(merchant.website ?? '')

  const isDirty =
    channelName.trim() !== merchant.channelName ||
    contactEmail.trim() !== merchant.contactEmail ||
    website.trim() !== (merchant.website ?? '')

  const updateMutation = useMutation({
    mutationFn: () =>
      ecommerceMerchantAPI.update(venueId, merchant.id, {
        channelName: channelName.trim(),
        contactEmail: contactEmail.trim(),
        website: website.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      toast({ title: t('wizard.edit.savedToast', 'Cambios guardados') })
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || err?.message || 'No se pudo actualizar',
        variant: 'destructive',
      })
    },
  })

  return (
    <details className="rounded-2xl border border-input bg-card overflow-hidden group">
      <summary className="cursor-pointer px-6 py-4 font-medium select-none flex items-center justify-between list-none hover:bg-muted/30 transition-colors">
        <span>{t('wizard.edit.title')}</span>
        <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="p-6 border-t border-input space-y-5">
        <Field
          id="edit-channelName"
          label={t('wizard.step2.channelNameLabel')}
          required
          value={channelName}
          onChange={setChannelName}
          placeholder={t('wizard.step2.channelNamePlaceholder')}
          help={t('wizard.step2.channelNameHelp')}
        />
        <Field
          id="edit-contactEmail"
          label={t('wizard.step2.contactEmailLabel')}
          type="email"
          required
          value={contactEmail}
          onChange={setContactEmail}
          placeholder={t('wizard.step2.contactEmailPlaceholder')}
        />
        <Field
          id="edit-website"
          label={t('wizard.step2.websiteLabel')}
          type="url"
          value={website}
          onChange={setWebsite}
          placeholder={t('wizard.step2.websitePlaceholder')}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={!isDirty || updateMutation.isPending || !channelName.trim() || !contactEmail.trim()}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('wizard.edit.savingButton')}
              </>
            ) : (
              t('wizard.edit.saveButton')
            )}
          </Button>
        </div>
      </div>
    </details>
  )
}

function ResumeView({ merchant, venueId }: { merchant: EcommerceMerchant; venueId: string }) {
  const { t } = useTranslation('ecommerce')
  const status = merchant.onboardingStatus

  if (status === 'COMPLETED') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Alert className="border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-300">{t('wizard.resume.completedTitle')}</AlertTitle>
          <AlertDescription className="text-sm">{t('wizard.resume.completedDesc')}</AlertDescription>
        </Alert>

        {/* Local info editor — channelName / contactEmail / website. The rest
            of the merchant's fiscal info lives in Stripe and is edited there. */}
        <LocalInfoEditor merchant={merchant} venueId={venueId} />
      </div>
    )
  }

  if (status === 'RESTRICTED') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>{t('wizard.resume.restrictedTitle')}</AlertTitle>
          <AlertDescription>{t('wizard.resume.restrictedDesc')}</AlertDescription>
        </Alert>
        {merchant.requirementsDue && merchant.requirementsDue.length > 0 && (
          <div className="rounded-2xl border border-input bg-card p-6">
            <ul className="space-y-2.5 text-sm">
              {merchant.requirementsDue.map(req => {
                const label = formatStripeRequirement(req)
                return (
                  <li key={req} className="flex items-start gap-2.5">
                    <span className="text-destructive mt-1.5 leading-none">•</span>
                    <span className="flex-1">
                      <span>{label}</span>
                      <code className="ml-2 text-[10px] text-muted-foreground/70 font-mono">({req})</code>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // IN_PROGRESS or NOT_STARTED with existing connectAccountId
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Alert>
        <Info className="h-5 w-5" />
        <AlertTitle>{t('wizard.resume.inProgressTitle')}</AlertTitle>
        <AlertDescription>{t('wizard.resume.inProgressDesc')}</AlertDescription>
      </Alert>
    </div>
  )
}

// ─── Main orchestrator ─────────────────────────────────────────────────────

export function EcommerceMerchantWizard({ open, onClose, venueId, merchant }: Props) {
  const { t } = useTranslation('ecommerce')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isResume = !!merchant
  const isStripeResume = isResume && merchant.provider?.code === 'STRIPE_CONNECT'

  // For resume of a non-Stripe provider, treat as edit: go straight to step 2 with provider locked.
  const [step, setStep] = useState<1 | 2>(isResume ? 2 : 1)
  const [providerId, setProviderId] = useState<string | null>(merchant?.providerId ?? null)
  const [form, setForm] = useState<FormData>({
    ...emptyForm,
    channelName: merchant?.channelName ?? emptyForm.channelName,
    businessName: merchant?.businessName ?? '',
    rfc: merchant?.rfc ?? '',
    contactEmail: merchant?.contactEmail ?? '',
    contactPhone: merchant?.contactPhone ?? '',
    website: merchant?.website ?? '',
    sandboxMode: merchant?.sandboxMode ?? true,
  })

  // Reset state when modal opens fresh
  useEffect(() => {
    if (open) {
      if (isResume && merchant) {
        setStep(2)
        setProviderId(merchant.providerId)
        setForm({
          ...emptyForm,
          channelName: merchant.channelName,
          businessName: merchant.businessName ?? '',
          rfc: merchant.rfc ?? '',
          contactEmail: merchant.contactEmail,
          contactPhone: merchant.contactPhone ?? '',
          website: merchant.website ?? '',
          sandboxMode: merchant.sandboxMode,
        })
      } else {
        setStep(1)
        setProviderId(null)
        setForm(emptyForm)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, merchant?.id])

  // Fetch available providers (auth: venue access — not superadmin-locked)
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['ecommerce-available-providers', venueId],
    queryFn: () => ecommerceMerchantAPI.listAvailableProviders(venueId),
    enabled: open && !isResume,
  })

  const selectedProvider = useMemo(
    () => providers.find(p => p.id === providerId) ?? merchant?.provider ?? null,
    [providers, providerId, merchant],
  )
  const isStripe = (selectedProvider?.code ?? merchant?.provider?.code) === 'STRIPE_CONNECT'

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: CreateEcommerceMerchantData) => ecommerceMerchantAPI.create(venueId, data),
  })

  const stripeOnboardMutation = useMutation({
    mutationFn: ({ merchantId, businessType }: { merchantId: string; businessType: 'company' | 'individual' }) =>
      // Pass current pathname so Stripe redirects back to wherever the user
      // started the flow (could be /edit/integrations, /ecommerce-merchants,
      // payment-links, or home checklist), instead of always falling back to
      // the legacy /ecommerce-merchants admin page.
      ecommerceMerchantAPI.createStripeOnboardingLink(venueId, merchantId, businessType, window.location.pathname),
  })

  const isSubmittingStripe = createMutation.isPending || stripeOnboardMutation.isPending
  const isContinuingStripe = stripeOnboardMutation.isPending

  // ── Handlers ─────────────────────────────────────────────────────────────

  /** Stripe Connect create flow: create record → request onboarding URL → redirect */
  const handleStripeSubmit = async () => {
    if (!providerId) return
    try {
      const created = await createMutation.mutateAsync({
        channelName: form.channelName.trim(),
        businessName: form.channelName.trim(), // server defaults businessName→channelName for Stripe
        contactEmail: form.contactEmail.trim(),
        providerId,
        providerCredentials: { businessType: form.businessType },
        sandboxMode: false, // Stripe Connect uses production keys + Stripe handles test mode
        active: true,
      })
      const link = await stripeOnboardMutation.mutateAsync({
        merchantId: created.id,
        businessType: form.businessType,
      })
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      window.location.assign(link.url)
    } catch (err: any) {
      toast({
        title: t('common:error', 'Error'),
        description: err?.response?.data?.error || err?.message || 'No se pudo conectar con Stripe',
        variant: 'destructive',
      })
    }
  }

  /** Generic provider create: just POST /ecommerce-merchants */
  const handleGenericSubmit = async () => {
    if (!providerId) return
    try {
      const created = await createMutation.mutateAsync({
        channelName: form.channelName.trim(),
        businessName: form.businessName.trim(),
        rfc: form.rfc.trim() || undefined,
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        website: form.website.trim() || undefined,
        providerId,
        providerCredentials: form.credentials,
        sandboxMode: form.sandboxMode,
        active: true,
      })
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })
      toast({
        title: t('common:success', 'Listo'),
        description: t('wizard.create.successToast', { name: created.channelName }),
      })
      onClose()
    } catch (err: any) {
      toast({
        title: t('common:error', 'Error'),
        description: err?.response?.data?.error || err?.message || 'No se pudo crear el canal',
        variant: 'destructive',
      })
    }
  }

  /** Resume: regenerate onboarding URL for existing Stripe merchant */
  const handleResumeContinue = async () => {
    if (!merchant) return
    try {
      const link = await stripeOnboardMutation.mutateAsync({
        merchantId: merchant.id,
        businessType: (merchant.provider?.code === 'STRIPE_CONNECT'
          ? ((merchant as any).providerCredentials?.businessType ?? 'company')
          : 'company') as 'company' | 'individual',
      })
      window.location.assign(link.url)
    } catch (err: any) {
      toast({
        title: t('common:error', 'Error'),
        description: err?.response?.data?.error || err?.message || 'No se pudo generar el enlace',
        variant: 'destructive',
      })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const title = isResume ? t('wizard.editTitle') : t('wizard.createTitle')

  // Validity for the generic Step 2 form. Lifted here so the header CTA can
  // disable itself without each step rendering its own button. Matches the
  // same logic Step2Generic used internally before the refactor.
  const genericRequiredFilled = useMemo(() => {
    if (!selectedProvider) return false
    const props = (selectedProvider as AvailablePaymentProvider).configSchema?.properties ?? {}
    const required = new Set((selectedProvider as AvailablePaymentProvider).configSchema?.required ?? [])
    const credFieldsOk = Object.keys(props).every(k => !required.has(k) || (form.credentials[k] ?? '').trim())
    return !!form.channelName.trim() && !!form.businessName.trim() && !!form.contactEmail.trim() && credFieldsOk
  }, [selectedProvider, form])

  const renderBody = () => {
    if (isStripeResume && merchant) {
      return <ResumeView merchant={merchant} venueId={venueId} />
    }
    if (step === 1) {
      return (
        <Step1ProviderPicker
          providers={providers}
          loading={loadingProviders}
          selectedId={providerId}
          onSelect={setProviderId}
        />
      )
    }
    if (isStripe) {
      return <Step2Stripe form={form} setForm={setForm} onBack={() => setStep(1)} showBack={!isResume} />
    }
    if (selectedProvider) {
      return (
        <Step2Generic
          provider={selectedProvider as AvailablePaymentProvider}
          form={form}
          setForm={setForm}
          onBack={() => setStep(1)}
        />
      )
    }
    return null
  }

  /**
   * Primary CTA for the modal header (FullScreenModal `actions` slot). The
   * label, target action and disabled state vary per step and per Stripe
   * onboarding status. Returns `null` for views with no positive action
   * (e.g. COMPLETED — the user can only navigate to Stripe Dashboard, which
   * is a secondary external link rendered inside the content).
   */
  const renderHeaderAction = (): React.ReactNode => {
    // Resume mode for Stripe Connect
    if (isStripeResume && merchant) {
      if (merchant.onboardingStatus === 'COMPLETED') {
        return (
          <Button variant="outline" asChild>
            <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">
              {t('wizard.resume.stripeDashboardButton')} <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        )
      }
      const label =
        merchant.onboardingStatus === 'RESTRICTED' ? t('wizard.resume.completeButton') : t('wizard.resume.continueButton')
      return (
        <Button onClick={handleResumeContinue} disabled={isContinuingStripe}>
          {isContinuingStripe ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('wizard.resume.regeneratingButton')}
            </>
          ) : (
            <>
              {label} <ExternalLink className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )
    }

    // Create flow
    if (step === 1) {
      return (
        <Button onClick={() => setStep(2)} disabled={!providerId}>
          {t('wizard.step1.nextButton')}
        </Button>
      )
    }
    if (isStripe) {
      return (
        <Button
          onClick={handleStripeSubmit}
          disabled={isSubmittingStripe || !form.channelName.trim() || !form.contactEmail.trim()}
          data-tour="ecommerce-wizard-connect-stripe"
        >
          {isSubmittingStripe ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('wizard.stripe.preparingButton')}
            </>
          ) : (
            <>
              {t('wizard.stripe.connectButton')} <ExternalLink className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )
    }
    if (selectedProvider) {
      return (
        <Button onClick={handleGenericSubmit} disabled={!genericRequiredFilled || createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('wizard.create.submittingButton')}
            </>
          ) : (
            t('wizard.create.submitButton')
          )}
        </Button>
      )
    }
    return null
  }

  return (
    <FullScreenModal open={open} onClose={onClose} title={title} actions={renderHeaderAction()} contentClassName="bg-muted/30">
      <div className="px-4 py-8 md:px-8">{renderBody()}</div>
    </FullScreenModal>
  )
}
