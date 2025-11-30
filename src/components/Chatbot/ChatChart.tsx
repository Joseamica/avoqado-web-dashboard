import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '../ui/chart'
import type { ChartVisualization } from '@/services/chatService'

// Theme-aware chart colors
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

interface ChatChartProps {
  visualization: ChartVisualization
}

export function ChatChart({ visualization }: ChatChartProps) {
  const { t } = useTranslation()
  const { type, title, description, data, config } = visualization

  // Generate chart config for colors
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {}
    config.dataKeys.forEach((dk, idx) => {
      cfg[dk.key] = {
        label: dk.label,
        color: dk.color || CHART_COLORS[idx % CHART_COLORS.length],
      }
    })
    // Add nameKey for pie charts
    if (config.xAxis?.key) {
      cfg[config.xAxis.key] = {
        label: config.xAxis.label,
      }
    }
    return cfg
  }, [config.dataKeys, config.xAxis])

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            {config.xAxis && (
              <XAxis
                dataKey={config.xAxis.key}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  // Truncate long labels
                  if (typeof value === 'string' && value.length > 12) {
                    return value.substring(0, 12) + '...'
                  }
                  return value
                }}
              />
            )}
            {config.yAxis && <YAxis tickLine={false} axisLine={false} tickMargin={8} />}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {config.dataKeys.map((dk) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                fill={`var(--color-${dk.key})`}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )

      case 'line':
        return (
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            {config.xAxis && (
              <XAxis
                dataKey={config.xAxis.key}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  if (typeof value === 'string' && value.length > 12) {
                    return value.substring(0, 12) + '...'
                  }
                  return value
                }}
              />
            )}
            {config.yAxis && <YAxis tickLine={false} axisLine={false} tickMargin={8} />}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {config.dataKeys.map((dk) => (
              <Line
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={`var(--color-${dk.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            {config.xAxis && (
              <XAxis
                dataKey={config.xAxis.key}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  if (typeof value === 'string' && value.length > 12) {
                    return value.substring(0, 12) + '...'
                  }
                  return value
                }}
              />
            )}
            {config.yAxis && <YAxis tickLine={false} axisLine={false} tickMargin={8} />}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {config.dataKeys.map((dk) => (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                fill={`var(--color-${dk.key})`}
                stroke={`var(--color-${dk.key})`}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        )

      case 'pie': {
        const pieDataKey = config.dataKeys[0]?.key || 'value'
        const nameKey = config.xAxis?.key || 'name'
        return (
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
            <Pie
              data={data}
              dataKey={pieDataKey}
              nameKey={nameKey}
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
            >
              {data.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey={nameKey} />}
              className="flex-wrap gap-2 text-xs"
            />
          </PieChart>
        )
      }

      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('chat.visualization.noData', 'No hay datos disponibles para la gráfica')}
          </div>
        )
    }
  }

  if (!data || data.length === 0) {
    return null
  }

  return (
    <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
      <h4 className="text-sm font-medium mb-1 text-foreground">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
      )}
      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        {renderChart()}
      </ChartContainer>
    </div>
  )
}
