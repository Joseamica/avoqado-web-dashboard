import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Boxes, Landmark, Plus, RefreshCw } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useAssetTypes, useFixedAssets, useRegisterFixedAsset, useRunDepreciation } from '@/hooks/useFixedAssets'
import { useToast } from '@/hooks/use-toast'
import type { AssetTypeDef, FixedAssetView } from '@/services/fiscal/fixedAsset.service'
import { Currency } from '@/utils/currency'

const today = () => new Date().toISOString().slice(0, 10)

const SAMPLE_TYPES: AssetTypeDef[] = [
  { key: 'EQUIPO_COMPUTO', label: 'Equipo de cómputo', annualRate: 0.3, satRef: 'LISR 34-VII', satAccountGroup: '156', moiCapCents: null },
  { key: 'EQUIPO_TRANSPORTE', label: 'Equipo de transporte', annualRate: 0.25, satRef: 'LISR 34-VI', satAccountGroup: '154', moiCapCents: 175_000_00 },
  { key: 'MOBILIARIO_OFICINA', label: 'Mobiliario y equipo de oficina', annualRate: 0.1, satRef: 'LISR 34-III', satAccountGroup: '155', moiCapCents: null },
]
const SAMPLE_ASSETS: FixedAssetView[] = [
  {
    id: 's1', organizationId: 'o', rfc: 'TESC900101AAA', venueId: 'v', description: 'Laptop del mostrador', assetType: 'EQUIPO_COMPUTO',
    assetTypeLabel: 'Equipo de cómputo', moiCents: 30_000_00, depreciableBaseCents: 30_000_00, annualRate: 0.3, acquisitionDate: '2026-03-15',
    inServiceDate: '2026-03-15', salvageValueCents: 0, status: 'ACTIVE', sourceExpenseId: null, createdAt: '2026-03-15T18:00:00Z',
  },
]

const parsePesos = (v: string): number | undefined => {
  if (v === '') return undefined
  const n = parseFloat(v)
  return Number.isNaN(n) ? undefined : n
}

function FixedAssetsInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')
  const { toast } = useToast()

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [open, setOpen] = useState(false)

  const assetsQuery = useFixedAssets({ enabled: hasAccess })
  const typesQuery = useAssetTypes({ enabled: hasAccess })
  const register = useRegisterFixedAsset()
  const depreciate = useRunDepreciation()

  const data = hasAccess ? assetsQuery.data : { needsFiscalSetup: false, assets: SAMPLE_ASSETS }
  const types = (hasAccess ? typesQuery.data : SAMPLE_TYPES) ?? []
  const needsFiscalSetup = hasAccess && assetsQuery.data?.needsFiscalSetup

  // Formulario de registro
  const [description, setDescription] = useState('')
  const [assetType, setAssetType] = useState('')
  const [monto, setMonto] = useState<number | undefined>(undefined)
  const [ratePct, setRatePct] = useState<number | undefined>(undefined)
  const [acquisitionDate, setAcquisitionDate] = useState(today)
  const [salvage, setSalvage] = useState<number | undefined>(undefined)

  const resetForm = () => {
    setDescription('')
    setAssetType('')
    setMonto(undefined)
    setRatePct(undefined)
    setAcquisitionDate(today())
    setSalvage(undefined)
  }

  const onPickType = (key: string) => {
    setAssetType(key)
    const def = types.find(x => x.key === key)
    if (def) setRatePct(Math.round(def.annualRate * 100 * 100) / 100) // default del catálogo, editable
  }

  const canSubmit = description.trim() !== '' && assetType !== '' && (monto ?? 0) > 0 && acquisitionDate !== ''

  const onSubmit = () => {
    if (!canSubmit) return
    register.mutate(
      {
        description: description.trim(),
        assetType,
        moiCents: Math.round((monto ?? 0) * 100),
        annualRate: ratePct != null ? ratePct / 100 : undefined,
        acquisitionDate,
        salvageValueCents: salvage != null ? Math.round(salvage * 100) : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: t('fixedAssets.registered') })
          setOpen(false)
          resetForm()
        },
        onError: () => toast({ title: t('fixedAssets.registerError'), variant: 'destructive' }),
      },
    )
  }

  const onDepreciate = () => {
    depreciate.mutate(period, {
      onSuccess: r =>
        toast({ title: t('fixedAssets.depreciationDone', { count: r.assetsDepreciated, total: Currency(r.totalPeriodCents, true) }) }),
      onError: () => toast({ title: t('fixedAssets.depreciationError'), variant: 'destructive' }),
    })
  }

  const assets = useMemo(() => data?.assets ?? [], [data])

  return (
    <div className="p-4 space-y-5 bg-background">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('fixedAssets.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('fixedAssets.subtitle')}</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="fa-period" className="block text-[10px] text-muted-foreground">
              {t('trialBalance.period')}
            </label>
            <Input id="fa-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 w-40" />
          </div>
          <Button variant="outline" size="sm" className="h-10" disabled={!hasAccess || depreciate.isPending} onClick={onDepreciate}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${depreciate.isPending ? 'animate-spin' : ''}`} />
            {t('fixedAssets.runDepreciation')}
          </Button>
          <Button size="sm" className="h-10" disabled={!hasAccess} onClick={() => setOpen(true)} data-tour="fixed-asset-new">
            <Plus className="mr-1.5 h-4 w-4" />
            {t('fixedAssets.register')}
          </Button>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-lg border border-input bg-muted/40 p-3 text-foreground">
        <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs">{t('fixedAssets.optInHint')}</p>
      </div>

      {assetsQuery.isLoading && hasAccess ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : assetsQuery.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => assetsQuery.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">
                {t('chartOfAccounts.goToFiscalConfig')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : assets.length === 0 ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Boxes className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('fixedAssets.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('fixedAssets.emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-input">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t('fixedAssets.colDescription')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('fixedAssets.colType')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('fixedAssets.colMoi')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('fixedAssets.colBase')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t('fixedAssets.colRate')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('fixedAssets.colAcquisition')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('fixedAssets.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id} className="border-b border-input/50 last:border-0">
                      <td className="px-4 py-2.5 text-foreground">{a.description}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{a.assetTypeLabel}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{Currency(a.moiCents, true)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{Currency(a.depreciableBaseCents, true)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{(a.annualRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{a.acquisitionDate}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={a.status === 'ACTIVE' ? 'outline' : 'secondary'} className="text-[10px]">
                          {t(`fixedAssets.status.${a.status}`, { defaultValue: a.status })}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{t('fixedAssets.disclosure')}</p>

      <FullScreenModal
        open={open}
        onClose={() => setOpen(false)}
        title={t('fixedAssets.register')}
        subtitle={t('fixedAssets.registerSubtitle')}
        contentClassName="bg-muted/30"
        actions={
          <Button size="sm" disabled={!canSubmit || register.isPending} onClick={onSubmit}>
            {register.isPending ? t('fixedAssets.saving') : t('fixedAssets.save')}
          </Button>
        }
      >
        <div className="mx-auto max-w-xl space-y-4 p-4">
          <div className="space-y-1">
            <label htmlFor="fa-desc" className="block text-xs text-muted-foreground">
              {t('fixedAssets.colDescription')}
            </label>
            <Input
              id="fa-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('fixedAssets.descriptionPlaceholder')}
              className="h-12 text-base"
              maxLength={200}
              data-tour="fixed-asset-desc"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="fa-type" className="block text-xs text-muted-foreground">
              {t('fixedAssets.colType')}
            </label>
            <select
              id="fa-type"
              value={assetType}
              onChange={e => onPickType(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base text-foreground"
            >
              <option value="">{t('fixedAssets.pickType')}</option>
              {types.map(x => (
                <option key={x.key} value={x.key}>
                  {x.label} — {(x.annualRate * 100).toFixed(0)}%
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="fa-monto" className="block text-xs text-muted-foreground">
                {t('fixedAssets.moiLabel')}
              </label>
              <Input
                id="fa-monto"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={monto ?? ''}
                onChange={e => setMonto(parsePesos(e.target.value))}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="fa-rate" className="block text-xs text-muted-foreground">
                {t('fixedAssets.rateLabel')}
              </label>
              <Input
                id="fa-rate"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                placeholder="30"
                value={ratePct ?? ''}
                onChange={e => setRatePct(parsePesos(e.target.value))}
                className="h-12 text-base"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="fa-acq" className="block text-xs text-muted-foreground">
                {t('fixedAssets.acquisitionLabel')}
              </label>
              <Input id="fa-acq" type="date" value={acquisitionDate} onChange={e => setAcquisitionDate(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-1">
              <label htmlFor="fa-salvage" className="block text-xs text-muted-foreground">
                {t('fixedAssets.salvageLabel')}
              </label>
              <Input
                id="fa-salvage"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={salvage ?? ''}
                onChange={e => setSalvage(parsePesos(e.target.value))}
                className="h-12 text-base"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('fixedAssets.formHint')}</p>
        </div>
      </FullScreenModal>
    </div>
  )
}

/**
 * Activos fijos · depreciación (deducción de inversiones, Capa B fiscal). Opt-in: registrar = confirmar.
 * Gated PREMIUM (FeatureGate CFDI). La depreciación acumulada se deduce en el ISR general.
 */
export default function FixedAssets() {
  return (
    <FeatureGate feature="CFDI">
      <FixedAssetsInner />
    </FeatureGate>
  )
}
