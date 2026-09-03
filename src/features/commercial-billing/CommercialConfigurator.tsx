import { useMemo, useState } from 'react'
import { Boxes, Check, ChevronRight, LockKeyhole, PackageCheck, Sparkles, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { cn } from '@/lib/utils'

import type {
  CommercialBillingReadyOverview,
  CommercialConfiguratorPreview,
  CommercialConfiguratorPackageSelection,
  CommercialConfiguratorQuote,
  CommercialConfiguratorSelection,
} from './commercial-contract'
import { formatCommercialMinor } from './money'
import { useCommercialConfiguratorPreview } from './use-commercial-billing'

type ConfiguratorMode = CommercialConfiguratorSelection['mode']

function initialMode(overview: CommercialBillingReadyOverview): ConfiguratorMode {
  return overview.contract.lines.length === 1 && overview.contract.lines[0]?.productKind === 'PLAN' ? 'PACKAGE' : 'CUSTOM'
}

function initialPackage(overview: CommercialBillingReadyOverview): string {
  return overview.contract.lines.find(line => line.productKind === 'PLAN')?.targetCode ?? 'PRO'
}

function initialBillingUnit(overview: CommercialBillingReadyOverview): 'VENUE_MONTH' | 'VENUE_YEAR' {
  return overview.contract.lines.some(line => line.billingUnit === 'VENUE_YEAR') ? 'VENUE_YEAR' : 'VENUE_MONTH'
}

function initialModules(overview: CommercialBillingReadyOverview): string[] {
  return overview.contract.lines
    .filter(line => line.productKind === 'MODULE')
    .map(line => line.targetCode)
    .sort()
}

function ConfiguratorLoading() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

function BillingCadence({
  value,
  onChange,
}: {
  value: 'VENUE_MONTH' | 'VENUE_YEAR'
  onChange: (value: 'VENUE_MONTH' | 'VENUE_YEAR') => void
}) {
  const { t } = useTranslation('billing')
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" aria-label={t('commercialBilling.configurator.cadence.label')}>
      {(['VENUE_MONTH', 'VENUE_YEAR'] as const).map(unit => (
        <Button
          key={unit}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value === unit}
          className={cn('h-7 px-3', value === unit && 'bg-background text-foreground shadow-sm hover:bg-background')}
          onClick={() => onChange(unit)}
        >
          {t(`commercialBilling.configurator.cadence.${unit}`)}
        </Button>
      ))}
    </div>
  )
}

