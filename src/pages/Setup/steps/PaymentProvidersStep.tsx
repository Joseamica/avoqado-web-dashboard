/**
 * PaymentProvidersStep — V2 wizard Step 8 (optional).
 *
 * View A: empty (two tiles + skip link)
 * View C: at least one provider connected (rendered when paymentProviders has IDs)
 * View D: test payment link sub-flow (triggered from View C — implemented in Task 15)
 *
 * State preservation across OAuth round-trip relies on:
 *   1. Pre-redirect saveStep(8, {mpConnecting: true}) so currentStep persists.
 *   2. SetupWizard hydrates this component from URL params on return.
 *
 * Spec: docs/superpowers/specs/2026-05-27-onboarding-payment-providers-design.md
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { setupService } from '@/services/setup.service'
import { ecommerceMerchantAPI } from '@/services/ecommerceMerchant.service'
import { useToast } from '@/hooks/use-toast'
import type { StepProps } from '../types'

const MP_INITIATE_PATH = '/api/v1/integrations/mercadopago/oauth/connect'

interface PaymentProvidersStepProps extends StepProps {
  venueId: string
  organizationId: string
  /** Pre-existing merchants resolved from the backend. */
  mpMerchantId?: string | null
  stripeMerchantId?: string | null
}

export function PaymentProvidersStep({
  data,
  onNext,
  venueId,
  organizationId,
  mpMerchantId,
  stripeMerchantId,
}: PaymentProvidersStepProps) {
  const { t } = useTranslation('setup')
  const { toast } = useToast()

  const mpConnected = Boolean(mpMerchantId ?? data.paymentProviders?.mpMerchantId)
  const stripeConnected = Boolean(stripeMerchantId ?? data.paymentProviders?.stripeMerchantId)
  const anyConnected = mpConnected || stripeConnected

  // Resolve available providers so we can map MERCADO_PAGO / STRIPE_CONNECT codes
  // → the UUID `providerId` the create endpoint expects. The list is small (one
  // row per active provider) and the query is cheap; we don't gate the buttons
  // on it loading because clicks already disable below.
  const { data: providers = [] } = useQuery({
    queryKey: ['ecommerce-available-providers', venueId],
    queryFn: () => ecommerceMerchantAPI.listAvailableProviders(venueId),
    enabled: Boolean(venueId),
  })

  const findProviderId = (code: 'MERCADO_PAGO' | 'STRIPE_CONNECT'): string | null =>
    providers.find(p => p.code === code)?.id ?? null

  // Defaults pulled from earlier wizard steps so the operator doesn't re-enter
  // them. `businessName` falls back to `commercialName` (some entity types
  // collect that one instead).
  const businessName = (data.businessName ?? data.commercialName ?? '').trim()
  const contactEmail = (data.email ?? '').trim()

  const handleConnectMP = async () => {
    // 1. Mark step 8 as in-progress BEFORE leaving so a tab close still resumes here.
    // 2. Reuse an existing MP merchant if there is one (paused mid-OAuth from a
    //    previous attempt). Otherwise create a new one in NOT_STARTED state.
    try {
      await setupService.saveStep(organizationId, 8, { mpConnecting: true })
      let merchantId = mpMerchantId
      if (!merchantId) {
        const providerId = findProviderId('MERCADO_PAGO')
        if (!providerId) {
          toast({
            title: t('step8.noProvider', { defaultValue: 'Proveedor no disponible' }),
            description: 'Mercado Pago no está habilitado para esta venue.',
            variant: 'destructive',
          })
          return
        }
        const created = await ecommerceMerchantAPI.create(venueId, {
          channelName: businessName || 'Web Principal',
          businessName: businessName || undefined,
          contactEmail,
          providerId,
          providerCredentials: {}, // OAuth callback fills tokens
          sandboxMode: true,
          active: true,
        })
        merchantId = created.id
      }
      window.location.assign(
        `${MP_INITIATE_PATH}?venueId=${venueId}&ecommerceMerchantId=${merchantId}&from=wizard`,
      )
    } catch (err) {
      toast({ title: 'No pudimos preparar la conexión', description: String(err), variant: 'destructive' })
    }
  }

  const handleConnectStripe = async () => {
    // Stripe is two API calls: create merchant + create onboarding link.
    // The link includes return_url back to /setup#step-7 so the wizard resumes.
    try {
      await setupService.saveStep(organizationId, 8, { stripeConnecting: true })
      let merchantId = stripeMerchantId
      if (!merchantId) {
        const providerId = findProviderId('STRIPE_CONNECT')
        if (!providerId) {
          toast({
            title: t('step8.noProvider', { defaultValue: 'Proveedor no disponible' }),
            description: 'Stripe no está habilitado para esta venue.',
            variant: 'destructive',
          })
          return
        }
        const created = await ecommerceMerchantAPI.create(venueId, {
          channelName: businessName || 'Stripe',
          businessName: businessName || undefined,
          contactEmail,
          providerId,
          providerCredentials: { businessType: 'company' },
          sandboxMode: false, // Stripe handles test mode via Connect itself
          active: true,
        })
        merchantId = created.id
      }
      const returnPath = `/setup?stripe_status=success&merchantId=${merchantId}#step-7`
      const { url } = await ecommerceMerchantAPI.createStripeOnboardingLink(venueId, merchantId, 'company', returnPath)
      window.location.assign(url)
    } catch (err) {
      toast({ title: 'No pudimos preparar la conexión', description: String(err), variant: 'destructive' })
    }
  }

  const handleSkip = () => onNext({ paymentProviders: { skipped: true } })
  const handleFinish = () =>
    onNext({
      paymentProviders: {
        mpMerchantId: mpMerchantId ?? null,
        stripeMerchantId: stripeMerchantId ?? null,
        skipped: false,
      },
    })

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {anyConnected
            ? t('step8.titleConnected', { defaultValue: '¡Una cuenta lista!' })
            : t('step8.title', { defaultValue: 'Activa cobros online (opcional)' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t('step8.subtitle', {
            defaultValue: 'Conecta Mercado Pago o Stripe para recibir pagos por checkout y ligas de pago.',
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProviderTile
          name="Mercado Pago"
          connected={mpConnected}
          onConnect={handleConnectMP}
          tConnected={t('step8.connected', { defaultValue: 'Conectado' })}
          tConnect={t('step8.connect', { defaultValue: 'Conectar' })}
        />
        <ProviderTile
          name="Stripe"
          connected={stripeConnected}
          onConnect={handleConnectStripe}
          tConnected={t('step8.connected', { defaultValue: 'Conectado' })}
          tConnect={t('step8.connect', { defaultValue: 'Conectar' })}
        />
      </div>

      {anyConnected ? (
        <div className="flex flex-col gap-3 pt-4 border-t">
          <p className="text-sm">
            {t('step8.tryItPrompt', { defaultValue: '¿Quieres probarlo con una liga de pago real?' })}
          </p>
          <div className="flex gap-3">
            <TestLinkLauncher
              venueId={venueId}
              provider={mpConnected ? 'MERCADO_PAGO' : 'STRIPE'}
            />
            <Button onClick={handleFinish} className="rounded-full">
              {t('step8.finish', { defaultValue: 'Terminar onboarding →' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t">
          <button onClick={handleSkip} className="text-sm text-muted-foreground hover:underline">
            {t('step8.skip', { defaultValue: 'Saltar por ahora →' })}
          </button>
        </div>
      )}
    </div>
  )
}

function ProviderTile({
  name,
  connected,
  onConnect,
  tConnected,
  tConnect,
}: {
  name: string
  connected: boolean
  onConnect: () => void
  tConnected: string
  tConnect: string
}) {
  // Suppress unused state warning by retaining the prop even though not used inline
  const [_open] = useState(false)
  void _open
  return (
    <Card className="p-6 flex flex-col gap-4">
      <h3 className="font-semibold text-lg">{name}</h3>
      {connected ? (
        <p className="text-sm text-emerald-600 font-medium">✓ {tConnected}</p>
      ) : (
        <Button onClick={onConnect} className="w-full rounded-full">
          {tConnect}
        </Button>
      )}
    </Card>
  )
}

function TestLinkLauncher({ venueId, provider }: { venueId: string; provider: 'MERCADO_PAGO' | 'STRIPE' }) {
  const { t } = useTranslation('setup')
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('100')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ url: string; qrCodeUrl: string; whatsappSent: boolean } | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const { data } = await setupService.testPaymentLink(venueId, {
        amount: Number(amount),
        providerCode: provider,
      })
      setResult({ url: data.url, qrCodeUrl: data.qrCodeUrl, whatsappSent: data.whatsappSent })
      if (!data.whatsappSent) {
        toast({
          title: t('step8.waFailed', { defaultValue: 'No pudimos enviar por WhatsApp.' }),
          description: t('step8.waFallback', { defaultValue: 'La liga sigue disponible aquí.' }),
        })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || String(err), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        {t('step8.generateTestLink', { defaultValue: 'Generar liga de prueba' })}
      </Button>
    )
  }

  if (result) {
    return (
      <Card className="p-4 flex flex-col gap-3 w-full">
        {result.whatsappSent && (
          <p className="text-sm text-emerald-600">
            ✓ {t('step8.waSent', { defaultValue: 'Liga enviada por WhatsApp' })}
          </p>
        )}
        <p className="text-xs text-muted-foreground break-all">{result.url}</p>
        <img src={result.qrCodeUrl} alt="QR" className="w-32 h-32" />
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(result.url)}>
          {t('step8.copy', { defaultValue: 'Copiar liga' })}
        </Button>
      </Card>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{t('step8.amountLabel', { defaultValue: '$' })}</span>
      <input
        type="number"
        min={1}
        max={10000}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 px-3 py-2 rounded-md border border-input text-sm"
      />
      <span className="text-sm">MXN</span>
      <Button size="sm" onClick={handleSubmit} disabled={submitting} className="rounded-full">
        {submitting
          ? t('step8.sending', { defaultValue: 'Generando…' })
          : t('step8.send', { defaultValue: 'Enviar' })}
      </Button>
    </div>
  )
}
