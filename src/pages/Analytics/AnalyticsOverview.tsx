import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchAnalyticsOverview, AnalyticsOverviewResponse } from '@/services/analytics.service'
import { Badge } from '@/components/ui/badge'
import KpiCard from '@/components/analytics/KpiCard'
import Sparkline from '@/components/analytics/Sparkline'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'

export default function Overview() {
  const [sp] = useSearchParams()
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { t, i18n } = useTranslation()

  const query = useMemo(
    () => ({
      timeRange: (sp.get('timeRange') as any) || '30d',
      compareTo: (sp.get('compareTo') as any) || 'previous_period',
    }),
    [sp],
  )

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchAnalyticsOverview(query)
      .then(r => {
        if (mounted) {
          setData(r)
          setErr(null)
        }
      })
      .catch(e => {
        if (mounted) setErr(e.message)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [query])

  if (loading) return <div className="p-2">{t('analytics.loading', 'Loading analytics…')}</div>
  if (err) return (
    <div className="p-2 text-red-600">
      {t('analytics.errorPrefix', 'Failed to load:')} {err}
    </div>
  )
  if (!data) return null

  const o = data.overview
  const fin = o.kpiDeck.financials
  const gro = o.kpiDeck.growth
  const eng = o.kpiDeck.engagement

  const lockIfNull = (v: number | null) => (v == null ? '🔒' : v)

  // Metric definitions for tooltips (localized)
  const defs: Record<string, string> = {
    ARR: t('analytics.tooltips.arr'),
    MRR: t('analytics.tooltips.mrr'),
    'Net New ARR': t('analytics.tooltips.netNewArr'),
    NRR: t('analytics.tooltips.nrr'),
    Churn: t('analytics.tooltips.churn'),
    Signups: t('analytics.tooltips.signups'),
    Activation: t('analytics.tooltips.activation'),
    'Win Rate': t('analytics.tooltips.winRate'),
    'Sales Cycle (d)': t('analytics.tooltips.salesCycleDays'),
    DAU: t('analytics.tooltips.dau'),
    MAU: t('analytics.tooltips.mau'),
    Stickiness: t('analytics.tooltips.stickiness'),
    Uptime: t('analytics.tooltips.uptime'),
  }

  return (
    <div className="grid gap-4">
      {/* KPI Deck */}
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t('analytics.overview.title', 'Executive Overview')}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">
              {t('analytics.compare.badge', 'Compare: {{label}}', {
                label: t(`analytics.compare.${o.compareTo}`, o.compareTo.replace('_', ' ')),
              })}
            </Badge>
            <span>
              {t('analytics.refreshed', 'Refreshed: {{date}}', {
                date: new Date(data.meta.refreshedAt).toLocaleString(),
              })}
            </span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <KpiCard title={t('analytics.kpis.arr', 'ARR')} value={lockIfNull(fin.arr)} format="currency" tooltip={defs['ARR']} trend={o.visuals.timeseries.mrr} />
          <KpiCard title={t('analytics.kpis.mrr', 'MRR')} value={lockIfNull(fin.mrr)} format="currency" tooltip={defs['MRR']} trend={o.visuals.timeseries.mrr} />
          <KpiCard title={t('analytics.kpis.netNewArr', 'Net New ARR')} value={lockIfNull(fin.netNewArr)} format="currency" tooltip={defs['Net New ARR']} />
          <KpiCard title={t('analytics.kpis.nrr', 'NRR')} value={fin.nrr} format="percent" tooltip={defs['NRR']} />
          <KpiCard title={t('analytics.kpis.churn', 'Churn')} value={fin.churnRate} format="percent" tooltip={defs['Churn']} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard title={t('analytics.kpis.signups', 'Signups')} value={gro.signups} format="number" tooltip={defs['Signups']} trend={o.visuals.timeseries.dau} />
          <KpiCard title={t('analytics.kpis.activation', 'Activation')} value={gro.activationRate} format="percent" tooltip={defs['Activation']} />
          <KpiCard title={t('analytics.kpis.winRate', 'Win Rate')} value={gro.winRate} format="percent" tooltip={defs['Win Rate']} />
          <KpiCard title={t('analytics.kpis.salesCycleDays', 'Sales Cycle (d)')} value={gro.salesCycleDays} format="number" tooltip={defs['Sales Cycle (d)']} />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard title={t('analytics.kpis.dau', 'DAU')} value={eng.dau} format="number" tooltip={defs['DAU']} trend={o.visuals.timeseries.dau} />
          <KpiCard title={t('analytics.kpis.mau', 'MAU')} value={eng.mau} format="number" tooltip={defs['MAU']} />
          <KpiCard title={t('analytics.kpis.stickiness', 'Stickiness')} value={eng.stickiness} format="percent" tooltip={defs['Stickiness']} trend={o.visuals.timeseries.stickiness} />
          <KpiCard title={t('analytics.kpis.uptime', 'Uptime')} value={eng.uptime} format="percent" tooltip={defs['Uptime']} />
        </div>
      </section>

      {/* Visuals */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-3 col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium">MRR (12m)</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/70 hover:text-foreground" aria-label="About MRR chart">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Monthly Recurring Revenue trend for the last 12 months.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Sparkline data={o.visuals.timeseries.mrr} width={720} height={140} stroke="#2563eb" />
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium">DAU (30d)</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/70 hover:text-foreground" aria-label="About DAU chart">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Daily Active Users over the last 30 days.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Sparkline data={o.visuals.timeseries.dau} width={320} height={140} stroke="#16a34a" />
        </div>
      </section>

      {o.visuals.revenueBridge && (
        <section className="border rounded-lg p-3">
          <h3 className="font-medium mb-3">{t('analytics.revenueBridge.title', 'Revenue Bridge')}</h3>
          <div className="flex gap-3 flex-wrap">
            {o.visuals.revenueBridge.map(step => (
              <div key={step.label} className="min-w-[140px] p-2 bg-muted/40 rounded">
                <div className="text-xs text-muted-foreground">{step.label}</div>
                <div className="font-semibold">
                  {Intl.NumberFormat(getIntlLocale(i18n.language), {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }).format(step.value)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium">{t('analytics.activationFunnel.title', 'Activation Funnel')}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/70 hover:text-foreground" aria-label="About Activation Funnel">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('analytics.activationFunnel.tooltip', 'Drop-offs from signups to PQLs/SQLs/Won for the period.')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <ul className="text-sm list-disc ml-5">
            {o.visuals.funnels.activation.map(s => (
              <li key={s.stage}>
                {s.stage}: {s.value.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium">{t('analytics.cohortRetention.title', 'Cohort Retention')}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/70 hover:text-foreground" aria-label="About Cohort Retention">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {t(
                    'analytics.cohortRetention.tooltip',
                    'Share of accounts active by months since signup (rows are cohorts).',
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid gap-1">
            {o.visuals.cohorts.retention.map((row, idx) => (
              <div key={idx} className="flex gap-1">
                {row.map((v, j) => (
                  <div
                    key={j}
                    title={`${(v * 100).toFixed(0)}%`}
                    className="w-7 h-7 rounded"
                    style={{ background: `rgba(37,99,235,${0.2 + v * 0.6})` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <h3 className="font-medium">{t('analytics.insights.title', 'Insights')}</h3>
        <div className="flex gap-2 flex-wrap text-sm">
          {o.insights.map(x => (
            <span
              key={x.code}
              className="px-2 py-1 rounded-full"
              style={{
                background: x.severity === 'warn' ? '#fff7ed' : '#f1f5f9',
                color: '#334155',
              }}
            >
              {x.message}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-1">
        <h3 className="font-medium">{t('analytics.metricDefinitions.title', 'Metric Definitions')}</h3>
        <ul className="text-sm list-disc ml-5">
          {o.definitions.map(d => (
            <li key={d.metric}>
              <strong>{d.metric}:</strong> {d.formula}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
