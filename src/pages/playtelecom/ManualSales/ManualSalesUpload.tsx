/**
 * ManualSalesUpload — "Subir ventas fuera de TPV" (PlayTelecom / Walmart).
 *
 * Upload page for the org-scoped manual-sales bulk import built in Tasks 5-9:
 * an operator drags in the "ventas fuera de TPV" Excel sheet, gets a dry-run
 * preview classified into crear ✅ / omitir ⏭️ / error ❌ (with a motivo per
 * skipped/failed row), then confirms to actually create the sales.
 *
 * Flow:
 *   1. <BulkUploadSection onUpload> → parseSalesFile(file) → previewManualSales(orgId, rows)
 *   2. Render the preview table (ICCID · Vendedor · Tienda · Fecha · Monto · Estado)
 *      bucketed by row index into crear/omitir/error, with counts per bucket.
 *   3. "Crear N ventas" (disabled when crear.length === 0) → applyManualSales(orgId, rows)
 *      → result summary (creadas / omitidas / errores).
 *   4. "Descargar template" → downloadTemplate().
 *
 * Gated by <PermissionGate permission="manual-sales:create"> (Task 1's permission).
 * orgId comes from useCurrentOrganization(), matching the sibling org-level pages
 * (OrgStockControlPage.tsx, OrgComisionesPage.tsx) — this page is meant to live
 * under an org-level PlayTelecom route (e.g. /organizations/:orgId/manual-sales).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Download, SkipForward, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { BulkUploadSection } from '@/pages/playtelecom/Stock/components/BulkUploadSection'
import {
  applyManualSales,
  downloadTemplate,
  parseSalesFile,
  previewManualSales,
  type BulkManualSalesResult,
  type ManualSaleRow,
  type RowResult,
} from '@/services/manualSale.service'

type RowBucket = 'crear' | 'omitir' | 'error'

const BUCKET_BADGE: Record<RowBucket, { className: string; icon: typeof CheckCircle2 }> = {
  crear: { className: 'bg-green-500/15 text-green-600 dark:text-green-400 border-transparent', icon: CheckCircle2 },
  omitir: { className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent', icon: SkipForward },
  error: { className: 'bg-destructive/15 text-destructive border-transparent', icon: XCircle },
}

/** Formats a row's `amount` for display — pass through the literal "No aplica" string as-is. */
function formatAmount(amount: ManualSaleRow['amount']): string {
  if (typeof amount === 'number') return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  return amount
}

interface PreviewRow {
  bucket: RowBucket
  row: ManualSaleRow
  motivo?: string
}

