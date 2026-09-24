import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useReplaceCfdi } from '@/hooks/use-cfdi'
import { apiErrorDescription } from '@/utils/apiError'
import type { Cfdi, ReplaceCfdiResponse } from '@/services/cfdi.service'

interface ReplaceCfdiDialogProps {
  /** Cuando trae valor, el diálogo se abre para ESTA factura. null = cerrado. */
  cfdi: Cfdi | null
  onOpenChange: (open: boolean) => void
}

const money = (cents: number | null | undefined) =>
  typeof cents === 'number' ? (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '—'

const folioDe = (serie?: string | null, folio?: string | null, uuid?: string | null) => `${serie ?? ''}${folio ?? ''}` || uuid || '—'

/**
 * Sustituir una factura con el importe equivocado.
 *
 * 🔴 Lo que NO puede hacer esta pantalla: dar por hecho que la factura vieja quedó cancelada. El SAT
 * puede dejar la cancelación en trámite (espera la aceptación del receptor) o rechazarla, y en los
 * dos casos la vieja SIGUE VIGENTE. Por eso el resultado se lee de `cancelPendiente`/`cancelStatus`
 * y se enseña con todas sus letras.
 */
export function ReplaceCfdiDialog({ cfdi, onOpenChange }: ReplaceCfdiDialogProps) {
  const { t } = useTranslation('cfdi')
  const replaceMutation = useReplaceCfdi()

  const [resultado, setResultado] = useState<ReplaceCfdiResponse | null>(null)
  const [motivos, setMotivos] = useState<string[] | null>(null)
  const [errorTexto, setErrorTexto] = useState<string | null>(null)

  useEffect(() => {
    if (cfdi) {
      setResultado(null)
      setMotivos(null)
      setErrorTexto(null)
    }
  }, [cfdi])

  const handleConfirm = () => {
    if (!cfdi) return
    replaceMutation.mutate(
      { cfdiId: cfdi.id },
      {
        onSuccess: res => setResultado(res),
        onError: (err: any) => {
          // 422 = no se timbró nada y el servidor explica por qué; el resto es un error normal.
          const reasons = err?.response?.data?.reasons
          if (Array.isArray(reasons) && reasons.length > 0) setMotivos(reasons)
          else setErrorTexto(apiErrorDescription(err))
        },
      },
    )
  }

  const cerrar = () => onOpenChange(false)

  return (
    <AlertDialog open={!!cfdi} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {!resultado && !motivos ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('replaceDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('replaceDialog.description')}</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('replaceDialog.current')}</p>
                <p className="font-medium">
                  {folioDe(cfdi?.serie, cfdi?.folio, cfdi?.uuid)} · {money(cfdi?.totalCents)}
                </p>
                <p className="text-xs text-muted-foreground">{cfdi?.receptorNombre}</p>
              </div>

              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t('replaceDialog.warningTitle')}
                </p>
                <p className="text-muted-foreground">{t('replaceDialog.step1')}</p>
                <p className="text-muted-foreground">{t('replaceDialog.step2')}</p>
                <p className="text-muted-foreground">{t('replaceDialog.step3')}</p>
              </div>

              {errorTexto && <p className="text-sm text-destructive">{errorTexto}</p>}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={replaceMutation.isPending}>{t('replaceDialog.cancel')}</AlertDialogCancel>
              <Button onClick={handleConfirm} disabled={replaceMutation.isPending}>
                {replaceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('replaceDialog.confirm')}
              </Button>
            </AlertDialogFooter>
          </>
        ) : motivos ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                {t('replaceDialog.rejectedTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>{t('replaceDialog.rejectedIntro')}</AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="list-disc space-y-1 py-2 pl-5 text-sm text-muted-foreground">
              {motivos.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            <AlertDialogFooter>
              <Button variant="outline" onClick={cerrar}>
                {t('replaceDialog.close')}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {t('replaceDialog.doneTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('replaceDialog.newInvoice')}:{' '}
                <span className="font-medium text-foreground">
                  {folioDe(resultado!.sustituta?.serie, resultado!.sustituta?.folio, resultado!.sustituta?.uuid)} ·{' '}
                  {money(resultado!.sustituta?.totalCents)}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-2 text-sm">
              {!resultado!.cancelPendiente ? (
                <p className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('replaceDialog.cancelledOk')}
                </p>
              ) : resultado!.cancelStatus === 'REJECTED' ? (
                <p className="flex items-start gap-2 text-destructive">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('replaceDialog.cancelRejected')}
                </p>
              ) : (
                <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('replaceDialog.cancelPending')}
                </p>
              )}
            </div>

            <AlertDialogFooter>
              <Button onClick={cerrar}>{t('replaceDialog.close')}</Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
