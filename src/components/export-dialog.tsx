import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { Download, FileText, FileSpreadsheet, FileType2, Loader2 } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DateRangePicker } from '@/components/date-range-picker'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export interface ExportColumnOption {
  /** Stable id sent to backend in the `columns` param. */
  id: string
  /** Display label for the user. */
  label: string
  /** Pre-selected by default. */
  defaultSelected?: boolean
  /** Cannot be unchecked (e.g. primary key, creation date). */
  required?: boolean
}

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** Page title (e.g. "Exportar pagos"). */
  title: string
  /** Endpoint that produces the file. Will be called as GET with query params. Should end without trailing slash. */
  endpoint: string
  /** Filters currently applied on the listing page — forwarded verbatim to the endpoint. The dialog overrides startDate/endDate from the date range picker. */
  baseParams: Record<string, string | number | undefined>
  /** Available columns the user can pick from. */
  columns: ExportColumnOption[]
  /** Initial date range (e.g. mirrors the listing filter). */
  initialDateFrom: Date
  initialDateTo: Date
  /** Optional estimated row count to surface in the footer ("≈ 1,234 resultados"). */
  estimatedCount?: number
  /** Filename stem ("payments", "orders"). The dialog appends date + extension. */
  filenameStem: string
  /** Filter chips to show the user which filters are currently inherited (read-only summary; user edits filters back in the page). */
  activeFilterSummary?: Array<{ label: string; value: string }>
}

/**
 * Stripe-style export dialog.
 *
 * Flow: user picks date range + columns + format → endpoint streams a file → blob downloaded with a sensible filename.
 *
 * Backend contract: the endpoint must accept `format`, `columns`, `startDate`, `endDate` + any baseParams as query strings,
 * and must respond with `Content-Disposition: attachment` for sync exports (<= 10k rows). For oversized exports it should
 * return 413 with `{ message: string }` so we can surface a "reduce el rango" hint.
 */
