import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { cn } from '@/lib/utils'
import { useStaffPayAccess, useStaffPayAssignments, useStaffPayLevels } from '@/hooks/useStaffPay'
import { AsignarNivelModal } from '@/pages/StaffPay/components/AsignarNivelModal'
import { hoyEnSede } from '@/pages/StaffPay/hoyEnSede'
import { useVenueDateTime } from '@/utils/datetime'

interface Props {
  staffId: string
  staffName: string
  className?: string
}

/**
 * «Nivel de pago» en el perfil del miembro. Elegir otro nivel NO escribe: abre la confirmación, que pide la fecha y
 * dice cuántas clases cambian antes de guardar (la misma que la pestaña de tabla).
 */
export function NivelDePagoSection({ staffId, staffName, className }: Props) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { venueTimezone, formatCalendarDate } = useVenueDateTime()
  const { data: acceso } = useStaffPayAccess(can('staffpay:read'))
  const on = !!acceso?.enabled
  const qNiveles = useStaffPayLevels(on)
  const qAsignaciones = useStaffPayAssignments(on)
  const [porAsignar, setPorAsignar] = useState<{ payLevelId: string; payLevelName: string } | null>(null)

  if (!on) return null

  const niveles = qNiveles.data ?? []
  const actual = (qAsignaciones.data ?? []).find(a => a.staffId === staffId)
  const activos = niveles.filter(n => !n.archivedAt)
  // Si su nivel vigente ya se archivó, sigue apareciendo para que el select no quede en blanco.
  const opciones =
    actual && !activos.some(n => n.id === actual.payLevelId)
      ? [...activos, { id: actual.payLevelId, name: actual.payLevelName, sortOrder: Number.MAX_SAFE_INTEGER, archivedAt: 'archivado' }]
      : activos
  // «Configurar pago al personal» aquí y en todas las sedes (E6a-fix3 C2): lo que exige el servidor para asignar nivel.
  const aqui = can('staffpay:manage')
  const falta = aqui && acceso?.puedeConfigurarOrganizacion === false
  const puedeCambiar = aqui && !falta

  const elegir = (payLevelId: string) => {
    if (!payLevelId || payLevelId === actual?.payLevelId) return
    const nivel = activos.find(n => n.id === payLevelId)
    if (nivel) setPorAsignar({ payLevelId: nivel.id, payLevelName: nivel.name })
  }

  return (
    <section className={cn('rounded-lg border border-input p-4 space-y-3', className)} data-tour="member-pay-level">
      <h3 className="font-semibold">{t('member.title')}</h3>
      {qNiveles.isLoading || qAsignaciones.isLoading ? (
        <Skeleton className="h-10 w-48" />
      ) : qNiveles.isError || qAsignaciones.isError ? (
        <p className="text-sm text-muted-foreground" role="alert">
          {t('member.loadError')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {aqui ? (
            <Select value={actual?.payLevelId ?? ''} onValueChange={elegir} disabled={activos.length === 0 || falta}>
              <SelectTrigger className="w-56 cursor-pointer" aria-label={t('member.title')}>
                <SelectValue placeholder={t('who.noLevel')} />
              </SelectTrigger>
              <SelectContent>
                {opciones.map(n => (
                  <SelectItem key={n.id} value={n.id} disabled={!!n.archivedAt}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm">{actual?.payLevelName ?? t('who.noLevel')}</span>
          )}
          {actual && (
            <span className="text-sm text-muted-foreground">
              {t('who.since')} {formatCalendarDate(actual.effectiveFrom.slice(0, 10))}
            </span>
          )}
          {puedeCambiar && activos.length === 0 && <p className="text-sm text-muted-foreground w-full">{t('who.needLevels')}</p>}
          {falta && <p className="text-xs text-muted-foreground w-full">{t('orgConfigPermission')}</p>}
        </div>
      )}

      {porAsignar && (
        <AsignarNivelModal
          open
          onOpenChange={o => {
            if (!o) setPorAsignar(null)
          }}
          staffId={staffId}
          staffName={staffName}
          payLevelId={porAsignar.payLevelId}
          payLevelName={porAsignar.payLevelName}
          hoy={hoyEnSede(venueTimezone)}
        />
      )}
    </section>
  )
}
