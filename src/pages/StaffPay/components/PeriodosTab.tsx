import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useSetPeriodicity, useStaffPayPeriods } from '@/hooks/useStaffPay'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { PeriodoListadoDto } from '@/types/staffPay'
import { PeriodoAbiertoTab } from './PeriodoAbiertoTab'
import { PeriodoCerradoView } from './PeriodoCerradoView'

const clave = (p: PeriodoListadoDto) => p.start

/**
 * La pestaña «Periodos»: arriba, cuál periodo se ve (el abierto actual primero) y cada cuánto se paga; abajo, el periodo
 * abierto (en vivo, con «Cerrar») o el cerrado (congelado, con «Marcar pagado»).
 */
export function PeriodosTab({ activa }: { activa: boolean }) {
  const { t, i18n } = useTranslation('staffPay')
  const { can } = useAccess()
  const { toast } = useToast()
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useStaffPayPeriods(activa)
  const setPeriodicity = useSetPeriodicity()
  const [elegido, setElegido] = useState<string | null>(null)
  const items = data?.items ?? []
  const actual = items.find(p => clave(p) === elegido) ?? items[0]

  const mes = (p: PeriodoListadoDto) => {
    const nombre = new Date(`${p.start}T12:00:00Z`).toLocaleDateString(getIntlLocale(i18n?.language), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    return data?.periodicidad === 'SEMIMONTHLY' ? `${Number(p.start.slice(8))}–${Number(p.end.slice(8))} ${nombre}` : nombre
  }
  const estado = (p: PeriodoListadoDto) =>
    p.estado === 'OPEN'
      ? t('periods.open')
      : p.personas === 0
        ? t('closed.badge')
        : p.pagadas === p.personas
          ? t('periods.paid')
          : t('periods.closedPaid', { pagadas: p.pagadas, personas: p.personas })

  const cambiarPeriodicidad = async (v: string) => {
    try {
      await setPeriodicity.mutateAsync(v as 'MONTHLY' | 'SEMIMONTHLY')
      setElegido(null)
      toast({ title: t('periods.periodicitySaved') })
    } catch (err) {
      toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
    }
  }

  if (isError && !data) {
    return (
      <Card className="border-input" role="alert">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('periods.error')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (isLoading || !data) {
    if (!activa) return null
    return <Skeleton className="h-24 w-full" aria-busy="true" />
  }
  if (!actual) return <p className="text-sm text-muted-foreground">{t('periods.empty')}</p>

  const puedeCerrar = can('staffpay:close')
  const puedeEditar = data.puedeCambiarPeriodicidad && puedeCerrar
  // El primero es el periodo de hoy (el server los manda del más nuevo al más viejo): ahí cae un ajuste nuevo.
  const abiertoHoy = items[0].estado === 'OPEN' ? mes(items[0]) : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="w-full space-y-1.5 sm:w-72">
          <Label htmlFor="staffpay-periodo">{t('periods.period')}</Label>
          <Select value={clave(actual)} onValueChange={setElegido}>
            <SelectTrigger id="staffpay-periodo" className="w-full cursor-pointer" data-tour="staffpay-period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map(p => (
                <SelectItem key={clave(p)} value={clave(p)} className="cursor-pointer">
                  {mes(p)} · {estado(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasNextPage && (
            <Button
              variant="link"
              size="sm"
              className="h-auto cursor-pointer px-0"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
              data-tour="staffpay-period-load-older"
            >
              {isFetchingNextPage && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t('periods.loadOlder')}
            </Button>
          )}
        </div>
        <div className="w-full space-y-1.5 sm:w-auto sm:max-w-sm">
          <Label htmlFor="staffpay-periodicidad">{t('periods.periodicity')}</Label>
          <Select value={data.periodicidad} onValueChange={cambiarPeriodicidad} disabled={!puedeEditar || setPeriodicity.isPending}>
            <SelectTrigger id="staffpay-periodicidad" className="w-full cursor-pointer sm:w-64" data-tour="staffpay-periodicity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY" className="cursor-pointer">
                {t('periods.monthly')}
              </SelectItem>
              <SelectItem value="SEMIMONTHLY" className="cursor-pointer">
                {t('periods.semimonthly')}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {data.puedeCambiarPeriodicidad ? (puedeCerrar ? t('periods.periodicityHelp') : t('periods.periodicityNoPermission')) : t('periods.periodicityLocked')}
          </p>
        </div>
      </div>
      {actual.estado === 'CLOSED' && actual.id ? (
        <PeriodoCerradoView key={actual.id} periodId={actual.id} fecha={actual.start} etiqueta={mes(actual)} etiquetaAbierto={abiertoHoy} />
      ) : (
        <PeriodoAbiertoTab key={actual.start} activa={activa} fecha={actual.start} etiqueta={mes(actual)} />
      )}
    </div>
  )
}
