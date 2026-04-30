import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { OrgStockBulkGroup, OrgStockOverviewItem, OrgStockOverviewParams } from '@/services/stockDashboard.service'
import { exportToExcel } from '@/utils/export'

interface ExportButtonProps {
  orgId: string
  params: OrgStockOverviewParams
  items: OrgStockOverviewItem[]
  bulkGroups: OrgStockBulkGroup[]
}

const CUSTODY_LABELS: Record<
  NonNullable<OrgStockOverviewItem['custodyState']>,
  string
> = {
  ADMIN_HELD: 'En almacén',
  SUPERVISOR_HELD: 'Con Supervisor',
  PROMOTER_PENDING: 'Pendiente aceptar',
  PROMOTER_HELD: 'Con Promotor',
  PROMOTER_REJECTED: 'Rechazado',
  SOLD: 'Vendido',
}

// Org venues are all in Mexico for PlayTelecom; align with the codebase default
// in src/utils/datetime.ts. If multi-tz orgs appear later, accept timezone as prop.
const EXPORT_TZ = 'America/Mexico_City'

const toDateCell = (iso: string | null | undefined) => {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(EXPORT_TZ)
  return dt.isValid ? dt.toFormat('yyyy-LL-dd') : ''
}

const toTimeCell = (iso: string | null | undefined) => {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(EXPORT_TZ)
  return dt.isValid ? dt.toFormat('HH:mm:ss') : ''
}

const toCustodyCell = (state: OrgStockOverviewItem['custodyState']) => {
  if (!state) return CUSTODY_LABELS.ADMIN_HELD
  return CUSTODY_LABELS[state] ?? state
}

export function ExportButton({ orgId, params, items, bulkGroups }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    setLoading(true)
    try {
      if (!items.length) {
        toast({
          title: 'Sin datos para exportar',
          description: 'No hay SIMs en el rango seleccionado.',
          variant: 'destructive',
        })
        return
      }

      // A SIM is "carga masiva" only when its bulk group has more than one item.
      // Single-item groups represent individual scans, not bulk uploads.
      const bulkSerials = new Set<string>()
      for (const group of bulkGroups) {
        if (group.itemCount > 1) {
          for (const sn of group.serialNumbers) bulkSerials.add(sn)
        }
      }

      const rows = items.map((item, index) => ({
        '#': index + 1,
        ICCID: item.serialNumber,
        Categoría: item.categoryName,
        Estado: item.status,
        Custodia: toCustodyCell(item.custodyState),
        Supervisor: item.assignedSupervisorName ?? '',
        Promotor: item.assignedPromoterName ?? '',
        'Fecha Carga': toDateCell(item.createdAt),
        'Hora Carga': toTimeCell(item.createdAt),
        'Carga Masiva': bulkSerials.has(item.serialNumber) ? 'Sí' : 'No',
        'Sucursal Receptora': item.registeredFromVenueName ?? '',
        'Sucursal Actual': item.currentVenueName ?? '',
        'Sucursal Venta': item.sellingVenueName ?? '',
        'Fecha Venta': toDateCell(item.soldAt),
        'Hora Venta': toTimeCell(item.soldAt),
        'Registrado Por': item.createdByName ?? '',
      }))

      const from = params.dateFrom?.slice(0, 10)
      const to = params.dateTo?.slice(0, 10)
      const filename =
        from && to
          ? `control-stock-${orgId}-${from}-a-${to}`
          : `control-stock-${orgId}-${new Date().toISOString().slice(0, 10)}`

      await exportToExcel(rows, filename, 'Detalle SIMs')
      toast({ title: 'Excel descargado', description: `${filename}.xlsx` })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Error al generar Excel',
        description: 'Intenta de nuevo en unos momentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      {loading ? 'Generando...' : 'Exportar Excel'}
    </Button>
  )
}
