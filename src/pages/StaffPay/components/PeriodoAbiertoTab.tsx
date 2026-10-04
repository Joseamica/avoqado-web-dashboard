import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Loader2, Lock, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVenueDateTime } from '@/utils/datetime'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAccess } from '@/hooks/use-access'
import { useStaffPayReport } from '@/hooks/useStaffPay'
import { DesglosePersona } from './DesglosePersona'
import { CerrarPeriodoModal } from './CerrarPeriodoModal'
import { AjusteManualModal } from './AjusteManualModal'
import { ExcepcionesSheet, HuerfanasSheet, TABLA_PERIODO } from './ListasDelPeriodo'
import { useNombreSede } from '../useNombreSede'
import { hoyEnSede } from '../hoyEnSede'
import { conSigno, monto } from '../conSigno'

const LIMITE = 50
const TODAS = '__all__'

/**
 * El periodo abierto, valorado en vivo. `fecha` (un día del periodo) elige CUÁL; sin ella, el de hoy (fase 1).
 * «Cerrar periodo» sólo con `staffpay:close` y viendo todas las sedes (spec §7.3); si no, dice por qué.
 */
export function PeriodoAbiertoTab({
  activa,
  fecha,
  etiqueta,
  onYaCerrado,
}: {
  activa: boolean
  fecha?: string
  etiqueta?: string
  /** El reporte llegó CERRADO (otro usuario lo cerró): el padre refresca la lista y cambia a la vista cerrada. */
  onYaCerrado?: () => void
}) {
  const { t } = useTranslation('staffPay')
  const { formatCalendarDate, venueTimezone } = useVenueDateTime()
  const { venueId } = useCurrentVenue()
  const nombreSede = useNombreSede()
  const { can } = useAccess()
  const [offset, setOffset] = useState(0)
  const [sede, setSede] = useState<string | undefined>(undefined)
  const [persona, setPersona] = useState<{ staffId: string; staffName: string; clases: number; total: string } | null>(null)
  const [lista, setLista] = useState<'excepciones' | 'huerfanas' | null>(null)
  const [cerrarAbierto, setCerrarAbierto] = useState(false)
  const [ajusteAbierto, setAjusteAbierto] = useState(false)
  // Las sedes del filtro salen del reporte SIN filtro: con `sede` puesto, `venueIds` ya viene recortado a esa sola.
  const [sedesConocidas, setSedesConocidas] = useState<string[]>([])
  const { data, isLoading, isError, refetch } = useStaffPayReport({ offset, limit: LIMITE, sede, fecha }, activa)

  useEffect(() => {
    if (data && sede === undefined) setSedesConocidas(data.venueIds)
  }, [data, sede])
  const yaCerrado = data?.periodo.estado === 'CLOSED'
  useEffect(() => {
    if (yaCerrado) onYaCerrado?.()
  }, [yaCerrado]) // eslint-disable-line react-hooks/exhaustive-deps -- avisar una vez por cambio de estado

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

  if (yaCerrado) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border border-input p-4 text-sm">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        <span>{t('period.justClosed')}</span>
      </div>
    )
  }

  const tj = data.tarjetas
  const total = data.personas.total
  // El periodo de hoy no se puede cerrar hasta que termine: se dice desde cuándo, en vez de abrir un cierre bloqueado.
  const terminado = hoyEnSede(venueTimezone) > data.periodo.end
  const diaSiguiente = (d: string) => {
    const x = new Date(`${d}T12:00:00Z`)
    x.setUTCDate(x.getUTCDate() + 1)
    return x.toISOString().slice(0, 10)
  }
  const mostrarFiltro = opcionesSede.length > 1 || sede !== undefined
  // Un mes que ya pasó sin una sola clase ni ajuste no es «Abierto» con trabajo pendiente: no tuvo movimientos.
  const sinMovimientos = terminado && total === 0 && tj.clases === 0 && tj.excepciones === 0 && !tj.excluidas

  return (
    <div className="space-y-4" data-tour="staffpay-period">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">
            {t('period.title', { start: formatCalendarDate(data.periodo.start), end: formatCalendarDate(data.periodo.end) })}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{sinMovimientos ? t('period.noActivity') : t('period.open')}</span>
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
            [t('period.cards.total'), monto(tj.total)],
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
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{t('period.exceptionsBanner', { count: tj.excepciones })}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            data-tour="staffpay-period-exceptions"
            onClick={() => setLista('excepciones')}
          >
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
        <p className="text-sm text-muted-foreground">{sinMovimientos ? t('period.noActivityEmpty') : t('period.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={TABLA_PERIODO}>
            <thead>
              {/* En el celular sólo Persona, Total y Desglose: lo demás se ve desde md. */}
              <tr className="border-b border-border text-left">
                <th className="py-2">{t('period.columns.person')}</th>
                <th className="hidden md:table-cell">{t('period.columns.level')}</th>
                <th className="hidden md:table-cell">{t('period.columns.venue')}</th>
                <th className="hidden text-right md:table-cell">{t('period.columns.classes')}</th>
                <th className="hidden text-right md:table-cell">{t('period.columns.avgSeats')}</th>
                <th className="hidden text-right md:table-cell">{t('period.columns.adjustments')}</th>
                <th className="text-right">{t('period.columns.total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.staffId} className="border-b border-border/50">
                  <td className="py-2 font-medium">{p.staffName}</td>
                  <td className="hidden md:table-cell">{p.payLevelName ?? '—'}</td>
                  <td className="hidden text-muted-foreground md:table-cell">{p.venueIds.map(nombreSede).join(', ')}</td>
                  <td className="hidden text-right md:table-cell">{p.clases}</td>
                  <td className="hidden text-right md:table-cell">{p.promedioLugares}</td>
                  <td className="hidden whitespace-nowrap text-right md:table-cell">{Number(p.ajustes ?? 0) !== 0 ? conSigno(p.ajustes!) : '—'}</td>
                  <td className="whitespace-nowrap text-right font-semibold">{monto(p.total)}</td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => setPersona({ staffId: p.staffId, staffName: p.staffName, clases: p.clases, total: p.total })}
                    >
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

      {fecha && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {can('staffpay:close') ? (
            <>
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setAjusteAbierto(true)} data-tour="staffpay-period-adjust">
                <Plus className="mr-1 h-3.5 w-3.5" />
                {etiqueta ? t('manualAdjust.add', { periodo: etiqueta }) : t('manualAdjust.title')}
              </Button>
              {data.parcial ? (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('period.closePartial')}
                </p>
              ) : terminado ? (
                <Button size="sm" className="cursor-pointer" onClick={() => setCerrarAbierto(true)} data-tour="staffpay-period-close">
                  <Lock className="mr-1 h-3.5 w-3.5" />
                  {t('period.close')}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" disabled data-tour="staffpay-period-close">
                    <Lock className="mr-1 h-3.5 w-3.5" />
                    {t('period.close')}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t('period.closeFrom', { fecha: formatCalendarDate(diaSiguiente(data.periodo.end)) })}</p>
                </>
              )}
            </>
          ) : (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('period.closeNoPermission')}
            </p>
          )}
        </div>
      )}

      {persona && (
        <DesglosePersona
          staffId={persona.staffId}
          staffName={persona.staffName}
          clases={persona.clases}
          total={persona.total}
          sede={sede}
          fecha={fecha}
          onClose={() => setPersona(null)}
        />
      )}
      {lista === 'excepciones' && <ExcepcionesSheet sede={sede} fecha={fecha} onClose={() => setLista(null)} />}
      {lista === 'huerfanas' && <HuerfanasSheet sede={sede} fecha={fecha} onClose={() => setLista(null)} />}
      {cerrarAbierto && fecha && (
        <CerrarPeriodoModal
          open
          fecha={fecha}
          etiqueta={etiqueta}
          onOpenChange={setCerrarAbierto}
          onCerrado={() => setCerrarAbierto(false)}
          onVerExcepciones={() => {
            setCerrarAbierto(false)
            setLista('excepciones')
          }}
        />
      )}
      {ajusteAbierto && fecha && (
        <AjusteManualModal open onOpenChange={setAjusteAbierto} fecha={fecha} etiqueta={etiqueta} sedes={opcionesSede} />
      )}
    </div>
  )
}
