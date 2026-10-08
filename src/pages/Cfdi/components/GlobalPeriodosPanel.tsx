/**
 * C1 · Tarea 13 — los periodos RECIENTES de la factura global de un emisor (los que revisa el job), cada uno con su estado.
 *
 * - «Emitir» en un periodo sin timbrar o sin global: manda el `desde` de ESE periodo tal cual al disparo (Tarea 8).
 * - «Emitir complementaria» en uno timbrado o cancelado con ventas pendientes: por el id de la principal (Codex C1-25).
 * - Sin «periodos anteriores» (C1-P16 = B): un periodo más viejo se pide a soporte.
 * - Una principal detenida (p. ej. rechazada por el SAT) muestra el motivo del servidor y «escríbenos a soporte»; no hay botón de
 *   reintento propio (decisión pendiente del founder, I1 de la T7): «Emitir» manda el mismo disparo y el servidor decide.
 * - Ola final («apagado se VE y se EXPLICA»): con `globalApagada` (el servidor dice que Avoqado no emite la global de este RFC) el panel
 *   dice eso, cuándo dejarla así y cómo prenderla, en lugar de periodos, «Emitir» y «Ver cuáles» (que enseñaría miles de ventas «fuera»).
 *   Sin el campo (servidor anterior), como siempre.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ListChecks, Loader2, PowerOff, RefreshCw } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useGlobalPeriodos, useTriggerGlobalCfdi } from '@/hooks/use-cfdi'
import type { Emisor, EstadoDelPeriodo, PeriodoDeLaGlobal } from '@/services/cfdi.service'
import { GlobalComplementariaDialog } from './GlobalComplementariaDialog'
import { GlobalExcluidasDialog } from './GlobalExcluidasDialog'
import { GlobalOtrasPeriodicidades } from './GlobalOtrasPeriodicidades'
import { botonDeComplementaria, rangoFiscal, useAvisoDeLaGlobal } from './facturaGlobalUi'

const ETIQUETA: Record<EstadoDelPeriodo, string> = {
  TIMBRADA: 'stamped',
  SIN_TIMBRAR: 'pending',
  SIN_GLOBAL: 'missing',
  CANCELADA: 'cancelled',
}
const VARIANTE: Record<EstadoDelPeriodo, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  TIMBRADA: 'default',
  SIN_TIMBRAR: 'destructive',
  SIN_GLOBAL: 'outline',
  CANCELADA: 'secondary',
}
const ESTADO_DE_COMPLEMENTARIA: Record<string, string> = { TIMBRADA: 'stamped', CANCELADA: 'cancelled', SIN_TIMBRAR: 'pending' }

/** Qué listado abrir: el de una global que ya existe por su id (C1-32), o el de un periodo reciente por su inicio. */
type Excluidas = { principalId?: string; desde?: string }

