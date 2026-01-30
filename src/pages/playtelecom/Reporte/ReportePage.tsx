/**
 * ReportePage - Closing Report (Excel-style view)
 *
 * Displays:
 * - Back button to supervisor
 * - Download .XLSX button
 * - Excel-style table with green headers
 * - Footer with total
 *
 * Access: MANAGER+ only
 */

import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Table2, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useOrganization } from '@/hooks/useOrganization'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getClosingReportData, downloadClosingReportXlsx } from '@/services/organizationDashboard.service'
import { cn } from '@/lib/utils'

export function ReportePage() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const navigate = useNavigate()
  const { activeVenue } = useAuth()
  const { fullBasePath } = useCurrentVenue()
  const { organizationId } = useOrganization()

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['organization', organizationId, 'closing-report'],
    queryFn: () => getClosingReportData(organizationId!),
    enabled: !!organizationId,
    staleTime: 60000,
  })

  const rows = useMemo(() => reportData?.rows ?? [], [reportData])
  const total = useMemo(() => reportData?.totalAmount ?? rows.reduce((acc, r) => acc + r.amount, 0), [reportData, rows])

  const formatCurrency = useMemo(
    () => (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: activeVenue?.currency || 'MXN',
        minimumFractionDigits: 2,
      }).format(value),
    [activeVenue?.currency],
  )

  const handleBack = useCallback(() => {
    navigate(`${fullBasePath}/playtelecom/supervisor`)
  }, [navigate, fullBasePath])

  const handleDownload = useCallback(async () => {
    if (!organizationId) return
    try {
      const blob = await downloadClosingReportXlsx(organizationId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-cierre-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }, [organizationId])

  const saleTypeColor = (type: string) => {
    if (type.includes('Portabilidad')) return 'bg-purple-900/40 text-purple-300 border-purple-800'
    if (type.includes('Recarga')) return 'bg-amber-900/40 text-amber-300 border-amber-800'
    return 'bg-blue-900/40 text-blue-300 border-blue-800'
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="shrink-0 h-14 border-b border-border/50 bg-background flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            {t('playtelecom:reporte.back', { defaultValue: 'Atras' })}
          </Button>
          <h2 className="font-bold text-lg text-green-500 flex items-center gap-2">
            <Table2 className="w-5 h-5" />
            {t('playtelecom:reporte.title', { defaultValue: 'Reporte de Cierre (Vista Excel)' })}
          </h2>
        </div>
        <Button
          size="sm"
          onClick={handleDownload}
          className="bg-[#107c41] hover:bg-[#0b5c2f] gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          {t('playtelecom:reporte.saveXlsx', { defaultValue: 'Guardar .XLSX' })}
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 bg-muted/20">
        <div className="inline-block min-w-full shadow-md rounded-sm overflow-hidden bg-card">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10 text-center border border-border/50 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground bg-muted/50">
                  #
                </th>
                {['Ciudad', 'Tienda', 'ICCID', 'Tipo Venta', 'Promotor', 'Fecha', 'Monto Cobrado'].map(h => (
                  <th
                    key={h}
                    className={cn(
                      'border border-green-900/50 px-3 py-2 text-xs font-semibold uppercase',
                      'bg-green-900/60 text-green-100',
                      h === 'Monto Cobrado' && 'text-right'
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    {t('playtelecom:reporte.noData', { defaultValue: 'No hay datos para mostrar' })}
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.rowNumber} className="hover:bg-muted/20 transition">
                  <td className="text-center border border-border/30 px-3 py-2 text-xs font-mono text-muted-foreground bg-muted/30">
                    {row.rowNumber}
                  </td>
                  <td className="border border-border/30 px-3 py-2 text-sm">{row.city}</td>
                  <td className="border border-border/30 px-3 py-2 text-sm">{row.storeName}</td>
                  <td className="border border-border/30 px-3 py-2 font-mono text-xs">{row.iccid ?? '--'}</td>
                  <td className="border border-border/30 px-3 py-2">
                    <Badge className={cn('text-xs', saleTypeColor(row.saleType))}>
                      {row.saleType}
                    </Badge>
                  </td>
                  <td className="border border-border/30 px-3 py-2 text-sm">{row.promoter}</td>
                  <td className="border border-border/30 px-3 py-2 text-sm">{row.date}</td>
                  <td className="border border-border/30 px-3 py-2 text-right font-mono text-sm">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td colSpan={7} className="border border-border/30 px-3 py-3 text-right text-sm uppercase">
                  {t('playtelecom:reporte.total', { defaultValue: 'Total' })}
                </td>
                <td className="border border-border/30 px-3 py-3 text-right font-mono text-lg text-green-400">
                  {formatCurrency(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ReportePage
