import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2, Plus, ShieldCheck, Store, Upload } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ToastAction } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useFiscalConfig, useProvisionEmisor, useTriggerGlobalCfdi, useUpsertMerchantConfig } from '@/hooks/use-cfdi'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { ecommerceMerchantAPI } from '@/services/ecommerceMerchant.service'
import type { CsdStatus, Emisor, GlobalCfdiResult, GlobalPeriod, MerchantConfig } from '@/services/cfdi.service'
import { EmisorFormModal } from './components/EmisorFormModal'
import { UploadCsdModal } from './components/UploadCsdModal'

function csdBadgeVariant(status: CsdStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'EXPIRED':
    case 'REVOKED':
      return 'destructive'
    default:
      return 'outline'
  }
}

function merchantLabel(config: MerchantConfig): string {
  return (
    config.merchantAccount?.displayName ||
    config.merchantAccount?.alias ||
    config.ecommerceMerchant?.channelName ||
    config.id
  )
}

/** Human label for the period a stamped global CFDI covers, e.g. "06/2026". */
function formatGlobalPeriod(period?: GlobalPeriod | null): string {
  if (!period) return ''
  const meses = period.meses ? `${period.meses}/` : ''
  return `${meses}${period.anio ?? ''}`.trim()
}

/**
 * Flow C — manually stamp the period's global CFDI ("Público en General") per
 * emisor. One card per emisor: shows its periodicity + a CSD-status hint, and a
 * confirm-gated trigger button. The endpoint has six distinct outcomes (201
 * stamped, 200 nothing-to-invoice, 409 CSD inactivo / en proceso, 422, 502,
 * 404) — each gets its own toast styling here.
 */