function PackageOptions({
  data,
  selectedCode,
  billingUnit,
  onSelect,
}: {
  data: CommercialConfiguratorPreview
  selectedCode: string
  billingUnit: 'VENUE_MONTH' | 'VENUE_YEAR'
  onSelect: (code: string) => void
}) {
  const { t, i18n } = useTranslation('billing')
  const money = (value: string) => formatCommercialMinor(value, 'MXN', i18n.language)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.preview.options.packages.map(product => {
        const price = product.prices.find(candidate => candidate.billingUnit === billingUnit)
        const selected = product.code === selectedCode
        const contact = product.salesMode === 'CONTACT'
        return (
          <button
            key={product.code}
            type="button"
            disabled={!price || contact}
            aria-pressed={selected}
            onClick={() => onSelect(product.code)}
            className={cn(
              'min-h-40 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-foreground/25 hover:bg-muted/30',
              (!price || contact) && 'cursor-not-allowed opacity-70',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-base font-semibold text-foreground">{product.name}</span>
              {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
            </div>
            <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{product.description}</p>
            <div className="mt-5">
              {contact ? (
                <span className="font-medium text-foreground">{t('commercialBilling.configurator.packages.contact')}</span>
              ) : price ? (
                <>
                  <span className="text-xl font-semibold tabular-nums text-foreground">{money(price.listUnitAmountMinor)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{t(`commercialBilling.billingUnit.${billingUnit}`)}</span>
                  {price.taxRateBasisPoints > 0 && (
                    <span className="mt-1 block text-xs text-muted-foreground">{t('commercialBilling.configurator.plusTax')}</span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t('commercialBilling.configurator.packages.notAvailable')}</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function CustomOptions({
  data,
  selectedCodes,
  onToggle,
}: {
  data: CommercialConfiguratorPreview
  selectedCodes: string[]
  onToggle: (code: string) => void
}) {
  const { t, i18n } = useTranslation('billing')
  const money = (value: string) => formatCommercialMinor(value, 'MXN', i18n.language)
  const basePrice = data.preview.options.customBase.prices.find(price => price.billingUnit === 'VENUE_MONTH')
  return (
    <Card className="overflow-hidden shadow-none">
      <div className="flex items-start gap-3 bg-muted/35 px-5 py-4">
        <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-background text-foreground ring-1 ring-border">
          <LockKeyhole className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{data.preview.options.customBase.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('commercialBilling.configurator.custom.baseIncluded')}</p>
            </div>
            {basePrice && (
              <p className="font-medium tabular-nums text-foreground">
                {money(basePrice.listUnitAmountMinor)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{t('commercialBilling.configurator.plusTax')}</span>
              </p>
            )}
          </div>
        </div>
      </div>
      <Separator />
      <div className="divide-y divide-border">
        {data.preview.options.modules.map(module => {
          const checked = selectedCodes.includes(module.code)
          const price = module.prices.find(candidate => candidate.billingUnit === 'VENUE_MONTH')
          const checkboxId = `commercial-module-${module.code}`
          return (
            <label
              key={module.code}
              htmlFor={checkboxId}
              className={cn(
                'flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/30',
                checked && 'bg-primary/5',
              )}
            >
              <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={() => onToggle(module.code)}
                aria-label={`${module.name} · ${module.description}`}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{module.name}</span>
                <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{module.description}</span>
              </span>
              {price && (
                <span className="shrink-0 pt-0.5 text-sm font-medium tabular-nums text-foreground">
                  +{money(price.listUnitAmountMinor)}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </Card>
  )
}

function PricingSummary({ data, pending }: { data: CommercialConfiguratorPreview; pending: boolean }) {
  const { t, i18n } = useTranslation('billing')
  const money = (value: string) => formatCommercialMinor(value, 'MXN', i18n.language)
  const quote = data.preview.quote
  const promotionalCycles = quote.lines.find(line => line.promotionalCycles !== null)?.promotionalCycles ?? null
  return (
    <div
      className="space-y-3 lg:sticky lg:top-4"
      aria-live="polite"
      aria-busy={pending}
      data-testid="commercial-configurator-summary"
    >
      {data.pricing.state === 'BOUND_OFFER_UNAVAILABLE' && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('commercialBilling.configurator.offer.unavailableTitle')}</AlertTitle>
          <AlertDescription>{t(`commercialBilling.configurator.offer.unavailable.${data.pricing.reason}`)}</AlertDescription>
        </Alert>
      )}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">{t('commercialBilling.configurator.summary.title')}</CardTitle>
            <Badge variant="outline">
              {pending
                ? t('commercialBilling.configurator.updatingBadge')
                : t('commercialBilling.configurator.previewBadge')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? (
            <div className="space-y-3" role="status">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Separator />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
            {quote.lines.map(line => (
              <div key={line.lineKey} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{line.name}</p>
                  {line.discountMinor !== '0' && (
                    <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                      {t('commercialBilling.configurator.offer.lineApplied')}
                    </p>
                  )}
                </div>
                <p className="tabular-nums text-foreground">{money(line.totalMinor)}</p>
              </div>
            ))}
              </div>
              <Separator />
              <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>{t('commercialBilling.configurator.summary.list')}</dt>
              <dd className="tabular-nums">{money(quote.today.listSubtotalMinor)}</dd>
            </div>
            {quote.today.discountMinor !== '0' && (
              <div className="flex justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                <dt>{t('commercialBilling.configurator.summary.discount')}</dt>
                <dd className="tabular-nums">−{money(quote.today.discountMinor)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>{t('commercialBilling.configurator.summary.subtotal')}</dt>
              <dd className="tabular-nums">{money(quote.today.subtotalMinor)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>{t('commercialBilling.configurator.summary.tax')}</dt>
              <dd className="tabular-nums">{money(quote.today.taxMinor)}</dd>
            </div>
            <div className="flex justify-between gap-3 pt-1 text-base font-semibold text-foreground">
              <dt>{t('commercialBilling.configurator.summary.today')}</dt>
              <dd className="tabular-nums">{money(quote.today.totalMinor)}</dd>
            </div>
              </dl>
              {promotionalCycles && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5 text-sm">
              <p className="font-medium text-foreground">
                {t('commercialBilling.configurator.offer.cycles', { count: promotionalCycles })}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t('commercialBilling.configurator.offer.renewal', { amount: money(quote.renewal.totalMinor) })}
              </p>
            </div>
              )}
              {!promotionalCycles && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">{t('commercialBilling.configurator.summary.renewal')}</span>
              <span className="font-medium tabular-nums text-foreground">{money(quote.renewal.totalMinor)}</span>
            </div>
              )}
              <Button type="button" className="w-full" disabled data-tour="commercial-billing-review-change">
                {t('commercialBilling.configurator.actions.review')}
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">
                {t('commercialBilling.configurator.actions.previewOnly')}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Recommendation({
  recommendation,
  selectedQuote,
  onChoose,
}: {
  recommendation: NonNullable<CommercialConfiguratorPreview['preview']['recommendation']>
  selectedQuote: CommercialConfiguratorQuote
  onChoose: (selection: CommercialConfiguratorPackageSelection) => void
}) {
  const { t, i18n } = useTranslation('billing')
  const money = (value: string) => formatCommercialMinor(value, 'MXN', i18n.language)
  const packageName = recommendation.quote.lines[0]?.name ?? recommendation.selection.packageCode
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {t(`commercialBilling.configurator.recommendation.${recommendation.reason}.title`, { packageName })}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {t(`commercialBilling.configurator.recommendation.${recommendation.reason}.description`, {
              today: money(recommendation.savingsTodayMinor),
              todayAmount: money(selectedQuote.today.totalMinor),
              packageToday: money(recommendation.quote.today.totalMinor),
              renewal: money(recommendation.savingsRenewalMinor),
            })}
          </p>
          {recommendation.savingsTodayMinor !== '0' && (
            <p className="mt-2 flex flex-wrap items-baseline gap-1 text-sm font-medium text-foreground">
              <span>{t('commercialBilling.configurator.recommendation.comparison.todaySavings')}</span>
              <span className="tabular-nums">{money(recommendation.savingsTodayMinor)}</span>
            </p>
          )}
          <dl
            className="mt-3 grid divide-y divide-border overflow-hidden rounded-lg border border-border bg-background/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            data-testid="commercial-configurator-recommendation-comparison"
          >
            <div className="min-w-0 p-3">
              <dt className="text-xs text-muted-foreground">
                {t('commercialBilling.configurator.recommendation.comparison.selection')}
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
                {money(selectedQuote.renewal.totalMinor)}
              </dd>
            </div>
            <div className="min-w-0 p-3">
              <dt className="truncate text-xs text-muted-foreground">{packageName}</dt>
              <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
                {money(recommendation.quote.renewal.totalMinor)}
              </dd>
            </div>
            <div className="min-w-0 p-3">
              <dt className="text-xs text-muted-foreground">
                {t('commercialBilling.configurator.recommendation.comparison.savings')}
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-primary">
                {money(recommendation.savingsRenewalMinor)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('commercialBilling.configurator.recommendation.comparison.renewalBasis')}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 gap-2"
        onClick={() =>
          onChoose({
            mode: 'PACKAGE',
            packageCode: recommendation.selection.packageCode!,
            billingUnit: recommendation.selection.billingUnit!,
          })
        }
      >
        {t('commercialBilling.configurator.recommendation.choose', { packageName })}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function CommercialConfigurator({ overview }: { overview: CommercialBillingReadyOverview }) {
  const { t } = useTranslation('billing')
  const { venueId } = useCurrentVenue()
  const [mode, setMode] = useState<ConfiguratorMode>(() => initialMode(overview))
  const [packageCode, setPackageCode] = useState(() => initialPackage(overview))
  const [billingUnit, setBillingUnit] = useState<'VENUE_MONTH' | 'VENUE_YEAR'>(() => initialBillingUnit(overview))
  const [moduleCodes, setModuleCodes] = useState<string[]>(() => initialModules(overview))
  const selection = useMemo<CommercialConfiguratorSelection>(
    () =>
      mode === 'PACKAGE'
        ? { mode: 'PACKAGE', packageCode, billingUnit }
        : { mode: 'CUSTOM', moduleCodes, billingUnit: 'VENUE_MONTH' },
    [billingUnit, mode, moduleCodes, packageCode],
  )
  const query = useCommercialConfiguratorPreview(venueId, selection, true)
  const data = query.data

  function toggleModule(code: string) {
    setModuleCodes(current => (current.includes(code) ? current.filter(item => item !== code) : [...current, code].sort()))
  }

  function chooseRecommendation(next: CommercialConfiguratorPackageSelection) {
    setPackageCode(next.packageCode)
    setBillingUnit(next.billingUnit)
    setMode('PACKAGE')
  }

  return (
    <section className="scroll-mt-5 space-y-5" data-tour="commercial-billing-configurator">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('commercialBilling.configurator.eyebrow')}
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {t('commercialBilling.configurator.title')}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('commercialBilling.configurator.subtitle')}</p>
        </div>
        {mode === 'PACKAGE' && <BillingCadence value={billingUnit} onChange={setBillingUnit} />}
      </div>

      <Tabs value={mode} onValueChange={value => setMode(value as ConfiguratorMode)}>
        <TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="PACKAGE"
            className="gap-2 rounded-none border-x-0 border-t-0 bg-transparent px-4 py-3 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <PackageCheck className="size-4" aria-hidden="true" />
            {t('commercialBilling.configurator.modes.packages')}
          </TabsTrigger>
          <TabsTrigger
            value="CUSTOM"
            className="gap-2 rounded-none border-x-0 border-t-0 bg-transparent px-4 py-3 shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Boxes className="size-4" aria-hidden="true" />
            {t('commercialBilling.configurator.modes.custom')}
          </TabsTrigger>
        </TabsList>

        {query.isLoading || !data ? (
          <div className="pt-5">
            {query.isError ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>{t('commercialBilling.configurator.error.title')}</AlertTitle>
                <AlertDescription>
                  {t('commercialBilling.configurator.error.description')}
                  <Button type="button" variant="link" className="ml-1 h-auto p-0" onClick={() => void query.refetch()}>
                    {t('commercialBilling.actions.retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <ConfiguratorLoading />
            )}
          </div>
        ) : (
          <>
            {data.preview.recommendation && mode === 'CUSTOM' && (
              <div className="pt-5">
                <Recommendation
                  recommendation={data.preview.recommendation}
                  selectedQuote={data.preview.quote}
                  onChoose={chooseRecommendation}
                />
              </div>
            )}
            <div className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div>
                <TabsContent value="PACKAGE" className="m-0">
                  <PackageOptions
                    data={data}
                    selectedCode={packageCode}
                    billingUnit={billingUnit}
                    onSelect={setPackageCode}
                  />
                </TabsContent>
                <TabsContent value="CUSTOM" className="m-0">
                  <CustomOptions data={data} selectedCodes={moduleCodes} onToggle={toggleModule} />
                </TabsContent>
              </div>
              <PricingSummary data={data} pending={query.isFetching || query.isSelectionPending} />
            </div>
          </>
        )}
      </Tabs>
    </section>
  )
}
