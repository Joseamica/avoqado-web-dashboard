import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, ShieldCheck, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVenueDateTime } from '@/utils/datetime'
import { useFiscalConfig, useProvisionEmisor, useUpsertMerchantConfig } from '@/hooks/use-cfdi'
import type { CsdStatus, Emisor, MerchantConfig } from '@/services/cfdi.service'
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

export default function CfdiConfiguracion() {
  const { t } = useTranslation('cfdi')
  const { formatDate } = useVenueDateTime()
  const { data, isLoading, isError } = useFiscalConfig()
  const provisionMutation = useProvisionEmisor()
  const upsertMerchant = useUpsertMerchantConfig()

  const [emisorModal, setEmisorModal] = useState<{ open: boolean; emisor: Emisor | null }>({ open: false, emisor: null })
  const [csdModal, setCsdModal] = useState<{ open: boolean; emisor: Emisor | null }>({ open: false, emisor: null })

  const emisores = useMemo(() => data?.emisores ?? [], [data])
  const merchantConfigs = useMemo(() => data?.merchantConfigs ?? [], [data])

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
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t('config.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('config.description')}</p>
      </div>

      {isError && (
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
                        onClick={() => provisionMutation.mutate(emisor.id)}
                        disabled={provisionMutation.isPending}
                      >
                        {provisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

          {/* TODO: needs venue merchants list endpoint — the fiscal/config
              response only returns merchants that already have a config, so we
              can only edit EXISTING configs here. Adding a config to a merchant
              with none requires a venue-merchants list endpoint (not yet
              available). */}
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                        onCheckedChange={on => saveMerchant(config, { includeInGlobal: on })}
                        className="cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
    </div>
  )
}
