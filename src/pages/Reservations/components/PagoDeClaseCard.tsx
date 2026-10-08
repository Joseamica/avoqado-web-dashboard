import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { conSigno } from '@/pages/StaffPay/conSigno'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useClassDifference, useClassPay, useStaffPayAccess } from '@/hooks/useStaffPay'
import { LiquidarDialog, MotivoPorResolver } from '@/pages/StaffPay/components/LiquidarDialog'
import { porPersona, useCausaDiferencia } from '@/pages/StaffPay/diferencias'
import { ANCLA_FOCO, soltarFocoAlAbrir } from '@/pages/StaffPay/foco'
import { periodicidadDe, useNombrePeriodo } from '@/pages/StaffPay/useNombrePeriodo'
import { AjustePagoClaseModal, type ModoAjuste } from './AjustePagoClaseModal'

/** Excepciones cuya salida está en la tabla de pagos (nivel, tabla o celda). */
/** Modos de conteo con etiqueta; uno desconocido no se pinta. */
const MODOS_DE_CONTEO = new Set(['BOOKED', 'ATTENDED'])

const SALIDA_EN_LA_TABLA = new Set(['COACH_SIN_NIVEL', 'SIN_TABLA', 'SIN_MONTO_PARA_ESE_CONTEO'])

/**
 * Tarjeta «Pago a la coach» dentro del detalle de la clase. Sólo lee de las rutas de pago: sin el plan, sin activar pago
 * al personal o sin `staffpay:read` no se pinta ni se pide nada.
 */
