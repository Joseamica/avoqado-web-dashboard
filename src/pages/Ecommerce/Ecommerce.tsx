import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { ecommerceMerchantAPI, type EcommerceMerchant } from '@/services/ecommerceMerchant.service'
import { EcommerceMerchantWizard } from '@/pages/Venue/components/EcommerceMerchantWizard'
import { Code2, Copy, Check, AlertCircle, ArrowRight, CreditCard } from 'lucide-react'

const WIDGET_SRC = 'https://cdn.avoqado.io/checkout-widget.js'

/** A merchant is "usable" for online charging when it can actually take money:
 *  Stripe with charges enabled, or a connected Mercado Pago. */
const isUsable = (m: EcommerceMerchant) =>
  m.active && ((m.provider?.code === 'STRIPE_CONNECT' && m.chargesEnabled) || m.provider?.code === 'MERCADO_PAGO')

const Ecommerce: React.FC = () => {
  const { t } = useTranslation(['ecommerce'])
  const { toast } = useToast()
  const { venueId, venueSlug, fullBasePath } = useCurrentVenue()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  /** When set, opens the full-screen wizard to manage that processor in place. */
  const [managingMerchant, setManagingMerchant] = useState<EcommerceMerchant | null>(null)

  // Interactive snippet builder.
  const [amountType, setAmountType] = useState<'fixed' | 'open'>('fixed')
  const [amount, setAmount] = useState('100')
  const [mode, setMode] = useState<'inline' | 'modal'>('inline')

  const { data: merchants = [], isLoading } = useQuery({
    queryKey: ['ecommerce-merchants', venueId, 'ecommerce-page'],
    queryFn: () => ecommerceMerchantAPI.listByVenue(venueId!),
    enabled: !!venueId,
  })

  const canTransact = useMemo(() => merchants.some(isUsable), [merchants])
  const integrationsHref = `${fullBasePath}/edit/integrations`

  // Build the embed snippet from the live selections. Inline is the widget's
  // default so we only emit data-mode for modal; data-amount only when fixed.
  const attrs = [`data-venue="${venueSlug}"`]
  if (mode === 'modal') attrs.push('data-mode="modal"')
  if (amountType === 'fixed' && amount.trim()) attrs.push(`data-amount="${amount.trim()}"`)
  const snippet = `<script src="${WIDGET_SRC}" async></script>\n<avoqado-checkout ${attrs.join(' ')}></avoqado-checkout>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      toast({ title: t('paymentWidget.copied') })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: t('paymentWidget.copyError'), variant: 'destructive' })
    }
  }

  const statusBadge = (m: EcommerceMerchant) => {
    if (isUsable(m)) return <Badge variant="default">{t('paymentWidget.statusActive')}</Badge>
    return <Badge variant="secondary">{t('paymentWidget.statusPending')}</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('paymentWidget.pageTitle')}</h1>
        <p className="mt-1 text-muted-foreground">{t('paymentWidget.pageDescription')}</p>
      </div>

      {/* Connected processors */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('paymentWidget.processorsTitle')}</CardTitle>
          </div>
          <CardDescription>{t('paymentWidget.processorsHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('paymentWidget.loading')}</p>
          ) : merchants.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg bg-muted/50 p-6">
              <p className="text-sm text-muted-foreground">{t('paymentWidget.noProcessors')}</p>
              <Button asChild>
                <Link to={integrationsHref}>
                  {t('paymentWidget.connectCta')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg bg-muted/50">
              {merchants.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.provider?.name ?? m.channelName}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.channelName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(m)}
                    <Button variant="ghost" size="sm" onClick={() => setManagingMerchant(m)}>
                      {t('paymentWidget.manage')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Embed snippet */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('paymentWidget.snippetTitle')}</CardTitle>
          </div>
          <CardDescription>{t('paymentWidget.snippetHint')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!canTransact && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {t('paymentWidget.needsProcessor')}
                <Link to={integrationsHref} className="font-medium underline underline-offset-2">
                  {t('paymentWidget.connectCta')}
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Builder controls — drive the snippet below */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('paymentWidget.amountTypeLabel')}</Label>
              <Tabs value={amountType} onValueChange={v => setAmountType(v as 'fixed' | 'open')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="fixed">{t('paymentWidget.amountFixed')}</TabsTrigger>
                  <TabsTrigger value="open">{t('paymentWidget.amountOpen')}</TabsTrigger>
                </TabsList>
              </Tabs>
              {amountType === 'fixed' ? (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pl-7"
                    aria-label={t('paymentWidget.amountFixed')}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('paymentWidget.amountOpenHint')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('paymentWidget.modeLabel')}</Label>
              <Tabs value={mode} onValueChange={v => setMode(v as 'inline' | 'modal')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="inline">{t('paymentWidget.modeInline')}</TabsTrigger>
                  <TabsTrigger value="modal">{t('paymentWidget.modeModal')}</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {mode === 'inline' ? t('paymentWidget.modeInlineHint') : t('paymentWidget.modeModalHint')}
              </p>
            </div>
          </div>

          {/* Live snippet */}
          <div className={`relative rounded-lg bg-muted ${canTransact ? '' : 'opacity-50'}`}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 gap-1.5"
              onClick={handleCopy}
              disabled={!canTransact}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('paymentWidget.copiedShort') : t('paymentWidget.copy')}
            </Button>
            <pre className="overflow-x-auto p-4 pr-24 font-mono text-[13px] leading-relaxed text-muted-foreground">
              <code>{snippet}</code>
            </pre>
          </div>

          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5 text-xs">avoqado:pago-exitoso</code> {t('paymentWidget.eventBody')}
          </p>
        </CardContent>
      </Card>

      {/* Manage a processor in place — same full-screen wizard the e-commerce
          channel page uses, opened directly for the row the user clicked. */}
      <EcommerceMerchantWizard
        open={!!managingMerchant}
        onClose={() => {
          setManagingMerchant(null)
          queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId, 'ecommerce-page'] })
        }}
        venueId={venueId ?? ''}
        merchant={managingMerchant}
      />
    </div>
  )
}

export default Ecommerce
