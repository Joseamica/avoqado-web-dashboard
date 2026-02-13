import { useState, useMemo } from 'react'
import { useServerMetrics } from '@/hooks/use-superadmin-queries'
import type { ServerMetricsAlert } from '@/services/superadmin.service'
import { GaugeChart } from '@/components/playtelecom/GaugeChart'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { Activity, Cpu, HardDrive, Wifi, Pause, Play, AlertTriangle, Clock } from 'lucide-react'

// --- Utilities ---

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function getGaugeColor(pct: number): 'green' | 'blue' | 'orange' | 'red' {
  if (pct < 60) return 'green'
  if (pct < 75) return 'blue'
  if (pct < 85) return 'orange'
  return 'red'
}

function getOverallHealth(alerts: ServerMetricsAlert[]): {
  status: 'success' | 'warning' | 'error'
  label: string
} {
  const hasCritical = alerts.some((a) => a.severity === 'critical')
  const hasWarning = alerts.some((a) => a.severity === 'warning')

  if (hasCritical) return { status: 'error', label: 'Crítico' }
  if (hasWarning) return { status: 'warning', label: 'Advertencia' }
  return { status: 'success', label: 'Saludable' }
}

// --- Chart colors (high contrast for both themes) ---

const COLORS = {
  rss: { light: '#2563eb', dark: '#60a5fa' },         // blue-600 / blue-400
  heapUsed: { light: '#7c3aed', dark: '#a78bfa' },    // violet-600 / violet-400
  cpu: { light: '#059669', dark: '#34d399' },          // emerald-600 / emerald-300
  lag: { light: '#d97706', dark: '#fbbf24' },          // amber-600 / amber-400
  limit: { light: '#dc2626', dark: '#f87171' },        // red-600 / red-400
}

// --- Chart configs ---

const memoryChartConfig = {
  rss: { label: 'RSS', theme: COLORS.rss },
  heapUsed: { label: 'Heap Usado', theme: COLORS.heapUsed },
}

const cpuChartConfig = {
  cpu: { label: 'CPU %', theme: COLORS.cpu },
}

const eventLoopChartConfig = {
  lag: { label: 'Lag (ms)', theme: COLORS.lag },
}

// --- Component ---

