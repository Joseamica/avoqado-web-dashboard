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
import { textoDelServidor } from '@/utils/apiError'
import type { Cfdi, ReplaceCfdiResponse } from '@/services/cfdi.service'

interface ReplaceCfdiDialogProps {
  /** Cuando trae valor, el diálogo se abre para ESTA factura. null = cerrado. */
  cfdi: Cfdi | null
  onOpenChange: (open: boolean) => void
}

const money = (cents: number | null | undefined) =>
  typeof cents === 'number' ? (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '—'

// Mismo formato que la lista de facturas («A-1»), para que el dueño reconozca la misma factura.
const folioDe = (serie?: string | null, folio?: string | null, uuid?: string | null) =>
  [serie, folio].filter(Boolean).join('-') || uuid || '—'

/**
 * C2 · ola final: qué pasó con la cancelación de la anterior. `cancelAviso`/`cancelConflicto` van primero: traen `cancelPendiente: true` y el
 * `cancelStatus` viejo sin haber pedido nada. `cancelIntentoNuevo: false` ⇒ esta petición no anotó ningún intento, así que un REJECTED (o
 * nada) es de antes: «no salió», nunca «el SAT no aceptó». Sin los campos nuevos (servidor viejo) se lee como antes.
 */
type Desenlace = 'terminada' | 'noSalio' | 'noPedida' | 'enDuda' | 'pedida' | 'rechazada' | 'sinConfirmar'
function desenlaceDe(r: ReplaceCfdiResponse): Desenlace {
  if (r.cancelAviso) return 'noSalio'
  if (r.cancelConflicto) return 'noPedida'
  if (!r.cancelPendiente) return 'terminada'
  if (r.enDuda) return 'enDuda'
  if (r.cancelStatus === 'REQUESTED') return 'pedida'
  if (r.cancelIntentoNuevo === false) return 'noSalio'
  if (r.cancelStatus === 'REJECTED') return 'rechazada'
  return 'sinConfirmar' // pendiente sin estado ni aviso: el PAC no contestó (`cfdiReplacement.service.ts`, último `catch`)
}

const AMBAR = 'text-amber-700 dark:text-amber-400'
// Título del modo «terminar» (N-1 y m1): sólo «terminada» lleva palomita verde; lo que deja la anterior vigente, reloj ámbar; el rechazo, la X.
const TITULO_TERMINAR = {
  terminada: { clave: 'replaceDialog.finishDoneTitle', Icono: CheckCircle2, color: 'text-emerald-600' },
  noSalio: { clave: 'replaceDialog.finishNotSentTitle', Icono: Clock, color: 'text-amber-600' },
  noPedida: { clave: 'replaceDialog.finishNotSentTitle', Icono: Clock, color: 'text-amber-600' },
  enDuda: { clave: 'replaceDialog.finishUnconfirmedTitle', Icono: Clock, color: 'text-amber-600' },
  sinConfirmar: { clave: 'replaceDialog.finishUnconfirmedTitle', Icono: Clock, color: 'text-amber-600' },
  pedida: { clave: 'replaceDialog.finishRequestedTitle', Icono: Clock, color: 'text-amber-600' },
  rechazada: { clave: 'replaceDialog.finishRejectedTitle', Icono: XCircle, color: 'text-destructive' },
} as const
// Cuerpo (los dos modos): lo que pasó con la anterior. «en duda» y «sin confirmar» nunca dicen «en trámite».
const CUERPO = {
  terminada: { clave: 'replaceDialog.cancelledOk', Icono: CheckCircle2, clase: 'text-emerald-700 dark:text-emerald-400' },
  noSalio: { clave: 'replaceDialog.cancelNotSent', Icono: Clock, clase: AMBAR },
  noPedida: { clave: 'replaceDialog.cancelNotRequested', Icono: Clock, clase: AMBAR },
  enDuda: { clave: 'replaceDialog.cancelInDoubt', Icono: Clock, clase: AMBAR },
  sinConfirmar: { clave: 'replaceDialog.cancelUnconfirmed', Icono: Clock, clase: AMBAR },
  pedida: { clave: 'replaceDialog.cancelPending', Icono: Clock, clase: AMBAR },
  rechazada: { clave: 'replaceDialog.cancelRejected', Icono: XCircle, clase: 'text-destructive' },
} as const

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
  // Micro-ronda final: la corregida quedó EN DUDA (502 con `timbreEnDuda`): no se ofrece emitirla otra vez.
  const [corregidaEnDuda, setCorregidaEnDuda] = useState(false)

  useEffect(() => {
    if (cfdi) {
      setResultado(null)
      setMotivos(null)
      setErrorTexto(null)
      setCorregidaEnDuda(false)
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
          // Micro-ronda final: la corregida quedó EN DUDA (el PAC no contestó claro): no es un rechazo y no se vuelve a emitir.
          else if (err?.response?.status === 502 && err.response.data?.timbreEnDuda) {
            setErrorTexto(t('replaceDialog.stampInDoubt'))
            setCorregidaEnDuda(true)
          }
          // Un 502 sin `timbreEnDuda` es un rechazo del PAC (el cuerpo no trae texto). Lo demás: el texto de NUESTRO servidor o el genérico
          // del diálogo — nunca el de axios («Request failed with status code …»).
          else if (err?.response?.status === 502) setErrorTexto(t('replaceDialog.stampRejected'))
          else setErrorTexto(textoDelServidor(err) ?? t('replaceDialog.genericError'))
        },
      },
    )
  }

  const cerrar = () => onOpenChange(false)
  // C2 · T10 ronda 1 (I-2): «Terminar la sustitución». La corregida ya está TIMBRADA y falta la cancelación de ésta: el servidor sólo la
  // reanuda (no timbra otra factura), así que el diálogo no promete un timbre nuevo.
  const yaTimbrada = cfdi?.replacedBy?.find(r => r.status === 'STAMPED') ?? null
  // C2 · ola final (N-1, m1 y ronda 3): al terminar no se timbró nada, así que el resultado no dice «emitida» ni «nueva», y título, ícono y
  // cuerpo dicen lo que pasó con la cancelación (`desenlaceDe`).
  const desenlace = resultado ? desenlaceDe(resultado) : null
  const tituloTerminar = yaTimbrada && desenlace ? TITULO_TERMINAR[desenlace] : null
  const cuerpo = desenlace ? CUERPO[desenlace] : null
  const detalleDelServidor = resultado?.cancelAviso ?? resultado?.cancelConflicto

  return (
    <AlertDialog open={!!cfdi} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {!resultado && !motivos ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{yaTimbrada ? t('replaceDialog.finishTitle') : t('replaceDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {yaTimbrada
                  ? t('replaceDialog.finishDescription', { folio: folioDe(yaTimbrada.serie, yaTimbrada.folio, yaTimbrada.uuid) })
                  : t('replaceDialog.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('replaceDialog.current')}</p>
                <p className="font-medium">
                  {folioDe(cfdi?.serie, cfdi?.folio, cfdi?.uuid)} · {money(cfdi?.totalCents)}
                </p>
                <p className="text-xs text-muted-foreground">{cfdi?.receptorNombre}</p>
              </div>

              {!yaTimbrada && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {t('replaceDialog.warningTitle')}
                  </p>
                  <p className="text-muted-foreground">{t('replaceDialog.step1')}</p>
                  <p className="text-muted-foreground">{t('replaceDialog.step2')}</p>
                  <p className="text-muted-foreground">{t('replaceDialog.step3')}</p>
                </div>
              )}

              {errorTexto && <p className="text-sm text-destructive">{errorTexto}</p>}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={replaceMutation.isPending}>{t('replaceDialog.cancel')}</AlertDialogCancel>
              <Button onClick={handleConfirm} disabled={replaceMutation.isPending || corregidaEnDuda}>
                {replaceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {yaTimbrada ? t('replaceDialog.finishConfirm') : t('replaceDialog.confirm')}
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
                {tituloTerminar ? (
                  <tituloTerminar.Icono className={`h-5 w-5 ${tituloTerminar.color}`} />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                {t(tituloTerminar ? tituloTerminar.clave : 'replaceDialog.doneTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {yaTimbrada ? t('replaceDialog.correctedInvoice') : t('replaceDialog.newInvoice')}:{' '}
                <span className="font-medium text-foreground">
                  {folioDe(resultado!.sustituta?.serie, resultado!.sustituta?.folio, resultado!.sustituta?.uuid)} ·{' '}
                  {money(resultado!.sustituta?.totalCents)}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 py-2 text-sm">
              {/* C2 · T10 (R5 de la T2) y ola final: si no salió o no se pudo pedir, se dice con el porqué del servidor, nunca «el SAT no aceptó». */}
              {cuerpo && (
                <div className={`flex items-start gap-2 ${cuerpo.clase}`}>
                  <cuerpo.Icono className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p>{t(cuerpo.clave)}</p>
                    {detalleDelServidor && <p className="text-muted-foreground">{detalleDelServidor}</p>}
                  </div>
                </div>
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
