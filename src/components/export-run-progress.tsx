import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useExportRun } from '@/hooks/use-export-run'
import { abrirDescarga, exportRunsService } from '@/services/exportRuns.service'

interface Props {
  venueId: string
  runId: string
  /** La página del enlace del correo / campanita: al quedar listo, descarga sola UNA vez. */
  autoDescargar?: boolean
  /** Tras «Intentar otra vez», el pedido nuevo (el diálogo cambia su runId; la página navega). */
  onNuevoPedido?: (runId: string) => void
}

export function ExportRunProgress({ venueId, runId, autoDescargar = false, onNuevoPedido }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const run = useExportRun(venueId, runId)
  const yaDescargo = useRef(false)
  const [reintentando, setReintentando] = useState(false)

  const { refetch } = run
  const descargar = useCallback(async () => {
    try {
      const { url } = await exportRunsService.urlDescarga(venueId, runId)
      abrirDescarga(url)
    } catch (err) {
      const vencido = (err as { response?: { status?: number } })?.response?.status === 410
      toast({ title: t(vencido ? 'exportDialog.run.expired' : 'exportDialog.errors.generic'), variant: 'destructive' })
      if (vencido) void refetch() // el servidor ya lo contesta EXPIRED: aparece «Volver a exportar»
    }
  }, [venueId, runId, t, toast, refetch])

  useEffect(() => {
    if (autoDescargar && run.isDone && !yaDescargo.current) {
      yaDescargo.current = true
      void descargar()
    }
  }, [autoDescargar, run.isDone, descargar])

  const reintentar = async () => {
    setReintentando(true)
    try {
      const { runId: nuevo } = await exportRunsService.reintentar(venueId, runId)
      onNuevoPedido?.(nuevo)
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast({ title: message ?? t('exportDialog.errors.generic'), variant: 'destructive' })
    } finally {
      setReintentando(false)
    }
  }

  if (run.notFound || run.loadError) {
    return (
      <div className="rounded-xl border border-input p-4" aria-live="polite">
        <p className="text-sm text-destructive">{t(run.notFound ? 'exportDialog.run.notFound' : 'exportDialog.run.loadError')}</p>
      </div>
    )
  }

  const texto = run.isDone
    ? t('exportDialog.run.ready')
    : run.status === 'QUEUED' || !run.status
      ? t('exportDialog.run.queued')
      : run.waitingForPayments
        ? t('exportDialog.run.waitingForPayments')
        : t('exportDialog.run.building', { done: run.processedRows.toLocaleString(), total: run.totalRows.toLocaleString() })

  return (
    <div className="space-y-3 rounded-xl border border-input p-4" aria-live="polite" data-tour="export-run-progress">
      {run.isFailed ? (
        <>
          <p className="text-sm text-destructive">{t(run.status === 'EXPIRED' ? 'exportDialog.run.expired' : 'exportDialog.run.failed')}</p>
          <Button variant="outline" onClick={reintentar} disabled={reintentando} data-tour="export-run-retry">
            {t(run.status === 'EXPIRED' ? 'exportDialog.run.reexport' : 'exportDialog.run.retry')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">{texto}</p>
          <Progress value={run.percent} aria-label={t('exportDialog.run.progressLabel')} />
          {run.changedToFormat === 'csv' && <p className="text-xs text-muted-foreground">{t('exportDialog.run.changedToCsv')}</p>}
          {!run.isDone && <p className="text-xs text-muted-foreground">{t('exportDialog.run.canClose')}</p>}
          {run.isDone && autoDescargar && <p className="text-xs text-muted-foreground">{t('exportDialog.run.downloading')}</p>}
          {run.isDone && (
            <Button onClick={() => void descargar()} data-tour="export-run-download">
              {t('exportDialog.run.download')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