export function GlobalPeriodosPanel({ emisor }: { emisor: Pick<Emisor, 'id' | 'csdStatus'> }) {
  const { t, i18n } = useTranslation('cfdi')
  const { avisarResultado, avisarError } = useAvisoDeLaGlobal()
  const csdActivo = emisor.csdStatus === 'ACTIVE'
  // M5 (ronda 1): con el CSD inactivo no se puede emitir nada; la nota de la tarjeta ya lo explica, así que ni se pide la consulta.
  const periodos = useGlobalPeriodos(emisor.id, { enabled: csdActivo })
  const apagada = periodos.data?.globalApagada === true
  const trigger = useTriggerGlobalCfdi()

  const [confirmar, setConfirmar] = useState<{ periodo: PeriodoDeLaGlobal; tarde: boolean } | null>(null)
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [complementariaDe, setComplementariaDe] = useState<string | null>(null)
  const [excluidas, setExcluidas] = useState<Excluidas | null>(null)

  // I3 (ronda 1): el periodo en la zona en la que el servidor lo corta (CDMX), nunca en la del negocio.
  const rango = (p: PeriodoDeLaGlobal) => rangoFiscal(p.desde, p.hasta, i18n.language)

  const emitir = ({ periodo, tarde }: { periodo: PeriodoDeLaGlobal; tarde: boolean }) => {
    setEmitiendo(periodo.desde)
    trigger.mutate(
      { emisorId: emisor.id, desde: periodo.desde },
      {
        onSuccess: result =>
          avisarResultado(result, {
            periodo: rango(periodo),
            nota: tarde ? t('globalInvoice.periods.issueLate') : undefined,
            onVerExcluidas: () =>
              setExcluidas(
                'cfdi' in result && result.cfdi ? { principalId: result.complementariaDe ?? result.cfdi.id } : { desde: periodo.desde },
              ),
          }),
        // M8: un 422 trae los conteos: «Ver cuáles» con el periodo que se pidió.
        onError: err => avisarError(err, { onVerExcluidas: () => setExcluidas({ desde: periodo.desde }) }),
        onSettled: () => {
          setEmitiendo(null)
          setConfirmar(null)
        },
      },
    )
  }

  if (!csdActivo) return null

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t('globalInvoice.periods.title')}</p>
        {/* N2 (re-revisión): la consulta ya no se reintenta sola ante un corte del proxy; «Actualizar» la pide una persona. */}
        <Button variant="ghost" size="sm" disabled={periodos.isFetching} onClick={() => periodos.refetch()}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${periodos.isFetching ? 'animate-spin' : ''}`} />
          {t('globalInvoice.periods.refresh')}
        </Button>
      </div>

      {periodos.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('globalInvoice.periods.loading')}
        </p>
      )}
      {periodos.isError && <p className="text-xs text-destructive">{t('globalInvoice.periods.loadError')}</p>}
      {apagada && (
        <div role="status" data-testid="global-apagada" className="space-y-1 rounded-lg border border-input bg-muted/40 p-3 text-xs">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <PowerOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            {t('globalInvoice.off.title')}
          </p>
          <p className="text-muted-foreground">{t('globalInvoice.off.description')}</p>
          <p className="text-muted-foreground">{t('globalInvoice.off.howToTurnOn')}</p>
        </div>
      )}
      {!apagada && periodos.data && periodos.data.periodos.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('globalInvoice.periods.empty')}</p>
      )}

      <ul className="space-y-2">
        {(apagada ? [] : (periodos.data?.periodos ?? [])).map((p, i) => {
          const sinTimbre = p.estado === 'SIN_TIMBRAR' || p.estado === 'SIN_GLOBAL'
          const conPrincipal = (p.estado === 'TIMBRADA' || p.estado === 'CANCELADA') && !!p.cfdiId
          const complementaria = conPrincipal ? botonDeComplementaria(t, p.corregidasPendientes) : null
          const ocupado = emitiendo === p.desde
          return (
            <li key={p.desde} data-testid={`periodo-${p.desde}`} className="space-y-2 rounded-lg border border-input p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rango(p)}</span>
                  <Badge variant={VARIANTE[p.estado]}>{t(`globalInvoice.periods.${ETIQUETA[p.estado]}`)}</Badge>
                  {p.folio && <span className="text-xs text-muted-foreground">{t('globalInvoice.periods.folio', { folio: p.folio })}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setExcluidas(p.cfdiId ? { principalId: p.cfdiId } : { desde: p.desde })}>
                    <ListChecks className="mr-1.5 h-4 w-4" />
                    {t('globalInvoice.excluded.see')}
                  </Button>
                  {sinTimbre && (
                    <Button variant="outline" size="sm" disabled={!!emitiendo} onClick={() => setConfirmar({ periodo: p, tarde: i > 0 })}>
                      {ocupado ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                      {t('globalInvoice.periods.issue')}
                    </Button>
                  )}
                  {complementaria && (
                    <Button variant="outline" size="sm" onClick={() => setComplementariaDe(p.cfdiId)}>
                      {complementaria.label}
                    </Button>
                  )}
                </div>
              </div>

              {/* I2 (ronda 1): el servidor manda `motivo` también en un SIN_GLOBAL que el job detuvo; un estado se VE y se EXPLICA. */}
              {(p.estado === 'SIN_TIMBRAR' || p.estado === 'SIN_GLOBAL') && p.motivo && (
                <div className="rounded-md bg-muted/40 p-2 text-xs">
                  <p>{p.motivo}</p>
                  <p className="mt-1 text-muted-foreground">{t('globalInvoice.periods.supportHint')}</p>
                </div>
              )}
              {complementaria?.ayuda && <p className="text-xs text-muted-foreground">{complementaria.ayuda}</p>}

              {p.complementarias.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <p>{t('globalInvoice.periods.complementaries')}:</p>
                  <ul className="ml-3 list-disc">
                    {p.complementarias.map(c => {
                      const estado = ESTADO_DE_COMPLEMENTARIA[c.estado]
                      return (
                        <li key={c.cfdiId}>
                          {`${c.folio ?? '—'} (${estado ? t(`globalInvoice.periods.${estado}`) : c.estado})`}
                          {/* T11 ronda 1 (m2): una complementaria sin timbrar dice por qué (p. ej. el rechazo del PAC). */}
                          {c.motivo && <span className="block text-foreground">{c.motivo}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* T10 ronda 1 (I1): las de una periodicidad anterior, APARTE y sin «Emitir». */}
      {!apagada && (
        <GlobalOtrasPeriodicidades
          otras={periodos.data?.otrasPeriodicidades}
          onVerExcluidas={principalId => setExcluidas({ principalId })}
        />
      )}

      {!apagada && <p className="text-xs text-muted-foreground">{t('globalInvoice.periods.olderAsk')}</p>}

      <AlertDialog open={!!confirmar} onOpenChange={o => !o && !trigger.isPending && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar ? t('globalInvoice.periods.confirmTitle', { period: rango(confirmar.periodo) }) : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('globalInvoice.periods.confirmDescription')}
              {confirmar?.tarde ? ` ${t('globalInvoice.periods.issueLate')}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trigger.isPending}>{t('globalInvoice.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={trigger.isPending}
              onClick={e => {
                // El diálogo sigue abierto mientras corre; se cierra al terminar.
                e.preventDefault()
                if (confirmar) emitir(confirmar)
              }}
            >
              {trigger.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('globalInvoice.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GlobalComplementariaDialog emisorId={emisor.id} principalId={complementariaDe} onOpenChange={o => !o && setComplementariaDe(null)} />
      <GlobalExcluidasDialog
        emisorId={emisor.id}
        principalId={excluidas?.principalId}
        desde={excluidas?.desde}
        open={!!excluidas}
        onOpenChange={o => !o && setExcluidas(null)}
        onEmitirComplementaria={id => {
          setExcluidas(null)
          setComplementariaDe(id)
        }}
      />
    </div>
  )
}
