import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { exportSheetsToExcel } from '@/utils/export'
import type { InventoryByResponsible, OrgStockOverviewItem, ResponsibleCounts } from '@/services/stockDashboard.service'

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
 */

interface Props {
  data?: InventoryByResponsible
  /** Inventario completo del rango, para poder listar los ICCID. */
  items?: OrgStockOverviewItem[]
  receivingVenueId: string | null
  categoryId: string | null
  disabled?: boolean
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

export function ExportDashboardButton({ data, items, receivingVenueId, categoryId, disabled }: Props) {
  const { t } = useTranslation('playtelecom')
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const base = 'stock.byResponsible'
  const e = `${base}.export`

  async function handleExport() {
    if (!data) return
    setBusy(true)
    try {
      const cols = (c: ResponsibleCounts) => Object.fromEntries(COUNT_KEYS.map(k => [t(`${base}.columns.${k}`), c[k]]))

      const row = (level: string, responsible: string, counts: ResponsibleCounts) => ({
        [t(`${e}.level`)]: level,
        [t(`${e}.responsible`)]: responsible,
        ...cols(counts),
      })

      const tableRows: Record<string, any>[] = [row(t(`${e}.levelCountry`), t(`${base}.totalCountry`), data.total)]
      for (const city of data.cities) {
        tableRows.push(row(t(`${e}.levelCity`), city.city, city))
        for (const sup of city.supervisors) {
          tableRows.push(row(t(`${e}.levelSupervisor`), sup.supervisorName, sup))
          for (const p of sup.promoters) tableRows.push(row(t(`${e}.levelPromoter`), p.promoterName, p))
        }
      }
      if (data.unassigned.promoters.length > 0) {
        tableRows.push(row(t(`${e}.levelCity`), data.unassigned.label, data.unassigned))
        for (const p of data.unassigned.promoters) tableRows.push(row(t(`${e}.levelPromoter`), p.promoterName, p))
      }

      // Mismos filtros que la tabla, y el mismo criterio de "en mano".
      const inHand = (items ?? []).filter(
        i =>
          i.custodyState === 'PROMOTER_HELD' &&
          (!receivingVenueId || i.registeredFromVenueId === receivingVenueId) &&
          (!categoryId || i.categoryId === categoryId),
      )

      const iccidRows = inHand.map(i => ({
        [t(`${e}.iccid`)]: i.serialNumber,
        [t(`${e}.promoter`)]: i.assignedPromoterName ?? '—',
        [t(`${e}.supervisor`)]: i.assignedSupervisorName ?? '—',
        [t(`${e}.type`)]: i.categoryName ?? '—',
        [t(`${e}.receivingVenue`)]: i.registeredFromVenueName ?? '—',
      }))

      const stamp = new Date().toISOString().split('T')[0]
      await exportSheetsToExcel(
        [
          { name: t(`${e}.sheetTable`), rows: tableRows },
          { name: t(`${e}.sheetIccids`), rows: iccidRows },
        ],
        `inventario-por-responsable-${stamp}.xlsx`,
        t(`${e}.empty`),
      )
    } catch (err) {
      toast({
        title: t(`${e}.button`),
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
      {t(`${e}.button`)}
    </Button>
  )
}