export function PagoDeClaseCard({ sessionId, conSeparador = false }: { sessionId: string; conSeparador?: boolean }) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { venueId, fullBasePath } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()
  const puedeVer = can('staffpay:read')
  // Sin el permiso no se pregunta ni si el módulo está prendido: la API no le manda nada (spec §7.2).
  const { data: acceso } = useStaffPayAccess(puedeVer)
  // Decisión 9 del plan (fase 3): cuánto se le paga a alguien es dinero; sólo con el plan Y la activación.
  const habilitado = puedeVer && !!acceso?.enabled && !!acceso?.activado
  const { data: p, isLoading, isError } = useClassPay(sessionId, habilitado)
  // Bloque B: la diferencia pendiente sólo existe si la clase está en un cierre o llegó tarde a uno. Se pide bajo la sede
  // de la clase, que en el calendario es la del URL.
  const debeRevisar = !!p && (p.periodoOrigen?.estado === 'CLOSED' || !!p.llegoTarde)
  const dif = useClassDifference(venueId, sessionId, habilitado && debeRevisar)
  const nombrePeriodo = useNombrePeriodo()
  const causa = useCausaDiferencia()
  const [modo, setModo] = useState<ModoAjuste | null>(null)
  const [liquidando, setLiquidando] = useState(false)

  if (!habilitado) return null
  const sep = conSeparador ? <Separator /> : null
  if (isLoading)
    return (
      <>
        {sep}
        <Skeleton className="h-24 w-full" aria-busy="true" />
      </>
    )
  if (isError)
    return (
      <>
        {sep}
        <p className="text-sm text-muted-foreground" role="alert">
          {t('classCard.loadError')}
        </p>
      </>
    )
  if (!p) return null

  const valorable = p.estado === 'OK' || p.estado === 'EXCEPCION'
  // Una clase ya contabilizada (ancla) sólo se corrige con el permiso de cierre.
  const puedeAjustar = can('staffpay:manage') && (!p.anclada || can('staffpay:close')) && (valorable || p.estado === 'EXCLUIDA')
  // Clase contabilizada (spec §7.2): el periodo y las líneas vienen del server, ya sumadas; aquí no se calcula nada.
  const origen = p.periodoOrigen
  const lineas = p.lineas ?? []
  const excluidaSinLineas = !!origen && p.estado === 'EXCLUIDA' && lineas.length === 0
  const congelada = origen?.estado === 'CLOSED'
  const conteoCorregido = p.ajuste?.payCountOverride != null && p.conteoCalculado != null && p.ajuste.payCountOverride !== p.conteoCalculado
  const nombre = (x: { start: string; end: string }) => nombrePeriodo(x, periodicidadDe(x))
  const diferencia = debeRevisar ? dif.data : undefined
  // Por PERSONA, no el total: una sustitución de $480 por $480 suma cero y aun así a cada una le toca algo (Codex R1-19).
  // Primero quien tenía la clase al cerrar, luego por nombre (QA B-9).
  const pendientes =
    diferencia && !diferencia.bloqueada ? diferencia.filas.filter(f => f.pendiente !== null && Number(f.pendiente) !== 0).sort(porPersona) : []
  // Su fecha cae en un periodo CERRADO: el server no acepta niveles ni tablas con esa fecha, así que la tabla no la arregla
  // (Codex C3); la salida es «Ajustar monto» aquí mismo.
  const enPeriodoCerrado = congelada || !!p.llegoTarde
  // Abrir un modal encima del diálogo de la clase: el foco sale antes de que Radix oculte el diálogo (QA B-13).
  const abrir = (accion: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    soltarFocoAlAbrir(e.currentTarget)
    accion()
  }
  // Con ajuste, el MONTO pendiente (abajo) dice más que «la diferencia queda pendiente» (QA defecto 10b). Mientras llega no
  // se dice nada (si ya se liquidó sería falso); sólo si no se pudo calcular queda la frase genérica.
  const textoDiferencia = p.ajuste ? (dif.isError ? 'classCard.differencePending' : null) : 'classCard.fixAsDifference'

  return (
    <>
      {sep}
      <div className="rounded-lg border border-input p-3 space-y-2" data-tour="class-pay-card">
        {/* Ancla del foco: a donde vuelve al cerrar «Liquidar» cuando su botón ya no existe (se liquidó). */}
        <p className={`text-sm font-semibold ${ANCLA_FOCO}`} tabIndex={-1} data-staffpay-ancla>
          {t('classCard.title')}
        </p>
        {p.llegoTarde && (
          <p className="rounded-md bg-muted/40 p-2 text-xs">
            {diferencia?.periodoOrigen ? t('differences.lateClass', { periodo: nombre(diferencia.periodoOrigen) }) : t('differences.lateClassGeneric')}
          </p>
        )}
        {origen && (
          <div className="space-y-1 rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">
              {/* Un solo nombre para el periodo en toda la tarjeta: «agosto de 2026», como el botón de liquidar (QA B-8). */}
              {t(congelada ? 'classCard.origin' : 'classCard.originOpen', { periodo: nombre(origen) })}
            </p>
            {lineas.map((l, i) => (
              <p key={i} className="text-xs">
                <span>
                  {t(l.concepto === 'SERVICE' ? 'classCard.lineService' : 'classCard.lineReconcile', {
                    periodo: nombre(l.periodo),
                    persona: l.staffName,
                    monto: l.concepto === 'SERVICE' ? Currency(Number(l.monto)) : conSigno(l.monto),
                  })}
                </span>
                <span className="text-muted-foreground">
                  {' · '}
                  {l.pagadoEn ? t('classCard.linePaid', { fecha: formatDate(l.pagadoEn) }) : t('classCard.linePending')}
                </span>
              </p>
            ))}
            {excluidaSinLineas && <p className="text-xs">{t('classCard.notPaidExcluded', { reason: p.ajuste?.reason ?? '' })}</p>}
            {congelada && p.estado === 'OK' && lineas.length === 0 && <p className="text-xs">{t('classCard.noPayInClose')}</p>}
            {congelada && (
              <p className="text-xs text-muted-foreground">
                <span>{t('classCard.frozen')}</span>
                {puedeAjustar && textoDiferencia && <span> {t(textoDiferencia)}</span>}
              </p>
            )}
          </div>
        )}
        {/* Encabeza todo lo de hoy, en cualquier estado. Con «excluida sin líneas» lo de hoy ya se dijo arriba: no queda título huérfano. */}
        {origen && !excluidaSinLineas && <p className="text-xs text-muted-foreground">{t('classCard.today')}</p>}
        {p.estado === 'NO_TERMINADA' && <p className="text-sm text-muted-foreground">{t('classCard.notFinished')}</p>}
        {p.estado === 'CANCELADA' && <p className="text-sm text-muted-foreground">{t('classCard.cancelled')}</p>}
        {p.estado === 'EXCLUIDA' && !excluidaSinLineas && (
          <p className="text-sm text-muted-foreground">{t('classCard.excluded', { reason: p.ajuste?.reason ?? '' })}</p>
        )}
        {valorable && (
          <>
            <p className="text-sm">
              {p.staffName ?? '—'}
              {p.payLevelName ? ` · ${p.payLevelName}` : ''}
            </p>
            {p.conteo !== null && p.conteo !== undefined && (
              <p className="text-sm text-muted-foreground">
                {/* El techo NO es el cupo de la clase: sólo se menciona cuando se rebasa («11 · se paga como 10»). */}
                <span>{t('classCard.seats', { count: p.conteo })}</span>
                {p.maxCount != null && p.conteo > p.maxCount && <span> · {t('classCard.seatsOverCap', { max: p.maxCount })}</span>}
                {p.countMode && MODOS_DE_CONTEO.has(p.countMode) && <span> · {t(`classCard.mode.${p.countMode}`)}</span>}
              </p>
            )}
            {conteoCorregido && <p className="text-xs text-muted-foreground">{t('classCard.calculated', { count: p.conteoCalculado })}</p>}
            {p.estado === 'OK' ? (
              <p className="text-2xl font-bold">{Currency(Number(p.monto))}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-amber-700 dark:text-amber-400">{t(`reasons.${p.motivo}`)}</p>
                {/* Con la diferencia trabada, su bloque de abajo ya dice quién, cuándo y la salida: aquí sólo el motivo (un solo
                    bloque con la misma salida, no dos). */}
                {p.motivo === 'SIN_COACH' && !diferencia?.bloqueada && (
                  <p className="text-xs text-muted-foreground">{t('classCard.exitNoCoach')}</p>
                )}
                {p.motivo && SALIDA_EN_LA_TABLA.has(p.motivo) && enPeriodoCerrado && !diferencia?.bloqueada && (
                  <p className="text-xs text-muted-foreground">{t(puedeAjustar ? 'differences.exitClassHere' : 'differences.exitNoPermission')}</p>
                )}
                {p.motivo && SALIDA_EN_LA_TABLA.has(p.motivo) && !enPeriodoCerrado && (
                  <Link to={`${fullBasePath}/servicio-pago#tabla`} className="text-xs font-medium underline underline-offset-2">
                    {t('classCard.exitGoToTable')}
                  </Link>
                )}
              </div>
            )}
          </>
        )}
        {debeRevisar && dif.isError && (
          <p className="text-xs text-muted-foreground" role="alert">
            {t('differences.loadError')}
          </p>
        )}
        {diferencia?.bloqueada && venueId && (
          <div className="space-y-1 rounded-md border border-amber-500/40 p-2">
            <p className="text-xs">{t('differences.blockedCard')}</p>
            {/* Nombra a quién y desde cuándo («Carlos Rodríguez no tenía nivel el 15 jul 2026») y qué botón usar aquí. */}
            <MotivoPorResolver filas={diferencia.filas} classVenueId={venueId} sessionId={sessionId} enLaClase />
          </div>
        )}
        {diferencia && pendientes.length > 0 && (
          <div className="space-y-2 rounded-md border border-input p-2" data-tour="class-pay-difference">
            {pendientes.map(f => (
              <div key={f.persona}>
                <p className="text-sm font-medium">
                  {t('differences.pendingLine', { persona: f.personaNombre ?? t('period.noCoach'), monto: conSigno(f.pendiente!) })}
                </p>
                {causa(f) && <p className="text-xs text-muted-foreground">{causa(f)}</p>}
              </div>
            ))}
            {can('staffpay:close') ? (
              <Button type="button" size="sm" className="cursor-pointer" onClick={abrir(() => setLiquidando(true))} data-tour="class-pay-settle">
                {t('differences.settleIn', { periodo: nombre(diferencia.destino) })}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t('differences.noPermission')}</p>
            )}
          </div>
        )}
        {p.ajuste && p.estado !== 'EXCLUIDA' && (
          <p className="text-xs text-muted-foreground">{t('classCard.adjusted', { reason: p.ajuste.reason ?? '' })}</p>
        )}
        {puedeAjustar && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={abrir(() => setModo('conteo'))}>
              {t('classCard.fixCount')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={abrir(() => setModo('monto'))}>
              {t('classCard.fixAmount')}
            </Button>
            {p.estado !== 'EXCLUIDA' && (
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={abrir(() => setModo('excluir'))}>
                {t('classCard.exclude')}
              </Button>
            )}
          </div>
        )}
        {modo && <AjustePagoClaseModal sessionId={sessionId} actual={p} modo={modo} onClose={() => setModo(null)} />}
        {liquidando && venueId && <LiquidarDialog classVenueId={venueId} sessionId={sessionId} desde="clase" onClose={() => setLiquidando(false)} />}
      </div>
    </>
  )
}
