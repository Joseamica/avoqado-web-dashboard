import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Filter, Lock, Route } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { cn } from '@/lib/utils'
import type { SalesBreakdownRow } from '@/services/reports/salesSummary.service'

/**
 * «Ventas por canal» del Resumen de ventas (carril G, hz:fefa11b6:D4): la cabecera repartida por dónde entró la venta (mostrador,
 * mesas, tienda en línea, Rappi…) y por tipo de pedido (en el local, para llevar…). El SERVIDOR reparte cada importe al centavo:
 * la fila «Total» es la suma de los renglones y da lo mismo que el resumen de arriba. Plan Pro (ADVANCED_REPORTS).
 */
interface Props {
  byChannel?: SalesBreakdownRow[]
  byOrderType?: SalesBreakdownRow[]
  /** El plan del negocio no lo incluye (según la pantalla). */
  sinPlan: boolean
  /** El servidor lo dejó fuera por el plan, aunque la pantalla creyera que sí (plan sin leer o mal leído). */
  bloqueadoPorElServidor: boolean
  /** Vista de movimientos (filtro de método o de comercio): no hay cuentas que repartir. */
  conFiltro: boolean
  formatCurrency: (n: number) => string
}

type Vista = 'channel' | 'orderType'

/** Renglones de muestra para el candado: nombres de canal y cifras en guion, nunca datos del negocio. */
const MUESTRA: SalesBreakdownRow[] = ['COUNTER', 'TABLES', 'ONLINE_STORE', 'RAPPI'].map(key => ({
  key,
  grossSales: 0,
  discounts: 0,
  refunds: 0,
  netSales: 0,
  tips: 0,
  platformFees: 0,
  tenderCommissions: 0,
  totalCollected: 0,
  orderCount: 0,
  transactionCount: 0,
  refundCount: 0,
}))

