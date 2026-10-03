import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/utils/currency'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useClassPay, useStaffPayAccess } from '@/hooks/useStaffPay'
import { AjustePagoClaseModal, type ModoAjuste } from './AjustePagoClaseModal'

/** Excepciones cuya salida está en la tabla de pagos (nivel, tabla o celda). */
/** Modos de conteo con etiqueta; uno desconocido no se pinta. */
const MODOS_DE_CONTEO = new Set(['BOOKED', 'ATTENDED'])

const SALIDA_EN_LA_TABLA = new Set(['COACH_SIN_NIVEL', 'SIN_TABLA', 'SIN_MONTO_PARA_ESE_CONTEO'])

/**
 * Tarjeta «Pago a la coach» dentro del detalle de la clase. Sólo lee de las rutas de pago: con el módulo apagado o sin
 * `staffpay:read` no se pinta ni se pide nada.
 */
export function PagoDeClaseCard({ sessionId, conSeparador = false }: { sessionId: string; conSeparador?: boolean }) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { fullBasePath } = useCurrentVenue()
  const puedeVer = can('staffpay:read')
  // Sin el permiso no se pregunta ni si el módulo está prendido: la API no le manda nada (spec §7.2).
  const { data: acceso } = useStaffPayAccess(puedeVer)
  const habilitado = puedeVer && !!acceso?.enabled
  const { data: p, isLoading, isError } = useClassPay(sessionId, habilitado)
  const [modo, setModo] = useState<ModoAjuste | null>(null)

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
  const conteoCorregido = p.ajuste?.payCountOverride != null && p.conteoCalculado != null && p.ajuste.payCountOverride !== p.conteoCalculado

  return (
    <>
      {sep}
      <div className="rounded-lg border border-input p-3 space-y-2" data-tour="class-pay-card">
        <p className="text-sm font-semibold">{t('classCard.title')}</p>
        {p.estado === 'NO_TERMINADA' && <p className="text-sm text-muted-foreground">{t('classCard.notFinished')}</p>}
        {p.estado === 'CANCELADA' && <p className="text-sm text-muted-foreground">{t('classCard.cancelled')}</p>}
        {p.estado === 'EXCLUIDA' && (
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
                <span>{t('classCard.seats', { count: p.conteo, max: p.maxCount ?? '—' })}</span>
                {p.countMode && MODOS_DE_CONTEO.has(p.countMode) && <span> · {t(`classCard.mode.${p.countMode}`)}</span>}
              </p>
            )}
            {conteoCorregido && <p className="text-xs text-muted-foreground">{t('classCard.calculated', { count: p.conteoCalculado })}</p>}
            {p.estado === 'OK' ? (
              <p className="text-2xl font-bold">{Currency(Number(p.monto))}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-amber-700 dark:text-amber-400">{t(`reasons.${p.motivo}`)}</p>
                {p.motivo === 'SIN_COACH' && <p className="text-xs text-muted-foreground">{t('classCard.exitNoCoach')}</p>}
                {p.motivo && SALIDA_EN_LA_TABLA.has(p.motivo) && (
                  <Link to={`${fullBasePath}/servicio-pago#tabla`} className="text-xs font-medium underline underline-offset-2">
                    {t('classCard.exitGoToTable')}
                  </Link>
                )}
              </div>
            )}
          </>
        )}
        {p.ajuste && p.estado !== 'EXCLUIDA' && (
          <p className="text-xs text-muted-foreground">{t('classCard.adjusted', { reason: p.ajuste.reason ?? '' })}</p>
        )}
        {puedeAjustar && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setModo('conteo')}>
              {t('classCard.fixCount')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setModo('monto')}>
              {t('classCard.fixAmount')}
            </Button>
            {p.estado !== 'EXCLUIDA' && (
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setModo('excluir')}>
                {t('classCard.exclude')}
              </Button>
            )}
          </div>
        )}
        {modo && <AjustePagoClaseModal sessionId={sessionId} actual={p} modo={modo} onClose={() => setModo(null)} />}
      </div>
    </>
  )
}
