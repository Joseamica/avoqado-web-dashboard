import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PreviewCierreDto, SedeDelCierreDto } from '@/types/staffPay'
import { monto } from '../conSigno'
import { cuentaVacia, textoDeCuenta } from '../cuenta'
import { INSIGNIA_SEDE } from '../insigniaSede'
import { hayPendientes, lineaDePendiente } from '../pendientes'
import { useNombrePeriodo } from '../useNombrePeriodo'

const AVISO = 'flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-card p-6 text-sm'
const ICONO_AVISO = 'mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400'

/**
 * Pantalla 3 del founder (diseño r3.7(3)): por sede, qué entra en el cierre y qué no entra, con montos netos y en el orden
 * del server. Lo que no entra se dice «no entra en este cierre», nunca «de este periodo»: puede traer sobrantes de periodos
 * cerrados antes (ruling de B12). Con una sola sede activa y nada fuera no se pinta: repetiría el resumen de arriba.
 */
export function CierrePorSede({ porSede }: { porSede?: SedeDelCierreDto[] }) {
  const { t, i18n } = useTranslation('staffPay')
  const idTitulo = useId()
  if (!porSede?.length) return null
  const nadaQueDecir = porSede.length === 1 && porSede[0].estado === 'ACTIVA' && cuentaVacia(porSede[0].fuera)
  if (nadaQueDecir) return null
  const cuenta = (c: SedeDelCierreDto['entra']) => textoDeCuenta(t, c, i18n?.language)

  return (
    <section
      aria-labelledby={idTitulo}
      className="space-y-2 rounded-2xl border border-border/50 bg-card p-6"
      data-tour="staffpay-close-by-sede"
    >
      <h3 id={idTitulo} className="text-sm font-medium">
        {t('close.bySede.title')}
      </h3>
      <ul className="divide-y divide-border">
        {porSede.map(s => (
          <li key={s.venueId} data-estado={s.estado} className="space-y-1 py-3 first:pt-1 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm font-medium">{s.nombre}</p>
              <Badge variant="outline" className={INSIGNIA_SEDE[s.estado]}>
                {t(`sedes.estado.${s.estado}`)}
              </Badge>
            </div>
            <p className="text-sm">
              {cuentaVacia(s.entra) ? t('close.bySede.entraNada') : t('close.bySede.entra', { cuenta: cuenta(s.entra) })}
            </p>
            {!cuentaVacia(s.fuera) && (
              <p className={cn('text-sm', s.estado === 'ACTIVA' ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400')}>
                {t('close.bySede.fuera', { cuenta: cuenta(s.fuera) })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Lo que el cierre avisa sin bloquear: propinas sin persona (spec §6.3), cobros o devoluciones con la comisión por revisar
 * (resolución 16) y las devoluciones que este cierre NO descuenta, por destino (B12, r6.2; mismas frases que el recibo).
 */
export function AvisosDelCierre({ p }: { p: PreviewCierreDto }) {
  const { t } = useTranslation('staffPay')
  const nombrePeriodo = useNombrePeriodo()
  const idTitulo = useId()
  const sinDueno = p.propinasSinDueno
  const porRevisar = p.comisionesPorRevisar ?? 0
  const pendientes = hayPendientes(p.pendientes) ? p.pendientes : null

  return (
    <>
      {sinDueno && sinDueno.n > 0 && (
        // No bloquea (spec §6.3): se corrige asignando quién atendió y entra en el cierre siguiente.
        <section role="note" className={AVISO} data-tour="staffpay-close-tips-no-owner">
          <AlertTriangle className={ICONO_AVISO} />
          <span>{t('close.tipsWithoutOwner', { count: sinDueno.n, total: monto(sinDueno.total) })}</span>
        </section>
      )}
      {porRevisar > 0 && (
        <section role="note" className={AVISO} data-tour="staffpay-close-commissions-review">
          <AlertTriangle className={ICONO_AVISO} />
          <span>{t('close.commissionsToReview', { count: porRevisar })}</span>
        </section>
      )}
      {pendientes && (
        <section
          aria-labelledby={idTitulo}
          className="space-y-2 rounded-2xl border border-border/50 bg-card p-6 text-sm"
          data-tour="staffpay-close-pending"
        >
          <h3 id={idTitulo} className="font-medium">
            {t('close.pendingTitle')}
          </h3>
          <p className="text-muted-foreground">{t('period.pendingHelp')}</p>
          <ul className="list-disc space-y-1 pl-5">
            {pendientes.porDestino.map(d => {
              const p0 = d.seDescuenta.tipo === 'AL_CERRAR' ? d.seDescuenta.periodo : d.seDescuenta.origen
              return <li key={`${d.seDescuenta.tipo}-${p0.start}`}>{lineaDePendiente(t, d, nombrePeriodo)}</li>
            })}
          </ul>
        </section>
      )}
    </>
  )
}