function GlobalInvoiceSection({ emisores }: { emisores: Emisor[] }) {
  const { t } = useTranslation('cfdi')
  const { toast } = useToast()
  const triggerMutation = useTriggerGlobalCfdi()

  // The emisor whose confirmation dialog is open (null = closed), plus the
  // emisor id currently being stamped so we only spin the clicked button.
  const [confirmEmisor, setConfirmEmisor] = useState<Emisor | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const runTrigger = (emisor: Emisor) => {
    setPendingId(emisor.id)
    triggerMutation.mutate(emisor.id, {
      onSuccess: result => handleSuccess(result),
      onError: err => handleError(err),
      onSettled: () => {
        setPendingId(null)
        setConfirmEmisor(null)
      },
    })
  }

  const handleSuccess = (result: GlobalCfdiResult) => {
    // 200 — nothing to invoice for the period. Success-ish, NOT an error: use
    // the default (non-destructive) toast styling.
    if ('status' in result && result.status === 'NOTHING_TO_INVOICE') {
      toast({ title: t('globalInvoice.toast.nothingTitle'), description: result.message })
      return
    }
    // 201 — stamped. Surface serie-folio (+ a PDF link when available).
    if ('cfdi' in result && result.cfdi) {
      const { serie, folio, pdfUrl, globalPeriod } = result.cfdi
      const period = formatGlobalPeriod(globalPeriod)
      toast({
        title: t('globalInvoice.toast.stampedTitle', { folio: `${serie}-${folio}` }),
        description: period ? t('globalInvoice.toast.stampedDescription', { period }) : undefined,
        action: pdfUrl ? (
          <ToastAction altText={t('globalInvoice.toast.openPdf')} onClick={() => window.open(pdfUrl, '_blank', 'noopener')}>
            {t('globalInvoice.toast.openPdf')}
          </ToastAction>
        ) : undefined,
      })
    }
  }

  const handleError = (err: any) => {
    const status: number | undefined = err?.response?.status
    const data = err?.response?.data ?? {}
    const error: string | undefined = data?.error
    const message: string | undefined = data?.message
    const reasons: string[] | undefined = Array.isArray(data?.reasons) ? data.reasons : undefined

    switch (status) {
      case 409:
        // Two distinct 409s: "en proceso" (already running) vs CSD inactivo.
        if (typeof error === 'string' && /en proceso/i.test(error)) {
          toast({ title: t('globalInvoice.toast.inProcessTitle'), description: error, variant: 'destructive' })
        } else {
          toast({ title: t('globalInvoice.toast.csdInactiveTitle'), description: error, variant: 'destructive' })
        }
        return
      case 422:
        toast({
          title: error || t('globalInvoice.toast.validationTitle'),
          description: reasons?.length ? reasons.join(' · ') : message,
          variant: 'destructive',
        })
        return
      case 502:
        toast({ title: t('globalInvoice.toast.pacRejectedTitle'), description: message || error, variant: 'destructive' })
        return
      case 404:
        toast({ title: t('globalInvoice.toast.notFoundTitle'), description: error, variant: 'destructive' })
        return
      default:
        toast({ title: t('globalInvoice.toast.genericTitle'), description: error || message, variant: 'destructive' })
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('globalInvoice.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('globalInvoice.description')}</p>
      </div>

      {emisores.length === 0 ? (
        <div className="rounded-lg border border-input bg-card p-8 text-center text-sm text-muted-foreground">
          {t('globalInvoice.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {emisores.map(emisor => {
            const csdActive = emisor.csdStatus === 'ACTIVE'
            const isPending = pendingId === emisor.id
            return (
              <div key={emisor.id} className="rounded-xl border border-input bg-card p-5 space-y-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{emisor.legalName}</p>
                  <p className="text-sm text-muted-foreground">{emisor.rfc}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t('globalInvoice.periodicityLabel')}: {t(`periodicity.${emisor.globalPeriodicity}`)}
                  </span>
                </div>

                {!csdActive && (
                  <p className="rounded-lg border border-input bg-muted/40 p-3 text-xs text-muted-foreground">
                    {t('globalInvoice.csdInactiveNote')}
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  data-tour="cfdi-global-trigger-btn"
                  disabled={!csdActive || isPending}
                  onClick={() => setConfirmEmisor(emisor)}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('globalInvoice.triggering')}
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      {t('globalInvoice.trigger')}
                    </>
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!confirmEmisor} onOpenChange={open => !open && setConfirmEmisor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('globalInvoice.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmEmisor
                ? t('globalInvoice.confirm.description', {
                    periodicity: t(`periodicity.${confirmEmisor.globalPeriodicity}`),
                    emisor: confirmEmisor.legalName,
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={triggerMutation.isPending}>{t('globalInvoice.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={triggerMutation.isPending}
              onClick={e => {
                // Keep the dialog open while the request is in flight; close on settle.
                e.preventDefault()
                if (confirmEmisor) runTrigger(confirmEmisor)
              }}
            >
              {triggerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('globalInvoice.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/**
 * Placeholder emisor cards shown BEHIND the teaser blur when the venue lacks
 * the CFDI feature. Realistic-looking fake data — never hits the API.
 */
const SAMPLE_EMISORES: Emisor[] = [
  {
    id: 'sample-emisor-1', venueId: 'sample', rfc: 'ABC120101XYZ', legalName: 'Mi Negocio SA de CV',
    regimenFiscal: '601', lugarExpedicion: '06000', provider: 'facturapi', providerOrgId: 'org_sample',
    csdStatus: 'ACTIVE', csdExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    csdLastCheckedAt: new Date().toISOString(), serie: 'A', defaultUsoCfdi: 'G03', globalPeriodicity: 'MENSUAL',
    invoiceCashSales: false, includeCashInAccounting: false, isnRate: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-emisor-2', venueId: 'sample', rfc: 'XYZ980505QW7', legalName: 'Sucursal Centro SA de CV',
    regimenFiscal: '626', lugarExpedicion: '64000', provider: 'facturapi', providerOrgId: null,
    csdStatus: 'NONE', csdExpiresAt: null, csdLastCheckedAt: null, serie: 'B', defaultUsoCfdi: 'G03',
    globalPeriodicity: 'SEMANAL', invoiceCashSales: false, includeCashInAccounting: false, isnRate: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

/**
 * A merchant of the venue that does NOT yet have a MerchantFiscalConfig. The
 * fiscal/config endpoint only returns merchants that already have a config, so
 * we list the venue's merchants from their own endpoints (in-person via
 * payment-config, online via ecommerce-merchants) and subtract the configured
 * ones to build the "add" dropdown.
 */
type UnconfiguredMerchant =
  | { kind: 'merchantAccount'; id: string; label: string }
  | { kind: 'ecommerceMerchant'; id: string; label: string }

/**
 * "Agregar comercio" — lets the user attach a fiscal config to a merchant that
 * has none yet. Lists the venue's in-person merchant accounts + e-commerce
 * channels, removes the ones already in `merchantConfigs`, and on add calls the
 * SAME upsert hook the rows use (which CREATES the config for a new
 * merchant/emisor pair and invalidates the fiscal-config query).
 *
 * Listing merchants requires `settlements:read` (in-person) / e-commerce read
 * access; if the user lacks either we treat that list as empty and degrade
 * gracefully rather than crashing the whole Comercios section.
 */
function AddMerchantConfig({
  venueId,
  emisores,
  merchantConfigs,
  onAdd,
  isAdding,
}: {
  venueId: string
  emisores: Emisor[]
  merchantConfigs: MerchantConfig[]
  onAdd: (params: { merchant: UnconfiguredMerchant; fiscalEmisorId: string }) => void
  isAdding: boolean
}) {
  const { t } = useTranslation('cfdi')

  // In-person MerchantAccounts linked to this venue (venue-scoped, secrets
  // stripped server-side). Gated `settlements:read`; on 403 → empty list.
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['fiscal-add-merchant-accounts', venueId],
    queryFn: async () => (await paymentProviderAPI.getVenueMerchantAccountsByVenueId(venueId)) ?? [],
    enabled: !!venueId,
    staleTime: 60 * 1000,
    retry: false,
  })

  // E-commerce channels for this venue. Gated to OWNER+; on 403 → empty list.
  const { data: ecommerceMerchants = [] } = useQuery({
    queryKey: ['fiscal-add-ecommerce-merchants', venueId],
    queryFn: async () => (await ecommerceMerchantAPI.listByVenue(venueId)) ?? [],
    enabled: !!venueId,
    staleTime: 60 * 1000,
    retry: false,
  })

  // Merchants WITHOUT a config = (all venue merchants) minus (already configured).
  // Guard `?? []` because a 2xx with a `null` body slips past the `= []` query
  // default (which only applies when `data === undefined`) and would crash `.filter`.
  const unconfigured = useMemo<UnconfiguredMerchant[]>(() => {
    const configuredAccountIds = new Set(merchantConfigs.map(c => c.merchantAccountId).filter(Boolean) as string[])
    const configuredEcommerceIds = new Set(merchantConfigs.map(c => c.ecommerceMerchantId).filter(Boolean) as string[])

    const accountOptions: UnconfiguredMerchant[] = (merchantAccounts ?? [])
      .filter(a => !configuredAccountIds.has(a.id))
      .map(a => ({
        kind: 'merchantAccount',
        id: a.id,
        label: a.displayName || a.alias || a.externalMerchantId,
      }))

    const ecommerceOptions: UnconfiguredMerchant[] = (ecommerceMerchants ?? [])
      .filter(m => !configuredEcommerceIds.has(m.id))
      .map(m => ({ kind: 'ecommerceMerchant', id: m.id, label: m.channelName }))

    return [...accountOptions, ...ecommerceOptions]
  }, [merchantAccounts, ecommerceMerchants, merchantConfigs])

  // Compound key `kind:id` keeps the two namespaces from colliding in the Select.
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [selectedEmisorId, setSelectedEmisorId] = useState<string>('')

  const selectedMerchant = useMemo(
    () => unconfigured.find(m => `${m.kind}:${m.id}` === selectedKey) ?? null,
    [unconfigured, selectedKey],
  )

  const canAdd = !!selectedMerchant && !!selectedEmisorId && !isAdding

  const handleAdd = () => {
    if (!selectedMerchant || !selectedEmisorId) return
    onAdd({ merchant: selectedMerchant, fiscalEmisorId: selectedEmisorId })
    // Reset the merchant picker (the added one drops out of the list); keep the
    // emisor selection so adding several merchants to one emisor stays quick.
    setSelectedKey('')
  }

  // Nothing left to configure → subtle empty state (no add control).
  if (unconfigured.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card p-4 text-center text-sm text-muted-foreground">
        {t('merchants.add.allConfigured')}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-input bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{t('merchants.add.title')}</p>
          <p className="text-xs text-muted-foreground">{t('merchants.add.description')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={selectedKey} onValueChange={setSelectedKey}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[260px]">
            <SelectValue placeholder={t('merchants.add.selectMerchant')} />
          </SelectTrigger>
          <SelectContent>
            {unconfigured.map(m => (
              <SelectItem key={`${m.kind}:${m.id}`} value={`${m.kind}:${m.id}`}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{m.label}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {m.kind === 'ecommerceMerchant' ? t('merchants.add.tagOnline') : t('merchants.add.tagInPerson')}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEmisorId} onValueChange={setSelectedEmisorId} disabled={emisores.length === 0}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[220px]">
            <SelectValue placeholder={emisores.length === 0 ? t('merchants.add.selectEmisorFirst') : t('merchants.selectEmisor')} />
          </SelectTrigger>
          <SelectContent>
            {emisores.map(emisor => (
              <SelectItem key={emisor.id} value={emisor.id}>
                {emisor.legalName} ({emisor.rfc})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleAdd} disabled={!canAdd} className="shrink-0">
          {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          {t('merchants.add.button')}
        </Button>
      </div>
    </div>
  )
}

export default function CfdiConfiguracion() {
  const { t } = useTranslation('cfdi')
  const { formatDate } = useVenueDateTime()
  const { venueId } = useCurrentVenue()

  // CFDI is a paid feature shown as a VISIBLE teaser via <FeatureGate> below.
  // When the venue lacks access we keep the page discoverable but render sample
  // emisor cards behind the blurred upsell overlay and NEVER call the
  // (feature-gated) backend. Use the SAME tier+grant logic FeatureGate uses so
  // the API guard and the visual gate stay in lockstep.
  const { hasAccess: hasCfdi } = useTierFeatureAccess('CFDI')

  const { data, isLoading, isError } = useFiscalConfig({ enabled: hasCfdi })
  const provisionMutation = useProvisionEmisor()
  const upsertMerchant = useUpsertMerchantConfig()

  const [emisorModal, setEmisorModal] = useState<{ open: boolean; emisor: Emisor | null }>({ open: false, emisor: null })
  const [csdModal, setCsdModal] = useState<{ open: boolean; emisor: Emisor | null }>({ open: false, emisor: null })
  // The emisor currently being provisioned, so only its button spins/disables
  // (mirrors GlobalInvoiceSection's per-row `pendingId`).
  const [provisioningId, setProvisioningId] = useState<string | null>(null)
  // Turning ON "incluir en global" is a fiscal decision (Avoqado would auto-emit the monthly factura
  // global for this merchant's sales). Confirm before enabling; turning it OFF is safe and immediate.
  const [confirmGlobal, setConfirmGlobal] = useState<MerchantConfig | null>(null)

  // When locked, feed sample cards so the teaser looks real behind the blur.
  const emisores = useMemo(() => (hasCfdi ? data?.emisores ?? [] : SAMPLE_EMISORES), [data, hasCfdi])
  const merchantConfigs = useMemo(() => (hasCfdi ? data?.merchantConfigs ?? [] : []), [data, hasCfdi])

  const saveMerchant = (config: MerchantConfig, patch: Partial<MerchantConfig>) => {
    const next = { ...config, ...patch }
    upsertMerchant.mutate({
      // Send the merchant id in whichever field identifies it.
      ...(next.merchantAccountId ? { merchantAccountId: next.merchantAccountId } : {}),
      ...(next.ecommerceMerchantId ? { ecommerceMerchantId: next.ecommerceMerchantId } : {}),
      fiscalEmisorId: next.fiscalEmisorId,
      facturacionEnabled: next.facturacionEnabled,
      autofacturaEnabled: next.autofacturaEnabled,
      includeInGlobal: next.includeInGlobal,
      includeInAccounting: next.includeInAccounting,
    })
  }

  /**
   * Create the FIRST fiscal config for a merchant that had none. Sends EXACTLY
   * one of merchantAccountId / ecommerceMerchantId (the discriminated union
   * guarantees it) so the backend XOR guard never trips. Defaults: facturación on,
   * autofactura off, and NOT in the global (opt-in — see includeInGlobal below).
   */
  const addMerchantConfig = ({
    merchant,
    fiscalEmisorId,
  }: {
    merchant: { kind: 'merchantAccount' | 'ecommerceMerchant'; id: string }
    fiscalEmisorId: string
  }) => {
    upsertMerchant.mutate({
      ...(merchant.kind === 'merchantAccount' ? { merchantAccountId: merchant.id } : { ecommerceMerchantId: merchant.id }),
      fiscalEmisorId,
      facturacionEnabled: true,
      autofacturaEnabled: false,
      includeInGlobal: false,
      includeInAccounting: true, // opt-out: por default el merchant SÍ entra a la contabilidad
    })
  }

  if (hasCfdi && isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  return (
    <FeatureGate feature="CFDI">
      <div className="p-4 bg-background text-foreground">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t('config.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('config.description')}</p>
        </div>

        {hasCfdi && isError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {t('config.loadError')}
          </div>
        )}

      <div className="space-y-10">
        {/* ── Emisores ─────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('emisores.title')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t('emisores.description')}</p>
            </div>
            <Button onClick={() => setEmisorModal({ open: true, emisor: null })}>
              <Plus className="mr-2 h-4 w-4" />
              {t('emisores.new')}
            </Button>
          </div>

          {emisores.length === 0 ? (
            <div className="rounded-lg border border-input bg-card p-8 text-center text-sm text-muted-foreground">
              {t('emisores.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {emisores.map(emisor => (
                <div key={emisor.id} className="rounded-xl border border-input bg-card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{emisor.legalName}</p>
                      <p className="text-sm text-muted-foreground">{emisor.rfc}</p>
                    </div>
                    {emisor.providerOrgId && (
                      <Badge variant="secondary" className="shrink-0">
                        <ShieldCheck className="h-3 w-3" />
                        {t('emisores.connectedToPac')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={csdBadgeVariant(emisor.csdStatus)}>{t(`emisores.csd.${emisor.csdStatus}`)}</Badge>
                    {emisor.csdStatus !== 'NONE' && emisor.csdExpiresAt && (
                      <span>{t('emisores.csd.expiresAt', { date: formatDate(emisor.csdExpiresAt) })}</span>
                    )}
                    {emisor.serie && (
                      <span>
                        {t('emisores.serie')}: {emisor.serie}
                      </span>
                    )}
                    <span>
                      {t('emisores.periodicity')}: {t(`periodicity.${emisor.globalPeriodicity}`)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setEmisorModal({ open: true, emisor })}>
                      {t('emisores.edit')}
                    </Button>
                    {!emisor.providerOrgId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProvisioningId(emisor.id)
                          provisionMutation.mutate(emisor.id, { onSettled: () => setProvisioningId(null) })
                        }}
                        disabled={provisioningId === emisor.id}
                      >
                        {provisioningId === emisor.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('emisores.connectPac')}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCsdModal({ open: true, emisor })}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('emisores.uploadCsd')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* ── Comercios ────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t('merchants.title')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t('merchants.description')}</p>
          </div>

          {merchantConfigs.length === 0 ? (
            <div className="rounded-lg border border-input bg-card p-8 text-center text-sm text-muted-foreground">
              {t('merchants.empty')}
            </div>
          ) : (
            <div className="space-y-3">
              {merchantConfigs.map(config => (
                <div key={config.id} className="rounded-xl border border-input bg-card p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-medium truncate">{merchantLabel(config)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('merchants.emisor')}</span>
                      <Select
                        value={config.fiscalEmisorId}
                        onValueChange={value => saveMerchant(config, { fiscalEmisorId: value })}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder={t('merchants.selectEmisor')} />
                        </SelectTrigger>
                        <SelectContent>
                          {emisores.map(emisor => (
                            <SelectItem key={emisor.id} value={emisor.id}>
                              {emisor.legalName} ({emisor.rfc})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2.5">
                      <span className="text-sm">{t('merchants.facturacionEnabled')}</span>
                      <Switch
                        checked={config.facturacionEnabled}
                        onCheckedChange={on => saveMerchant(config, { facturacionEnabled: on })}
                        className="cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2.5">
                      <span className="text-sm">{t('merchants.autofacturaEnabled')}</span>
                      <Switch
                        checked={config.autofacturaEnabled}
                        onCheckedChange={on => saveMerchant(config, { autofacturaEnabled: on })}
                        className="cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2.5">
                      <span className="text-sm">{t('merchants.includeInGlobal')}</span>
                      <Switch
                        checked={config.includeInGlobal}
                        // Enabling is a fiscal decision → confirm first. Disabling is safe → immediate.
                        onCheckedChange={on =>
                          on ? setConfirmGlobal(config) : saveMerchant(config, { includeInGlobal: false })
                        }
                        className="cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2.5">
                      <span className="text-sm">{t('merchants.includeInAccounting')}</span>
                      <Switch
                        checked={config.includeInAccounting}
                        onCheckedChange={on => saveMerchant(config, { includeInAccounting: on })}
                        className="cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Explica qué hace cada switch — sobre todo el global (duplica ingresos) y contabilidad. */}
                  <p className="text-xs text-muted-foreground">{t('merchants.globalHelp')}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add a config to a merchant that has none yet. Skipped behind the
              teaser blur (no venueId / no feature) so we never hit the API. */}
          {hasCfdi && venueId && (
            <AddMerchantConfig
              venueId={venueId}
              emisores={emisores}
              merchantConfigs={merchantConfigs}
              onAdd={addMerchantConfig}
              isAdding={upsertMerchant.isPending}
            />
          )}
        </section>

        <hr className="border-border" />

        {/* ── Factura global (Flow C) ──────────────────────── */}
        <GlobalInvoiceSection emisores={emisores} />
      </div>

        {hasCfdi && (
          <>
            <EmisorFormModal
              open={emisorModal.open}
              emisor={emisorModal.emisor}
              onClose={() => setEmisorModal({ open: false, emisor: null })}
            />
            <UploadCsdModal
              open={csdModal.open}
              emisor={csdModal.emisor}
              onClose={() => setCsdModal({ open: false, emisor: null })}
            />
          </>
        )}

        {/* Confirmación al PRENDER "incluir en global" — advierte del riesgo de doble facturación. */}
        <AlertDialog open={!!confirmGlobal} onOpenChange={open => !open && setConfirmGlobal(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('merchants.confirmGlobal.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('merchants.confirmGlobal.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('merchants.confirmGlobal.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmGlobal) saveMerchant(confirmGlobal, { includeInGlobal: true })
                  setConfirmGlobal(null)
                }}
              >
                {t('merchants.confirmGlobal.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FeatureGate>
  )
}
