import { GlassCard } from '@/components/ui/glass-card'
import { Flame, Snowflake } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { OrgStockOverview } from '@/services/stockDashboard.service'
import { CategoryChip } from '../components/CategoryChip'

interface OrgResumenTabProps {
  data: OrgStockOverview
}

const PIE_HEX_PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899'] // matches CATEGORY_COLOR_PALETTE order

function hashIndex(str: string, mod: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}

export function OrgResumenTab({ data }: OrgResumenTabProps) {
  const { aggregatesByCategoria, aggregatesBySucursal } = data

  const donutData = aggregatesByCategoria.map(c => ({
    name: c.categoryName,
    value: c.totalSims,
    fill: PIE_HEX_PALETTE[hashIndex(c.categoryName, PIE_HEX_PALETTE.length)],
  }))

  const topVenues = [...aggregatesBySucursal]
    .sort((a, b) => b.totalSims - a.totalSims)
    .slice(0, 5)
    .map(v => ({
      name: v.venueName.length > 22 ? v.venueName.slice(0, 20) + '…' : v.venueName,
      total: v.totalSims,
    }))

  const hotSpots = [...aggregatesBySucursal]
    .filter(a => a.rotacionPct > 0)
    .sort((a, b) => b.rotacionPct - a.rotacionPct)
    .slice(0, 3)

  const coldSpots = [...aggregatesBySucursal].sort((a, b) => (a.lastActivity ?? '').localeCompare(b.lastActivity ?? '')).slice(0, 3)

  return (
    <>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribución por Categoría</h3>
          {donutData.length > 0 ? (
            <>
              <div className="h-64" aria-label={`Distribución: ${donutData.map(d => `${d.name} ${d.value}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {donutData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-sm text-foreground">{payload[0].name}</p>
                          <p className="text-sm text-muted-foreground">{Number(payload[0].value).toLocaleString('es-MX')} SIMs</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {aggregatesByCategoria.map(c => (
                  <CategoryChip key={c.categoryId} name={c.categoryName} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">Sin categorías</p>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top 5 Sucursales por Volumen</h3>
          {topVenues.length > 0 ? (
            <div className="h-64" role="img" aria-label={`Top sucursales: ${topVenues.map(v => `${v.name} ${v.total}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVenues} layout="vertical" margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="name" type="category" width={130} fontSize={11} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-sm text-foreground">{label}</p>
                          <p className="text-sm text-muted-foreground">{Number(payload[0].value).toLocaleString('es-MX')} SIMs</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">Sin sucursales con datos</p>
          )}
        </GlassCard>
      </div>

      {/* Hot/Cold spots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-linear-to-br from-amber-500/20 to-amber-500/5">
              <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold">Hot Spots</h3>
            <span className="text-xs text-muted-foreground">(mayor rotación)</span>
          </div>
          {hotSpots.length > 0 ? (
            <ul className="space-y-3">
              {hotSpots.map(h => (
                <li key={h.venueId} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-3">{h.venueName}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{h.rotacionPct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin rotación en el período</p>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-500/5">
              <Snowflake className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold">Sucursales Frías</h3>
            <span className="text-xs text-muted-foreground">(menor actividad)</span>
          </div>
          {coldSpots.length > 0 ? (
            <ul className="space-y-3">
              {coldSpots.map(c => (
                <li key={c.venueId} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-3">{c.venueName}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString('es-MX') : 'Sin actividad'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          )}
        </GlassCard>
      </div>
    </>
  )
}
