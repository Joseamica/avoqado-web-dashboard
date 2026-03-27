import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.avoqado.io'

const fmt = (n: number) =>
  '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pct = (n: number) => (n * 100).toFixed(2) + '%'

function getDefaultDates() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

interface Layer1Row {
  venueName: string
  tpvSerial: string
  cardType: string
  txCount: number
  grossAmount: number
  tips: number
  rate: number
  fee: number
  ivaFee: number
  netAmount: number
}

interface Layer1VenueSummary {
  venueName: string
  tpvSerial: string
  txCount: number
  grossAmount: number
  tips: number
  totalFees: number
  totalIva: number
  netAmount: number
}

interface Layer1GrandTotal {
  txCount: number
  grossAmount: number
  tips: number
  totalFees: number
  totalIva: number
  netAmount: number
}

interface Layer2Row {
  venueName: string
  tpvSerial: string
  cardType: string
  txCount: number
  grossAmount: number
  tips: number
  layer1Rate: number
  layer1Fee: number
  layer1Iva: number
  netAfterLayer1: number
  layer2Rate: number
  layer2Fee: number
  netToVenue: number
  referredBy: string
  externalShare: number
  aggregatorShare: number
}

interface Layer2VenueBreakdown {
  venueName: string
  tpvSerial: string
  referredBy: string
  txCount: number
  grossAmount: number
  tips: number
  layer1Fee: number
  layer1Iva: number
  layer2Fee: number
  netToVenue: number
  externalShare: number
  aggregatorShare: number
}

interface Layer2GrandTotals {
  txCount: number
  grossAmount: number
  tips: number
  layer1Fee: number
  layer1Iva: number
  layer2Fee: number
  netToVenue: number
  externalShare: number
  aggregatorShare: number
}

interface ReportData {
  aggregator: { id: string; name: string }
  dateRange: { from: string; to: string }
  layer1: {
    aggregatorName: string
    rows: Layer1Row[]
    venueSummaries: Layer1VenueSummary[]
    grandTotal: Layer1GrandTotal
  }
  layer2: {
    rows: Layer2Row[]
    venueBreakdown: Layer2VenueBreakdown[]
    grandTotals: Layer2GrandTotals
  }
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'green' | 'red' | 'blue' | 'purple' | 'gray'
}) {
  const colorMap = {
    green: 'border-green-700 text-green-400',
    red: 'border-red-700 text-red-400',
    blue: 'border-blue-700 text-blue-400',
    purple: 'border-purple-700 text-purple-400',
    gray: 'border-border text-foreground',
  }
  return (
    <div className={`rounded-lg border bg-muted p-4 ${colorMap[color]}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorMap[color].split(' ')[1]}`}>{value}</p>
    </div>
  )
}

