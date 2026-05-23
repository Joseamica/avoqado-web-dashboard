/**
 * Reporte de revenue-share por merchant — section dentro de /superadmin/aggregators.
 *
 * Lee del modelo nuevo (`MerchantRevenueShare` + `computeRevenueSplit` sobre
 * `TransactionCost`). NO toca la liquidación legacy (job 70/30). Aditivo.
 *
 * Spec: docs/superpowers/specs/2026-05-22-revenue-share-fee-model-design.md
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Wallet, Building2, BarChart3, Pencil } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { merchantRevenueShareAPI } from '@/services/merchantRevenueShare.service'
import RevenueShareEditDialog from './RevenueShareEditDialog'

/** Default = últimos 30 días (UTC). */
function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setUTCDate(from.getUTCDate() - 30)
  return {
    fromISO: from.toISOString().slice(0, 10),
    toISO: to.toISOString().slice(0, 10),
  }
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n)

export default function RevenueShareReportSection() {
  const init = useMemo(defaultRange, [])
  const [fromISO, setFromISO] = useState(init.fromISO)
  const [toISO, setToISO] = useState(init.toISO)
  /**
   * Click on a report row → opens the inline edit dialog. We only need the id +
   * label here; the dialog itself fetches the actual share (if any) and lazy-
   * initializes the form. Closing simply nulls this state.
   */
  const [editing, setEditing] = useState<{ merchantAccountId: string; merchantLabel: string } | null>(
    null,
  )

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['revenue-share-report', fromISO, toISO],
    queryFn: () =>
      merchantRevenueShareAPI.getReport({
        // T00:00:00 → fin del día para que el rango sea inclusivo.
        from: new Date(`${fromISO}T00:00:00.000Z`),
        to: new Date(`${toISO}T23:59:59.999Z`),
      }),
    enabled: Boolean(fromISO && toISO),
    staleTime: 60_000,
  })

  const rows = data?.data ?? []
  const totals = data?.meta.totals

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Reporte de revenue-share
          </h2>
          <p className="text-sm text-muted-foreground">
            Reparto por merchant (Avoqado / agregador / provider) en el periodo seleccionado.
            Lee el modelo nuevo (<code>MerchantRevenueShare</code>) y los <code>TransactionCost</code> reales —{' '}
            <strong>no toca</strong> la liquidación legacy.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={fromISO}
              onChange={e => setFromISO(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={toISO} onChange={e => setToISO(e.target.value)} className="h-9 w-[150px]" />
          </div>
        </div>
      </div>

      {/* Totales */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassCard className="p-3">
            <p className="text-[11px] text-muted-foreground">Transacciones</p>
            <p className="text-lg font-semibold">{totals.txCount}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-[11px] text-muted-foreground">Volumen</p>
            <p className="text-lg font-semibold">{fmtMoney(totals.volume)}</p>
          </GlassCard>
          <GlassCard className="p-3 border-l-4 border-l-primary">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              Avoqado neto
            </p>
            <p className="text-lg font-semibold">{fmtMoney(totals.avoqadoNet)}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-[11px] text-muted-foreground">Agregador neto</p>
            <p className="text-lg font-semibold">{fmtMoney(totals.aggregatorNet)}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-[11px] text-muted-foreground">Provider neto</p>
            <p className="text-lg font-semibold">{fmtMoney(totals.providerNet)}</p>
          </GlassCard>
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground text-sm">Calculando reparto…</span>
        </div>
      ) : isError ? (
        <GlassCard className="p-6 text-center">
          <p className="text-sm text-destructive">
            Error al cargar el reporte: {(error as Error)?.message || 'desconocido'}
          </p>
          <button onClick={() => refetch()} className="mt-2 text-xs underline text-muted-foreground">
            Reintentar
          </button>
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">
            No hay transacciones en el periodo — o ningún merchant tiene <code>MerchantRevenueShare</code> configurado.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Los merchants sin config aparecen igual aquí (default: 100% Avoqado).
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Merchant</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ruta</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Txs</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Volumen</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avoqado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Agregador</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Provider</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map(r => (
                  <tr
                    key={r.merchantAccountId}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() =>
                      setEditing({ merchantAccountId: r.merchantAccountId, merchantLabel: r.merchantLabel })
                    }
                    title="Click para configurar el reparto de este merchant"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{r.merchantLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.providerCode}</td>
                    <td className="px-4 py-3">
                      {r.hasShareConfig ? (
                        r.hasAggregator ? (
                          <Badge variant="default" className="text-[10px]">vía agregador</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">directo</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-[10px]" title="Sin MerchantRevenueShare — default 100% Avoqado">
                          sin config
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.txCount}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(r.volume)}</td>
                    <td className="px-4 py-3 text-right font-mono text-primary font-semibold">
                      {fmtMoney(r.avoqadoNet)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {r.aggregatorNet === 0 ? '—' : fmtMoney(r.aggregatorNet)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {fmtMoney(r.providerNet)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground/60 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isFetching && <p className="px-4 py-2 text-[11px] text-muted-foreground">Actualizando…</p>}
        </GlassCard>
      )}

      {/* Inline edit dialog — opens when the operator clicks a row above. The
          `key` ensures internal form state is fresh on each open + per merchant. */}
      {editing && (
        <RevenueShareEditDialog
          key={editing.merchantAccountId}
          open
          onOpenChange={o => !o && setEditing(null)}
          merchantAccountId={editing.merchantAccountId}
          merchantLabel={editing.merchantLabel}
        />
      )}
    </div>
  )
}
