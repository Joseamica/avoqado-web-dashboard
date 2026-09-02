import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { exportSheetsToExcel } from '@/utils/export'
import {
  getAllOrgStockItemsForExport,
  type InventoryByResponsible,
  type OrgStockOverviewItem,
  type OrgStockOverviewParams,
  type ResponsibleCounts,
} from '@/services/stockDashboard.service'

/**
 * Exporta la tabla por responsable a un Excel de DOS hojas, como lo pidió Isaac
 * Mayoral (25-ago-2026):
 *
 *  1. el dashboard tal cual, con su jerarquía;
 *  2. los ICCID que cada promotor trae EN MANO HOY — la hoja que el supervisor
 *     imprime y se lleva a la tienda para contar.
 *
 * La hoja 2 se arma con los mismos filtros que la tabla y con el mismo criterio
 * de "en mano" (custodia del promotor). Si las dos hojas usaran criterios
 * distintos, el supervisor contaría contra una lista que no cuadra con el total
 * que ve en pantalla — que es exactamente el problema que este tablero resuelve.
 *
 * 🔴 Textos en español fijo, NO con `t()`, por decisión del founder (2026-08-25):
 * el resto de esta pantalla está hardcodeado en español y traducir sólo esta
 * parte dejaba la pantalla bilingüe. Ver el comentario largo en
 * `InventoryByResponsibleTable.tsx`.
 */

interface Props {
  data?: InventoryByResponsible
  orgId: string
  params: OrgStockOverviewParams
  /** Optional compatibility input; new callers load exact rows only on click. */
  items?: OrgStockOverviewItem[]
  receivingVenueId: string | null
  categoryId: string | null
  disabled?: boolean
}

const COL_LABEL: Record<keyof ResponsibleCounts, string> = {
  assigned: 'Asignados',
  receptionApproved: 'Recepción aprobada',
  saleApproved: 'Venta aprobada',
  saleInAdminReview: 'Venta en revisión de Admin',
  saleInPromoterReview: 'Venta en revisión por promotor',
  saleRejected: 'Venta rechazada',
  inHandToday: 'En mano HOY',
}

const COUNT_KEYS: Array<keyof ResponsibleCounts> = [
  'assigned',
  'receptionApproved',
  'saleApproved',
  'saleInAdminReview',
  'saleInPromoterReview',
  'saleRejected',
  'inHandToday',
]

export function ExportDashboardButton({ data, orgId, params, items, receivingVenueId, categoryId, disabled }: Props) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (!data) return
    setBusy(true)
    try {
      const cols = (c: ResponsibleCounts) => Object.fromEntries(COUNT_KEYS.map(k => [COL_LABEL[k], c[k]]))

      const row = (level: string, responsible: string, counts: ResponsibleCounts) => ({
        Nivel: level,
        Responsable: responsible,
        ...cols(counts),
      })

      const tableRows: Record<string, any>[] = [row('País', 'Total País', data.total)]
      for (const city of data.cities) {
        tableRows.push(row('Ciudad', city.city, city))
        for (const sup of city.supervisors) {
          tableRows.push(row('Supervisor', sup.supervisorName, sup))
          for (const p of sup.promoters) tableRows.push(row('Promotor', p.promoterName, p))
        }
      }
      if (data.unassigned.promoters.length > 0) {
        tableRows.push(row('Ciudad', data.unassigned.label, data.unassigned))
        for (const p of data.unassigned.promoters) tableRows.push(row('Promotor', p.promoterName, p))
      }

      // Mismos filtros que la tabla, y el mismo criterio de "en mano". Si la
      // pantalla ya no materializó todo el inventario (flujo nuevo), se recorren
      // páginas acotadas sólo después de este clic.
      const completeItems =
        items ??
        (await getAllOrgStockItemsForExport(orgId, {
          ...params,
          custodyState: 'PROMOTER_HELD',
          categoryId: categoryId ?? undefined,
          registeredFromVenueId: receivingVenueId ?? undefined,
        }))
      const inHand = completeItems.filter(
        i =>
          i.custodyState === 'PROMOTER_HELD' &&
          (!receivingVenueId || i.registeredFromVenueId === receivingVenueId) &&
          (!categoryId || i.categoryId === categoryId),
      )

      const iccidRows = inHand.map(i => ({
        'ID SIM (ICCID)': i.serialNumber,
        Promotor: i.assignedPromoterName ?? '—',
        Supervisor: i.assignedSupervisorName ?? '—',
        'Tipo de SIM': i.categoryName ?? '—',
        'Sucursal receptora': i.registeredFromVenueName ?? '—',
      }))

      const stamp = new Date().toISOString().split('T')[0]
      await exportSheetsToExcel(
        [
          { name: 'Dashboard', rows: tableRows },
          { name: 'ID SIMs en mano HOY', rows: iccidRows },
        ],
        `inventario-por-responsable-${stamp}.xlsx`,
        'Sin datos para los filtros seleccionados',
      )
    } catch (err) {
      toast({
        title: 'Exportar dashboard',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={disabled || busy || !data} className="cursor-pointer">
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Exportar dashboard
    </Button>
  )
}