function Layer1Tab({ data }: { data: ReportData['layer1'] }) {
  const gt = data.grandTotal
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Bruto" value={fmt(gt.grossAmount)} color="gray" />
        <SummaryCard label="Comisiones Blumon" value={fmt(gt.totalFees)} color="red" />
        <SummaryCard label="IVA (16%)" value={fmt(gt.totalIva)} color="red" />
        <SummaryCard label="Neto a MG" value={fmt(gt.netAmount)} color="green" />
      </div>

      {/* Detail table */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Detalle por Tarjeta</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs text-foreground">
            <thead className="bg-muted text-muted-foreground uppercase">
              <tr>
                {['Venue', 'TPV', 'Tipo', '#', 'Bruto', 'Propinas', 'Tasa Blumon', 'Comision', 'IVA (16%)', 'Neto a MG'].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted-foreground">
                    Sin datos para el rango seleccionado
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/50">
                    <td className="px-3 py-2">{r.venueName}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.tpvSerial}</td>
                    <td className="px-3 py-2 text-right">{r.cardType}</td>
                    <td className="px-3 py-2 text-right">{r.txCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.grossAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.tips)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{pct(r.rate)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(r.fee)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(r.ivaFee)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{fmt(r.netAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot className="bg-muted/60 font-semibold border-t border-border">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-muted-foreground">Total</td>
                  <td className="px-3 py-2 text-right">{fmt(gt.grossAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmt(gt.tips)}</td>
                  <td className="px-3 py-2 text-right"></td>
                  <td className="px-3 py-2 text-right text-red-400">{fmt(gt.totalFees)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{fmt(gt.totalIva)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{fmt(gt.netAmount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Venue summary table */}
      {data.venueSummaries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Resumen por Venue</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs text-foreground">
              <thead className="bg-muted text-muted-foreground uppercase">
                <tr>
                  {['Venue', 'TPV', '#', 'Bruto', 'Propinas', 'Total Comisiones', 'IVA', 'Neto a MG'].map(h => (
                    <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.venueSummaries.map((s, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/50">
                    <td className="px-3 py-2">{s.venueName}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.tpvSerial}</td>
                    <td className="px-3 py-2 text-right">{s.txCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.grossAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.tips)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(s.totalFees)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(s.totalIva)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{fmt(s.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Layer2Tab({ data }: { data: ReportData['layer2'] }) {
  const gt = data.grandTotals
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="A Dispersar" value={fmt(gt.netToVenue)} color="green" />
        <SummaryCard label="AVO (70%)" value={fmt(gt.externalShare)} color="blue" />
        <SummaryCard label="MG (30%)" value={fmt(gt.aggregatorShare)} color="purple" />
        <SummaryCard label="Comision MG Total" value={fmt(gt.layer2Fee)} color="red" />
      </div>

      {/* Detail table */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Detalle por Tarjeta</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs text-foreground">
            <thead className="bg-muted text-muted-foreground uppercase">
              <tr>
                {[
                  'Venue', 'TPV', 'Tipo', '#', 'Bruto',
                  'Tasa Blumon', 'Com. Blumon', 'IVA (16%)', 'Neto a MG',
                  'Tasa MG', 'Com. MG', 'A Dispersar',
                  'AVO (70%)', 'MG (30%)',
                ].map(h => (
                  <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-8 text-muted-foreground">
                    Sin datos para el rango seleccionado
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/50">
                    <td className="px-3 py-2">{r.venueName}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.tpvSerial}</td>
                    <td className="px-3 py-2 text-right">{r.cardType}</td>
                    <td className="px-3 py-2 text-right">{r.txCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.grossAmount)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{pct(r.layer1Rate)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(r.layer1Fee)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(r.layer1Iva)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.netAfterLayer1)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{pct(r.layer2Rate)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(r.layer2Fee)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{fmt(r.netToVenue)}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{fmt(r.externalShare)}</td>
                    <td className="px-3 py-2 text-right text-purple-400">{fmt(r.aggregatorShare)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot className="bg-muted/60 font-semibold border-t border-border">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-muted-foreground">Total</td>
                  <td className="px-3 py-2 text-right">{fmt(gt.grossAmount)}</td>
                  <td className="px-3 py-2 text-right"></td>
                  <td className="px-3 py-2 text-right text-red-400">{fmt(gt.layer1Fee)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{fmt(gt.layer1Iva)}</td>
                  <td className="px-3 py-2 text-right"></td>
                  <td className="px-3 py-2 text-right"></td>
                  <td className="px-3 py-2 text-right text-red-400">{fmt(gt.layer2Fee)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{fmt(gt.netToVenue)}</td>
                  <td className="px-3 py-2 text-right text-blue-400">{fmt(gt.externalShare)}</td>
                  <td className="px-3 py-2 text-right text-purple-400">{fmt(gt.aggregatorShare)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Venue breakdown table */}
      {data.venueBreakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Resumen por Venue</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs text-foreground">
              <thead className="bg-muted text-muted-foreground uppercase">
                <tr>
                  {['Venue', 'TPV', 'Referido por', '#', 'Bruto', 'Propinas', 'Com. Blumon', 'IVA', 'Com. MG', 'A Dispersar', 'AVO (70%)', 'MG (30%)'].map(h => (
                    <th key={h} className="px-3 py-2 text-right first:text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.venueBreakdown.map((v, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent/50">
                    <td className="px-3 py-2">{v.venueName}</td>
                    <td className="px-3 py-2 text-right font-mono">{v.tpvSerial}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{v.referredBy || '—'}</td>
                    <td className="px-3 py-2 text-right">{v.txCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(v.grossAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmt(v.tips)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(v.layer1Fee)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(v.layer1Iva)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{fmt(v.layer2Fee)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{fmt(v.netToVenue)}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{fmt(v.externalShare)}</td>
                    <td className="px-3 py-2 text-right text-purple-400">{fmt(v.aggregatorShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettlementReport() {
  const { token } = useParams<{ token: string }>()
  const defaults = getDefaultDates()
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [activeTab, setActiveTab] = useState<'layer1' | 'layer2'>('layer1')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)

    const url = `${API_BASE}/reports/settlement/${token}?from=${fromDate}&to=${toDate}`
    fetch(url)
      .then(async res => {
        if (res.status === 404 || res.status === 401 || res.status === 403) {
          setError('not_found')
          return null
        }
        if (!res.ok) {
          setError('server_error')
          return null
        }
        return res.json()
      })
      .then(json => {
        if (json && json.success) {
          setData(json.data)
        } else if (json) {
          setError('server_error')
        }
      })
      .catch(() => setError('server_error'))
      .finally(() => setLoading(false))
  }, [token, fromDate, toDate])

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-muted-foreground mb-2">404</p>
          <p className="text-muted-foreground text-lg">Reporte no encontrado</p>
          <p className="text-muted-foreground text-sm mt-1">El enlace puede haber expirado o ser inválido.</p>
        </div>
      </div>
    )
  }

  if (error === 'server_error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-lg">Error al cargar el reporte</p>
          <p className="text-muted-foreground text-sm mt-1">Intenta recargar la página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {data?.aggregator?.name ?? 'Moneygiver'} — Reporte de Liquidaciones
            </h1>
            {data?.dateRange && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.dateRange.from} → {data.dateRange.to}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Cargando reporte...</p>
            </div>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-muted-foreground">Selecciona un rango de fechas para ver el reporte.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveTab('layer1')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'layer1'
                    ? 'bg-blue-600 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                Dispersión Blumon → MG
              </button>
              <button
                onClick={() => setActiveTab('layer2')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'layer2'
                    ? 'bg-blue-600 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                Comisiones MG → Comercio
              </button>
            </div>

            {activeTab === 'layer1' && <Layer1Tab data={data.layer1} />}
            {activeTab === 'layer2' && <Layer2Tab data={data.layer2} />}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 py-6 border-t border-border mt-8">
        <p className="text-xs text-muted-foreground text-center">
          Reporte generado por Avoqado · Todos los montos en MXN
        </p>
      </div>
    </div>
  )
}
