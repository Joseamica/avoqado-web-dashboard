import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useStaffPayReport } from '@/hooks/useStaffPay'
import { DesglosePersona } from './DesglosePersona'
import { ExcepcionesSheet, HuerfanasSheet } from './ListasDelPeriodo'
import { useNombreSede } from '../useNombreSede'

const LIMITE = 50
const TODAS = '__all__'

export function PeriodoAbiertoTab({ activa }: { activa: boolean }) {
  const { t } = useTranslation('staffPay')
  const { formatCalendarDate } = useVenueDateTime()
  const { venueId } = useCurrentVenue()
  const nombreSede = useNombreSede()
  const [offset, setOffset] = useState(0)
  const [sede, setSede] = useState<string | undefined>(undefined)
  const [persona, setPersona] = useState<{ staffId: string; staffName: string } | null>(null)
  const [lista, setLista] = useState<'excepciones' | 'huerfanas' | null>(null)
  // Las sedes del filtro salen del reporte SIN filtro: con `sede` puesto, `venueIds` ya viene recortado a esa sola.
  const [sedesConocidas, setSedesConocidas] = useState<string[]>([])
  const { data, isLoading, isError, refetch } = useStaffPayReport({ offset, limit: LIMITE, sede }, activa)

  useEffect(() => {
    if (data && sede === undefined) setSedesConocidas(data.venueIds)
  }, [data, sede])

  const opcionesSede = useMemo(() => {
    const ids = [...sedesConocidas]
    if (venueId && !ids.includes(venueId)) ids.unshift(venueId)
    return ids
  }, [sedesConocidas, venueId])
  const items = useMemo(() => data?.personas.items ?? [], [data])

  const cambiarSede = (v: string) => {
    setSede(v === TODAS ? undefined : v)
    setOffset(0)
    setPersona(null)
    setLista(null)
  }

  if (isError && !data) {
    return (
      <Card className="border-input" role="alert">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('period.error')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (isLoading || !data) {
    if (!activa && !data) return null
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    )
  }

  const tj = data.tarjetas
  const total = data.personas.total
  const mostrarFiltro = opcionesSede.length > 1 || sede !== undefined

  return (
    <div className="space-y-4" data-tour="staffpay-period">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">
            {t('period.title', { start: formatCalendarDate(data.periodo.start), end: formatCalendarDate(data.periodo.end) })}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t('period.open')}</span>
          {data.parcial && (
            <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              {t('period.partial')}
            </span>
          )}
          {data.parcial && data.venueIds.length > 0 && (
            <span className="text-xs text-muted-foreground">{data.venueIds.map(nombreSede).join(' · ')}</span>
          )}
        </div>
        {mostrarFiltro && (
          <div className="flex items-center gap-2" data-tour="staffpay-period-venue-filter">
            <span className="text-xs text-muted-foreground">{t('period.venue.label')}</span>
            <Select value={sede ?? TODAS} onValueChange={cambiarSede}>
              <SelectTrigger className="h-8 w-[200px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>{t('period.venue.all')}</SelectItem>
                {opcionesSede.map(id => (
                  <SelectItem key={id} value={id}>
                    {nombreSede(id) === id && id === venueId ? t('period.venue.this') : nombreSede(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            [t('period.cards.total'), Currency(Number(tj.total))],
            [t('period.cards.classes'), tj.clases],
            [t('period.cards.people'), tj.personas],
            [t('period.cards.exceptions'), tj.excepciones],
          ] as const
        ).map(([label, value]) => (
          <Card key={String(label)} className="border-input">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-input p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('period.error')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </div>
      )}
      {data.truncado && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{t('period.truncated')}</span>
        </div>
      )}
      {tj.excepciones > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{t('period.exceptionsBanner', { count: tj.excepciones })}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" data-tour="staffpay-period-exceptions" onClick={() => setLista('excepciones')}>
            {t('period.seeExceptions')}
          </Button>
        </div>
      )}
      {data.huerfanas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-input p-3 text-sm">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('period.orphans', { count: data.huerfanas })}</span>
          </div>
          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setLista('huerfanas')}>
            {t('period.seeOrphans')}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('period.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">{t('period.columns.person')}</th>
                <th>{t('period.columns.level')}</th>
                <th>{t('period.columns.venue')}</th>
                <th className="text-right">{t('period.columns.classes')}</th>
                <th className="text-right">{t('period.columns.avgSeats')}</th>
                <th className="text-right">{t('period.columns.total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.staffId} className="border-b border-border/50">
                  <td className="py-2 font-medium">{p.staffName}</td>
                  <td>{p.payLevelName ?? '—'}</td>
                  <td className="text-muted-foreground">{p.venueIds.map(nombreSede).join(', ')}</td>
                  <td className="text-right">{p.clases}</td>
                  <td className="text-right">{p.promedioLugares}</td>
                  <td className="text-right font-semibold">{Currency(Number(p.total))}</td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setPersona({ staffId: p.staffId, staffName: p.staffName })}>
                      {t('period.detail')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMITE && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>{t('period.pageRange', { from: offset + 1, to: Math.min(offset + LIMITE, total), total })}</span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            aria-label={t('period.previousPage')}
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - LIMITE))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            aria-label={t('period.nextPage')}
            disabled={offset + LIMITE >= total}
            onClick={() => setOffset(o => o + LIMITE)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button disabled variant="outline" size="sm" data-tour="staffpay-period-close">
          <Lock className="mr-1 h-3.5 w-3.5" />
          {t('period.close')}
          <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[10px]">
            {t('period.comingSoon')}
          </Badge>
        </Button>
        <p className="text-xs text-muted-foreground">{t('period.closeSoon')}</p>
      </div>

      {persona && <DesglosePersona staffId={persona.staffId} staffName={persona.staffName} sede={sede} onClose={() => setPersona(null)} />}
      {lista === 'excepciones' && <ExcepcionesSheet sede={sede} onClose={() => setLista(null)} />}
      {lista === 'huerfanas' && <HuerfanasSheet sede={sede} onClose={() => setLista(null)} />}
    </div>
  )
}