export default function ManualSalesUpload() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { orgId } = useCurrentOrganization()

  const [rows, setRows] = useState<ManualSaleRow[]>([])
  const [preview, setPreview] = useState<BulkManualSalesResult | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [result, setResult] = useState<BulkManualSalesResult | null>(null)

  const handleUpload = async (file: File) => {
    setResult(null)
    const parsedRows = await parseSalesFile(file)
    setRows(parsedRows)

    if (!orgId) {
      return {
        total: parsedRows.length,
        success: 0,
        errors: parsedRows.length,
        errorDetails: [{ row: 0, error: t('manualSales.noOrg', { defaultValue: 'No se encontró la organización actual' }) }],
      }
    }

    const previewResult = await previewManualSales(orgId, parsedRows)
    setPreview(previewResult)

    return {
      total: parsedRows.length,
      success: previewResult.crear.length,
      errors: previewResult.error.length,
    }
  }

  const handleDownloadTemplate = () => {
    void downloadTemplate()
  }

  const handleCreate = async () => {
    if (!orgId || !preview || preview.crear.length === 0) return

    setIsApplying(true)
    try {
      const applyResult = await applyManualSales(orgId, rows)
      setResult(applyResult)
    } finally {
      setIsApplying(false)
    }
  }

  // One display row per (index, bucket) in RowResult, joined back to the parsed
  // ManualSaleRow for the display columns (Vendedor/Fecha/Monto) that RowResult
  // itself doesn't carry. Memoized: this list feeds a table render.
  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!preview) return []

    const toPreviewRows = (bucket: RowBucket, results: RowResult[]): PreviewRow[] =>
      results
        .map((r): PreviewRow | null => {
          const row = rows[r.index]
          if (!row) return null
          return { bucket, row, motivo: r.motivo }
        })
        .filter((r): r is PreviewRow => r !== null)

    return [
      ...toPreviewRows('crear', preview.crear),
      ...toPreviewRows('omitir', preview.omitir),
      ...toPreviewRows('error', preview.error),
    ].sort((a, b) => rows.indexOf(a.row) - rows.indexOf(b.row))
  }, [preview, rows])

  const crearCount = preview?.crear.length ?? 0
  const omitirCount = preview?.omitir.length ?? 0
  const errorCount = preview?.error.length ?? 0

  return (
    <PermissionGate permission="manual-sales:create">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <PageTitleWithInfo
              title={t('manualSales.title', { defaultValue: 'Subir ventas fuera de TPV' })}
              className="text-xl font-bold tracking-tight"
              tooltip={t('manualSales.tooltip', {
                defaultValue:
                  'Carga el Excel de ventas de SIMs realizadas fuera del TPV (por ejemplo, capturadas manualmente por el promotor).',
              })}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {t('manualSales.subtitle', { defaultValue: 'Sube el archivo, revisa la vista previa y confirma para crear las ventas.' })}
            </p>
          </div>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            {t('manualSales.downloadTemplate', { defaultValue: 'Descargar template' })}
          </Button>
        </div>

        <BulkUploadSection onUpload={handleUpload} accept=".xlsx,.csv" />

        {preview && (
          <GlassCard className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{t('manualSales.previewTitle', { defaultValue: 'Vista previa' })}</h2>
              <Badge className={BUCKET_BADGE.crear.className}>
                {t('manualSales.crearCount', { defaultValue: `${crearCount} a crear`, count: crearCount })}
              </Badge>
              <Badge className={BUCKET_BADGE.omitir.className}>
                {t('manualSales.omitirCount', { defaultValue: `${omitirCount} a omitir`, count: omitirCount })}
              </Badge>
              <Badge className={BUCKET_BADGE.error.className}>
                {t('manualSales.errorCount', { defaultValue: `${errorCount} con error`, count: errorCount })}
              </Badge>
            </div>

            {previewRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('manualSales.noRows', { defaultValue: 'El archivo no contiene filas para procesar.' })}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase text-muted-foreground">
                    <tr className="border-b border-input">
                      <th className="py-2 pr-3 font-medium">ICCID</th>
                      <th className="py-2 pr-3 font-medium">{t('manualSales.vendedor', { defaultValue: 'Vendedor' })}</th>
                      <th className="py-2 pr-3 font-medium">{t('manualSales.tienda', { defaultValue: 'Tienda' })}</th>
                      <th className="py-2 pr-3 font-medium">{t('manualSales.fecha', { defaultValue: 'Fecha' })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t('manualSales.monto', { defaultValue: 'Monto' })}</th>
                      <th className="py-2 pr-3 font-medium">{t('manualSales.estado', { defaultValue: 'Estado' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(({ bucket, row, motivo }, idx) => {
                      const { className, icon: Icon } = BUCKET_BADGE[bucket]
                      return (
                        <tr key={`${row.iccid}-${idx}`} className="border-b border-input/50 align-top">
                          <td className="py-2 pr-3 font-mono text-xs">{row.iccid}</td>
                          <td className="py-2 pr-3">{row.promoterName || row.promoterCode || '—'}</td>
                          <td className="py-2 pr-3">{row.storeName}</td>
                          <td className="py-2 pr-3">{row.saleDate}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatAmount(row.amount)}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1.5">
                              <Badge className={`gap-1 ${className}`}>
                                <Icon className="h-3 w-3" />
                                {t(`manualSales.bucket.${bucket}`, {
                                  defaultValue: bucket === 'crear' ? 'Crear' : bucket === 'omitir' ? 'Omitir' : 'Error',
                                })}
                              </Badge>
                              {motivo && <span className="text-xs text-muted-foreground">{motivo}</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button disabled={crearCount === 0 || isApplying} onClick={handleCreate}>
                {t('manualSales.createButton', {
                  defaultValue: `Crear ${crearCount} venta${crearCount === 1 ? '' : 's'}`,
                  count: crearCount,
                })}
              </Button>
            </div>
          </GlassCard>
        )}

        {result && (
          <GlassCard className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t('manualSales.resultTitle', { defaultValue: 'Resultado' })}</h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-green-600 dark:text-green-400">
                {t('manualSales.createdSummary', {
                  defaultValue: `${result.created ?? 0} creada${(result.created ?? 0) === 1 ? '' : 's'}`,
                  count: result.created ?? 0,
                })}
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {t('manualSales.omittedSummary', {
                  defaultValue: `${result.omitir.length} omitida${result.omitir.length === 1 ? '' : 's'}`,
                  count: result.omitir.length,
                })}
              </span>
              <span className="text-destructive">
                {t('manualSales.erroredSummary', {
                  defaultValue: `${result.error.length} con error`,
                  count: result.error.length,
                })}
              </span>
            </div>
          </GlassCard>
        )}
      </div>
    </PermissionGate>
  )
}