export function ExportDialog({
  open,
  onClose,
  title,
  endpoint,
  baseParams,
  columns,
  initialDateFrom,
  initialDateTo,
  estimatedCount,
  filenameStem,
  activeFilterSummary,
}: ExportDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: initialDateFrom, to: initialDateTo })
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(columns.filter(c => c.defaultSelected ?? true).map(c => c.id)),
  )
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [isExporting, setIsExporting] = useState(false)

  const requiredIds = useMemo(() => new Set(columns.filter(c => c.required).map(c => c.id)), [columns])

  const toggleColumn = (id: string) => {
    if (requiredIds.has(id)) return
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedColumns(new Set(columns.map(c => c.id)))
  const selectNone = () => setSelectedColumns(new Set(columns.filter(c => c.required).map(c => c.id)))

  // PDF is the heaviest format; we cap it harder server-side. Warn the user before they click.
  const showPdfWarning = format === 'pdf' && estimatedCount !== undefined && estimatedCount > 1000

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast({ title: t('exportDialog.errors.noColumns', { defaultValue: 'Selecciona al menos una columna' }), variant: 'destructive' })
      return
    }

    setIsExporting(true)
    try {
      const params: Record<string, string | number> = {
        ...Object.fromEntries(Object.entries(baseParams).filter(([, v]) => v !== undefined) as [string, string | number][]),
        format,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        columns: Array.from(selectedColumns).join(','),
      }

      const response = await api.get(endpoint, {
        params,
        responseType: 'blob',
      })

      // Build a filename: payments-2026-05-18.csv (or .xlsx / .pdf).
      const ext = format === 'xlsx' ? 'xlsx' : format
      const stamp = DateTime.now().toFormat('yyyy-LL-dd')
      const filename = `${filenameStem}-${stamp}.${ext}`

      // Trigger browser download from the Blob.
      const blob = response.data as Blob
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast({ title: t('exportDialog.success', { defaultValue: 'Exportación completada' }) })
      onClose()
    } catch (err: any) {
      // Axios + responseType:'blob' means the error body is a Blob — pull the message out.
      let message = t('exportDialog.errors.generic', { defaultValue: 'No se pudo generar el archivo' }) as string
      const status = err?.response?.status
      const data = err?.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          const parsed = JSON.parse(text)
          if (parsed?.message) message = parsed.message
        } catch {
          /* fall back to generic message */
        }
      } else if (data?.message) {
        message = data.message
      }
      if (status === 413) {
        toast({
          title: t('exportDialog.errors.tooLarge', { defaultValue: 'Demasiados resultados' }),
          description: message,
          variant: 'destructive',
        })
      } else {
        toast({ title: message, variant: 'destructive' })
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={title}
      contentClassName="bg-muted/30"
      actions={
        <Button
          onClick={handleExport}
          disabled={isExporting || selectedColumns.size === 0}
          className="gap-2"
          data-tour="export-dialog-submit"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('exportDialog.export', { defaultValue: 'Exportar' })}
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        {/* Section: Date range */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <header className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {t('exportDialog.sections.dateRange', { defaultValue: 'Rango de fechas' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('exportDialog.sections.dateRangeHint', { defaultValue: 'Define el periodo que quieres exportar' })}
              </p>
            </div>
          </header>
          <DateRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            onUpdate={({ range }) => {
              if (range.from && range.to) setDateRange({ from: range.from, to: range.to })
            }}
            align="start"
          />
        </section>

        {/* Section: Active filters summary (read-only — user edits in the page) */}
        {activeFilterSummary && activeFilterSummary.length > 0 && (
          <section className="rounded-2xl border border-input bg-card p-6">
            <header className="mb-4">
              <h3 className="text-base font-semibold">
                {t('exportDialog.sections.filters', { defaultValue: 'Filtros aplicados' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('exportDialog.sections.filtersHint', {
                  defaultValue: 'Cierra el diálogo para cambiar filtros en la página',
                })}
              </p>
            </header>
            <div className="flex flex-wrap gap-2">
              {activeFilterSummary.map((f, i) => (
                <span
                  key={`${f.label}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted/40 px-3 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">{f.label}:</span>
                  <span className="text-muted-foreground">{f.value}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Section: Columns */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">
                {t('exportDialog.sections.columns', { defaultValue: 'Columnas a incluir' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('exportDialog.sections.columnsHint', {
                  defaultValue: 'Elige qué información se exporta en cada fila',
                  selected: selectedColumns.size,
                  total: columns.length,
                })}{' '}
                ({selectedColumns.size} / {columns.length})
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} type="button">
                {t('exportDialog.selectAll', { defaultValue: 'Todas' })}
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} type="button">
                {t('exportDialog.selectNone', { defaultValue: 'Ninguna' })}
              </Button>
            </div>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {columns.map(col => {
              const isSelected = selectedColumns.has(col.id)
              const isRequired = requiredIds.has(col.id)
              return (
                <label
                  key={col.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    isSelected ? 'border-primary/40 bg-primary/5' : 'border-input bg-background hover:bg-muted/40'
                  } ${isRequired ? 'opacity-70' : ''}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleColumn(col.id)}
                    disabled={isRequired}
                  />
                  <span className="text-sm">{col.label}</span>
                  {isRequired && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t('exportDialog.required', { defaultValue: 'Obligatoria' })}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </section>

        {/* Section: Format */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <header className="mb-4">
            <h3 className="text-base font-semibold">
              {t('exportDialog.sections.format', { defaultValue: 'Formato' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('exportDialog.sections.formatHint', { defaultValue: 'Selecciona cómo quieres recibir el archivo' })}
            </p>
          </header>
          <RadioGroup value={format} onValueChange={v => setFormat(v as ExportFormat)} className="grid gap-3 sm:grid-cols-3">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                format === 'csv' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'
              }`}
            >
              <RadioGroupItem value="csv" id="fmt-csv" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="fmt-csv" className="cursor-pointer font-semibold">
                    CSV
                  </Label>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('exportDialog.formats.csvHint', { defaultValue: 'Ligero. Compatible con Excel, Google Sheets.' })}
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                format === 'xlsx' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'
              }`}
            >
              <RadioGroupItem value="xlsx" id="fmt-xlsx" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="fmt-xlsx" className="cursor-pointer font-semibold">
                    Excel
                  </Label>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('exportDialog.formats.xlsxHint', { defaultValue: 'Con formato, ideal para contabilidad.' })}
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                format === 'pdf' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'
              }`}
            >
              <RadioGroupItem value="pdf" id="fmt-pdf" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileType2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="fmt-pdf" className="cursor-pointer font-semibold">
                    PDF
                  </Label>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('exportDialog.formats.pdfHint', { defaultValue: 'Imprimible. Límite de 1,000 filas.' })}
                </p>
              </div>
            </label>
          </RadioGroup>
          {showPdfWarning && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              {t('exportDialog.warnings.pdfLarge', {
                defaultValue: 'PDF está limitado a 1,000 filas. Si tu rango supera ese límite, usa CSV o Excel.',
              })}
            </p>
          )}
        </section>

        {/* Footer hint */}
        {estimatedCount !== undefined && (
          <p className="text-center text-sm text-muted-foreground">
            {t('exportDialog.estimated', {
              count: estimatedCount,
              defaultValue: '≈ {{count}} resultados se incluirán en este archivo',
            })}
          </p>
        )}
      </div>
    </FullScreenModal>
  )
}
