import { Outlet, useSearchParams, Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const presets = ['7d', '30d', '90d', 'qtd', 'ytd', '12m'] as const
const compares = ['previous_period', 'previous_year'] as const

export default function AnalyticsLayout() {
  const [sp, setSp] = useSearchParams()
  const timeRange = (sp.get('timeRange') as any) || '30d'
  const compareTo = (sp.get('compareTo') as any) || 'previous_period'
  const { t } = useTranslation()

  const onChange = (key: string, val: string) => {
    const next = new URLSearchParams(sp)
    next.set(key, val)
    setSp(next, { replace: true })
  }

  const lastRefreshed = useMemo(() => new Date().toLocaleString(), [])

  return (
    <div className="p-4 grid gap-3">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('analytics.title', 'Analytics')}</h1>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link to="/analytics">{t('analytics.overview', 'Overview')}</Link>
        </nav>
      </header>

      <section className="flex gap-3 items-center flex-wrap">
        <label className="text-sm">
          <span className="mr-2">{t('analytics.range.label', 'Time range:')}</span>
          <select
            className="border rounded px-2 py-1"
            value={timeRange}
            onChange={e => onChange('timeRange', e.target.value)}
          >
            {presets.map(p => (
              <option key={p} value={p}>
                {t(`analytics.range.presets.${p}`, p.toUpperCase())}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mr-2">{t('analytics.compare.label', 'Compare to:')}</span>
          <select
            className="border rounded px-2 py-1"
            value={compareTo}
            onChange={e => onChange('compareTo', e.target.value)}
          >
            {compares.map(c => (
              <option key={c} value={c}>
                {t(`analytics.compare.${c}`, c.replace('_', ' '))}
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-xs text-muted-foreground">{t('analytics.lastRefreshed', 'Last refreshed: {{date}}', { date: lastRefreshed })}</span>
      </section>

      <Outlet />
    </div>
  )
}