export function SalesByChannelSection({ byChannel, byOrderType, sinPlan, bloqueadoPorElServidor, conFiltro, formatCurrency }: Props) {
  const { t } = useTranslation('reports')
  const [vista, setVista] = useState<Vista>('channel')

  const encabezado = (
    <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
      <div className="rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 p-2">
        <Route className="h-4 w-4 text-sky-600 dark:text-sky-400" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{t('salesSummary.channels.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('salesSummary.channels.description')}</p>
      </div>
    </div>
  )

  // Apagado se ve y se explica: Gratis ve la sección con su candado (renglones de muestra borrosos, sin datos del negocio).
  if (sinPlan) {
    return (
      <GlassCard className="overflow-hidden border-input p-0" data-testid="ventas-por-canal-candado">
        {encabezado}
        <div className="p-4 sm:p-5">
          <FeatureGate feature="ADVANCED_REPORTS">
            <Tabla filas={MUESTRA} vista="channel" formatCurrency={() => '—'} muestra />
          </FeatureGate>
        </div>
      </GlassCard>
    )
  }

  if (bloqueadoPorElServidor) {
    return (
      <GlassCard className="overflow-hidden border-input p-0" data-testid="ventas-por-canal-candado">
        {encabezado}
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground sm:px-6">
          <Lock className="h-4 w-4 shrink-0" />
          {t('salesSummary.channels.lockedByPlan')}
        </p>
      </GlassCard>
    )
  }

  if (conFiltro) {
    return (
      <GlassCard className="overflow-hidden border-input p-0" data-testid="ventas-por-canal-filtro">
        {encabezado}
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground sm:px-6">
          <Filter className="h-4 w-4 shrink-0" />
          {t('salesSummary.channels.filteredNote')}
        </p>
      </GlassCard>
    )
  }

  // Un SERVIDOR anterior a la función no manda las tablas: no hay nada que enseñar todavía.
  if (!byChannel || !byOrderType) return null

  const filas = vista === 'channel' ? byChannel : byOrderType
  return (
    <GlassCard className="overflow-hidden border-input p-0" data-testid="ventas-por-canal" data-tour="sales-summary-channels">
      <div className="flex flex-col gap-3 pr-5 sm:flex-row sm:items-start sm:justify-between sm:pr-6">
        {encabezado}
        <div className="px-5 sm:px-0 sm:pt-5">
          <Tabs value={vista} onValueChange={v => setVista(v as Vista)}>
            <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
              <TabsTrigger value="channel" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
                {t('salesSummary.channels.tabs.channel')}
              </TabsTrigger>
              <TabsTrigger value="orderType" className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background">
                {t('salesSummary.channels.tabs.orderType')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        {filas.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">{t('salesSummary.channels.empty')}</p>
        ) : (
          <Tabla filas={filas} vista={vista} formatCurrency={formatCurrency} />
        )}
      </div>
    </GlassCard>
  )
}

function Tabla({
  filas,
  vista,
  formatCurrency,
  muestra = false,
}: {
  filas: SalesBreakdownRow[]
  vista: Vista
  formatCurrency: (n: number) => string
  muestra?: boolean
}) {
  const { t } = useTranslation('reports')
  const nombre = (key: string) =>
    t(vista === 'channel' ? `salesSummary.channels.names.${key}` : `salesSummary.channels.orderTypes.${key}`, key)

  // La fila «Total» suma los renglones (el SERVIDOR los reparte al centavo: da lo mismo que el resumen). En centavos para no
  // acumular el ruido de los decimales.
  const total = useMemo(() => {
    const s = (f: (r: SalesBreakdownRow) => number) => filas.reduce((acc, r) => acc + Math.round(f(r) * 100), 0) / 100
    const pedidos = filas.every(r => r.orderCount == null) ? null : filas.reduce((acc, r) => acc + (r.orderCount ?? 0), 0)
    return {
      netSales: s(r => r.netSales),
      tips: s(r => r.tips),
      platformFees: s(r => r.platformFees),
      tenderCommissions: s(r => r.tenderCommissions),
      totalCollected: s(r => r.totalCollected),
      orderCount: pedidos,
      transactionCount: filas.reduce((acc, r) => acc + r.transactionCount, 0),
    }
  }, [filas])
  const hayTerceros = filas.some(r => r.tenderCommissions !== 0)
  // El % es de las ventas netas; con un total ≤ 0 (puras devoluciones) o un renglón negativo no se pinta: mentiría.
  const pct = (v: number) => (total.netSales > 0 && v >= 0 ? (v / total.netSales) * 100 : null)
  const conteos = (r: { orderCount: number | null; transactionCount: number }) =>
    [
      r.orderCount != null ? t('salesSummary.channels.orders', { count: r.orderCount }) : null,
      t('salesSummary.channels.transactions', { count: r.transactionCount }),
    ]
      .filter(Boolean)
      .join(' · ')
  const dinero = (n: number) => (muestra ? '—' : formatCurrency(n))

  return (
    <div className={cn(muestra && 'pointer-events-none select-none')}>
      {/* Escritorio: tabla */}
      <table className="hidden w-full text-sm md:table" data-testid="ventas-por-canal-tabla">
        <thead>
          <tr className="border-b border-input text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">
              {t(vista === 'channel' ? 'salesSummary.channels.cols.channel' : 'salesSummary.channels.cols.orderType')}
            </th>
            <th className="py-2 px-3 text-right font-medium">{t('salesSummary.channels.cols.netSales')}</th>
            <th className="py-2 px-3 text-right font-medium">{t('salesSummary.channels.cols.tips')}</th>
            <th className="py-2 px-3 text-right font-medium">{t('salesSummary.channels.cols.platformFees')}</th>
            {hayTerceros && <th className="py-2 px-3 text-right font-medium">{t('salesSummary.channels.cols.tenderCommissions')}</th>}
            <th className="py-2 pl-3 text-right font-medium">{t('salesSummary.channels.cols.totalCollected')}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(r => {
            const p = pct(r.netSales)
            return (
              <tr key={r.key} className="border-b border-input/60 last:border-0" data-testid={`canal-${r.key}`}>
                <td className="py-2.5 pr-3">
                  <div className="font-medium">{nombre(r.key)}</div>
                  <div className="text-xs text-muted-foreground">{muestra ? '—' : conteos(r)}</div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="font-semibold tabular-nums">{dinero(r.netSales)}</div>
                  {!muestra && p != null && <div className="text-xs text-muted-foreground tabular-nums">{p.toFixed(1)}%</div>}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{dinero(r.tips)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{dinero(-r.platformFees)}</td>
                {hayTerceros && (
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{dinero(-r.tenderCommissions)}</td>
                )}
                <td className="py-2.5 pl-3 text-right font-medium tabular-nums">{dinero(r.totalCollected)}</td>
              </tr>
            )
          })}
        </tbody>
        {!muestra && (
          <tfoot>
            <tr className="border-t border-input font-semibold" data-testid="canal-total">
              <td className="pt-3 pr-3">
                <div>{t('salesSummary.channels.total')}</div>
                <div className="text-xs font-normal text-muted-foreground">{conteos(total)}</div>
              </td>
              <td className="pt-3 px-3 text-right tabular-nums">{formatCurrency(total.netSales)}</td>
              <td className="pt-3 px-3 text-right tabular-nums">{formatCurrency(total.tips)}</td>
              <td className="pt-3 px-3 text-right tabular-nums">{formatCurrency(-total.platformFees)}</td>
              {hayTerceros && <td className="pt-3 px-3 text-right tabular-nums">{formatCurrency(-total.tenderCommissions)}</td>}
              <td className="pt-3 pl-3 text-right tabular-nums">{formatCurrency(total.totalCollected)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Celular: tarjetas apiladas */}
      <ul className="space-y-2 md:hidden" data-testid="ventas-por-canal-lista">
        {filas.map(r => {
          const p = pct(r.netSales)
          return (
            <li key={r.key} className="rounded-xl border border-input p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{nombre(r.key)}</span>
                <span className="font-semibold tabular-nums">{dinero(r.netSales)}</span>
              </div>
              {!muestra && p != null && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, p)}%` }} />
                </div>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <dt>{t('salesSummary.channels.cols.tips')}</dt>
                <dd className="text-right tabular-nums">{dinero(r.tips)}</dd>
                <dt>{t('salesSummary.channels.cols.platformFees')}</dt>
                <dd className="text-right tabular-nums">{dinero(-r.platformFees)}</dd>
                {hayTerceros && (
                  <>
                    <dt>{t('salesSummary.channels.cols.tenderCommissions')}</dt>
                    <dd className="text-right tabular-nums">{dinero(-r.tenderCommissions)}</dd>
                  </>
                )}
                <dt className="font-medium text-foreground">{t('salesSummary.channels.cols.totalCollected')}</dt>
                <dd className="text-right font-medium tabular-nums text-foreground">{dinero(r.totalCollected)}</dd>
              </dl>
              <p className="mt-1 text-xs text-muted-foreground">{muestra ? '—' : conteos(r)}</p>
            </li>
          )
        })}
        {!muestra && (
          <li className="flex items-baseline justify-between gap-3 rounded-xl bg-muted/40 p-3 font-semibold">
            <span>{t('salesSummary.channels.total')}</span>
            <span className="tabular-nums">{formatCurrency(total.netSales)}</span>
          </li>
        )}
      </ul>
    </div>
  )
}