export default function ServerHealth() {
  const [isPaused, setIsPaused] = useState(false)
  const { data, isLoading, isError, error } = useServerMetrics(isPaused ? false : 30_000)

  const current = data?.current
  const history = data?.history ?? []
  const alerts = data?.alerts ?? []

  const health = useMemo(
    () => (alerts ? getOverallHealth(alerts) : null),
    [alerts],
  )

  // Prepare chart data from history
  const chartData = useMemo(
    () =>
      history.map((s) => ({
        time: formatTime(s.timestamp),
        rss: s.memory.rssMb,
        heapUsed: s.memory.heapUsedMb,
        cpu: s.cpu.percent,
        lag: s.eventLoop.lagMs,
      })),
    [history],
  )

  const memoryLimitMb = current?.memory.limitMb ?? 512
  const memoryPct = current?.memory.rssPercent ?? 0
  const cpuPct = current?.cpu.percent ?? 0

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Error al cargar métricas del servidor</p>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Server Health</h1>
          {health && <StatusBadge variant={health.status}>{health.label}</StatusBadge>}
        </div>
        <div className="flex items-center gap-4">
          {current && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Uptime: {formatUptime(current.uptime)}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Reanudar
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Memory Gauge (RSS vs container limit) */}
        <Card>
          <CardContent className="flex flex-col items-center pt-6">
            <GaugeChart
              value={Math.round(memoryPct)}
              max={100}
              label="Memoria (RSS)"
              size="sm"
              colorScheme={getGaugeColor(memoryPct)}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {current ? `${current.memory.rssMb} MB` : '—'} / {memoryLimitMb} MB
            </p>
          </CardContent>
        </Card>

        {/* CPU Gauge (% relative to container limit) */}
        <Card>
          <CardContent className="flex flex-col items-center pt-6">
            <GaugeChart
              value={Math.round(cpuPct)}
              max={100}
              label="CPU"
              size="sm"
              colorScheme={getGaugeColor(cpuPct)}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {current ? `Límite: ${current.cpu.limitCores} cores` : '—'}
            </p>
          </CardContent>
        </Card>

        {/* Event Loop Lag */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Event Loop Lag</span>
            </div>
            <p
              className={`mt-3 text-4xl font-bold ${
                (current?.eventLoop.lagMs ?? 0) >= 100
                  ? 'text-red-600 dark:text-red-400'
                  : (current?.eventLoop.lagMs ?? 0) >= 50
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {current?.eventLoop.lagMs.toFixed(1) ?? '—'}
              <span className="ml-1 text-lg font-normal text-muted-foreground">ms</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              p99: {current?.eventLoop.lagP99Ms.toFixed(1) ?? '—'}ms
            </p>
          </CardContent>
        </Card>

        {/* Active Connections */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center pt-6">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Conexiones</span>
            </div>
            <p className="mt-3 text-4xl font-bold text-foreground">
              {current?.connections.active ?? '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Conexiones HTTP activas</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Memory over time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4" />
                Memoria (MB)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={memoryChartConfig} className="h-[250px] w-full">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="rss"
                    name="RSS"
                    fill="var(--color-rss)"
                    fillOpacity={0.3}
                    stroke="var(--color-rss)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="heapUsed"
                    name="Heap Usado"
                    fill="var(--color-heapUsed)"
                    fillOpacity={0.2}
                    stroke="var(--color-heapUsed)"
                    strokeWidth={2}
                  />
                  <ReferenceLine
                    y={memoryLimitMb}
                    stroke={COLORS.limit.dark}
                    strokeDasharray="5 5"
                    label={{ value: 'Límite', fill: COLORS.limit.dark, fontSize: 11 }}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* CPU over time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" />
                CPU (% del límite)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={cpuChartConfig} className="h-[250px] w-full">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    name="CPU %"
                    stroke="var(--color-cpu)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Event Loop Lag over time */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Event Loop Lag (ms)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={eventLoopChartConfig} className="h-[250px] w-full">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="lag"
                    name="Lag (ms)"
                    stroke="var(--color-lag)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <ReferenceLine
                    y={100}
                    stroke={COLORS.limit.dark}
                    strokeDasharray="5 5"
                    label={{ value: 'Umbral', fill: COLORS.limit.dark, fontSize: 11 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Table */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas Activas ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Umbral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert, idx) => (
                  <TableRow key={`${alert.type}-${idx}`}>
                    <TableCell className="font-medium capitalize">{alert.type}</TableCell>
                    <TableCell>{alert.message}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={alert.severity === 'critical' ? 'error' : 'warning'}
                      >
                        {alert.severity === 'critical' ? 'Crítico' : 'Advertencia'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {alert.value.toFixed(1)}{alert.type === 'eventLoop' ? ' ms' : '%'}
                    </TableCell>
                    <TableCell>
                      {alert.threshold}{alert.type === 'eventLoop' ? ' ms' : '%'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      {current && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información del Proceso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <p className="text-muted-foreground">RSS</p>
                <p className="font-medium">{current.memory.rssMb} MB ({current.memory.rssPercent}%)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Límite Memoria</p>
                <p className="font-medium">{current.memory.limitMb} MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">Heap Usado</p>
                <p className="font-medium">{current.memory.heapUsedMb} MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">Heap Total (V8)</p>
                <p className="font-medium">{formatBytes(current.memory.heapTotal)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">External</p>
                <p className="font-medium">{formatBytes(current.memory.external)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Array Buffers</p>
                <p className="font-medium">{formatBytes(current.memory.arrayBuffers)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPU Límite</p>
                <p className="font-medium">{current.cpu.limitCores} cores</p>
              </div>
              <div>
                <p className="text-muted-foreground">Event Loop Max</p>
                <p className="font-medium">{current.eventLoop.lagMaxMs.toFixed(1)} ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
