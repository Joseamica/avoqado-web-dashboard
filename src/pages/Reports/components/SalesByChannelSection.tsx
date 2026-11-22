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
  /** El SERVIDOR avisó que las tablas se leyeron un instante después de la cabecera y ya no cuadran (entró una venta). */
  desfasado?: boolean
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

export function SalesByChannelSection({
  byChannel,
  byOrderType,
  sinPlan,
  bloqueadoPorElServidor,
  conFiltro,
  desfasado = false,
  formatCurrency,
}: Props) {
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

  // El SERVIDOR manda: si trajo las tablas, el plan las incluye aunque la pantalla tuviera guardado otro plan (Codex r2 #9); si no las
  // trajo, Gratis ve el candado con su botón de plan y, si la pantalla creía que sí, el aviso del SERVIDOR.
  if (!byChannel || !byOrderType) {
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
    // La pantalla creía que sí (plan sin leer o guardado viejo) y el SERVIDOR dijo que no.
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

    // Un SERVIDOR anterior a la función no manda las tablas: no hay nada que enseñar todavía.
    return null
  }

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
        {desfasado && (
          <p
            className="mb-3 rounded-lg border border-input bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            data-testid="ventas-por-canal-desfasado"
          >
            {t('salesSummary.channels.outOfSync')}
          </p>
        )}
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
  // El % es de las ventas netas y sólo si todos los renglones son ≥ 0 (la regla de la barra de métodos del resumen): con una
  // devolución que deja un canal en negativo, «200 %» y «160 %» o dos barras llenas mentirían (Codex r2 #10).
  const hayReparto = total.netSales > 0 && filas.every(r => r.netSales >= 0)
  const pct = (v: number) => (hayReparto ? (v / total.netSales) * 100 : null)
  // El QR del sistema anterior no trae pedidos: si hay, el total de pedidos lo dice en vez de presentarlo como completo (Codex r2 #11).
  const sinPedidosContados = filas.some(r => r.orderCount == null)
  const conteos = (r: { orderCount: number | null; transactionCount: number }, esTotal = false) =>
    [
      r.orderCount != null
        ? t(esTotal && sinPedidosContados ? 'salesSummary.channels.ordersWithoutLegacy' : 'salesSummary.channels.orders', {
            count: r.orderCount,
          })
        : null,
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
                <div className="text-xs font-normal text-muted-foreground">{conteos(total, true)}</div>
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

      {/* Celular: tarjetas apiladas, y el total con las mismas cifras que en escritorio (Codex r2 #11) */}
      <ul className="space-y-2 md:hidden" data-testid="ventas-por-canal-lista">
        {filas.map(r => (
          <Tarjeta
            key={r.key}
            nombre={nombre(r.key)}
            fila={r}
            pct={pct(r.netSales)}
            conteos={muestra ? '—' : conteos(r)}
            hayTerceros={hayTerceros}
            dinero={dinero}
          />
        ))}
        {!muestra && (
          <Tarjeta
            nombre={t('salesSummary.channels.total')}
            fila={total}
            pct={null}
            conteos={conteos(total, true)}
            hayTerceros={hayTerceros}
            dinero={dinero}
            esTotal
          />
        )}
      </ul>
    </div>
  )
}

function Tarjeta({
  nombre,
  fila,
  pct,
  conteos,
  hayTerceros,
  dinero,
  esTotal = false,
}: {
  nombre: string
  fila: Pick<SalesBreakdownRow, 'netSales' | 'tips' | 'platformFees' | 'tenderCommissions' | 'totalCollected'>
  pct: number | null
  conteos: string
  hayTerceros: boolean
  dinero: (n: number) => string
  esTotal?: boolean
}) {
  const { t } = useTranslation('reports')
  return (
    <li
      className={cn('rounded-xl border border-input p-3', esTotal && 'bg-muted/40 font-semibold')}
      data-testid={esTotal ? 'canal-total-celular' : undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{nombre}</span>
        <span className="font-semibold tabular-nums">{dinero(fila.netSales)}</span>
      </div>
      {pct != null && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
        <dt>{t('salesSummary.channels.cols.tips')}</dt>
        <dd className="text-right tabular-nums">{dinero(fila.tips)}</dd>
        <dt>{t('salesSummary.channels.cols.platformFees')}</dt>
        <dd className="text-right tabular-nums">{dinero(-fila.platformFees)}</dd>
        {hayTerceros && (
          <>
            <dt>{t('salesSummary.channels.cols.tenderCommissions')}</dt>
            <dd className="text-right tabular-nums">{dinero(-fila.tenderCommissions)}</dd>
          </>
        )}
        <dt className="font-medium text-foreground">{t('salesSummary.channels.cols.totalCollected')}</dt>
        <dd className="text-right font-medium tabular-nums text-foreground">{dinero(fila.totalCollected)}</dd>
      </dl>
      <p className="mt-1 text-xs font-normal text-muted-foreground">{conteos}</p>
    </li>
  )
}
