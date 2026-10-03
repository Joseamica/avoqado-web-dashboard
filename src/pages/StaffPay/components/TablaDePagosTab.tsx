import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PermissionGate } from '@/components/PermissionGate'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { teamService } from '@/services/team.service'
import { useToast } from '@/hooks/use-toast'
import { useCreateTable, useStaffPayAssignments, useStaffPayLevels, useStaffPayTables } from '@/hooks/useStaffPay'
import { ampliar, cuadriculaDesdeCeldas, faltantes, rellenarHaciaAbajo, simular, type Cuadricula } from '../cuadricula'
import { hoyEnSede } from '../hoyEnSede'
import { AsignarNivelModal } from './AsignarNivelModal'
import { NivelesSection } from './NivelesSection'
import { PublicarTablaModal } from './PublicarTablaModal'

const TECHO_DEFAULT = 10
const TECHO_MAX = 500
const techoValido = (v: number | undefined): v is number => v !== undefined && Number.isInteger(v) && v >= 0 && v <= TECHO_MAX

const mensajeDeError = (err: any, fallback: string): string => err?.response?.data?.message ?? fallback

export function TablaDePagosTab() {
  const { t } = useTranslation('staffPay')
  const { venueId } = useCurrentVenue()
  const { venueTimezone } = useVenueDateTime()
  const { toast } = useToast()
  const qNiveles = useStaffPayLevels()
  const qAsignaciones = useStaffPayAssignments()
  const qTablas = useStaffPayTables()
  const qEquipo = useQuery({
    queryKey: ['team', venueId, 'active'],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: !!venueId,
    staleTime: 60_000,
  })
  const crearTabla = useCreateTable()

  const niveles = useMemo(() => qNiveles.data ?? [], [qNiveles.data])
  const asignaciones = qAsignaciones.data ?? []
  const tablas = qTablas.data ?? []
  const activos = useMemo(() => niveles.filter(n => !n.archivedAt), [niveles])
  const idsActivos = activos.map(n => n.id).join('|')
  const tabla = tablas.find(x => x.productIds.length === 0) ?? tablas[0]
  const celdasVigentes = tabla?.vigente?.cells
  const miembros = (qEquipo.data?.data ?? []).filter(m => m.active !== false)

  const [techoTexto, setTechoTexto] = useState<number | undefined>(TECHO_DEFAULT)
  const [max, setMax] = useState(TECHO_DEFAULT) // último techo válido: la cuadrícula no colapsa mientras se edita el campo
  const [grid, setGrid] = useState<Cuadricula>({})
  const [porAsignar, setPorAsignar] = useState<{ staffId: string; staffName: string; payLevelId: string; payLevelName: string } | null>(null)
  const [simLugares, setSimLugares] = useState<number | undefined>(8)
  const [simNivel, setSimNivel] = useState<string | undefined>(undefined)
  const [publicar, setPublicar] = useState(false)

  // Llega (o cambia) la versión vigente → la cuadrícula arranca de lo guardado.
  useEffect(() => {
    const m = tabla?.vigente?.maxCount ?? TECHO_DEFAULT
    setTechoTexto(m)
    setMax(m)
    setGrid(cuadriculaDesdeCeldas(celdasVigentes ?? [], activos.map(n => n.id), m))
  }, [tabla?.id, tabla?.vigente?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambian los niveles (alta o archivo) → se conservan los montos sin guardar de los demás.
  useEffect(() => {
    setGrid(g => {
      const out: Cuadricula = {}
      for (const n of activos) out[n.id] = g[n.id] ?? cuadriculaDesdeCeldas(celdasVigentes ?? [], [n.id], max)[n.id]
      return out
    })
  }, [idsActivos]) // eslint-disable-line react-hooks/exhaustive-deps

  const nivelSim = simNivel && activos.some(n => n.id === simNivel) ? simNivel : activos[0]?.id
  const sim = nivelSim ? simular(grid, nivelSim, simLugares ?? 0, max) : { monto: null, filaUsada: 0 }
  const faltan = faltantes(grid, max)
  const nivelDe = (staffId: string) => asignaciones.find(a => a.staffId === staffId)

  // Elegir un nivel NO escribe: abre la confirmación con fecha y el efecto («cambia N clases») antes de guardar.
  const pedirAsignacion = (staffId: string, staffName: string, payLevelId: string) => {
    if (nivelDe(staffId)?.payLevelId === payLevelId) return
    const payLevelName = activos.find(n => n.id === payLevelId)?.name ?? ''
    setPorAsignar({ staffId, staffName, payLevelId, payLevelName })
  }
  const crearTablaVacia = () =>
    crearTabla.mutate(
      { name: t('grid.title'), productIds: [] },
      { onError: err => toast({ title: mensajeDeError(err, t('errors.generic')), variant: 'destructive' }) },
    )
  const fijarCelda = (payLevelId: string, count: number, raw: string) => {
    const n = raw === '' ? undefined : parseFloat(raw)
    const valor = n === undefined || Number.isNaN(n) ? undefined : n
    setGrid(g => ({ ...g, [payLevelId]: (g[payLevelId] ?? []).map((v, i) => (i === count ? valor : v)) }))
  }
  const cambiarTecho = (raw: string) => {
    const v = raw === '' ? undefined : parseInt(raw, 10)
    setTechoTexto(v)
    if (techoValido(v)) {
      setMax(v)
      // Nunca recortar mientras se teclea (10 → «1» → 12 borraba filas): las filas sobre el techo se descartan al guardar.
      setGrid(g => ampliar(g, v))
    }
  }

  const cargando = qNiveles.isLoading || qAsignaciones.isLoading || qTablas.isLoading
  const fallo = qNiveles.isError || qAsignaciones.isError || qTablas.isError
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t('states.loading')}</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (fallo) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 p-4 space-y-3">
        <p className="text-sm">{t('states.loadError')}</p>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => { void qNiveles.refetch(); void qAsignaciones.refetch(); void qTablas.refetch() }}
        >
          {t('states.retry')}
        </Button>
      </div>
    )
  }

  const pasos = [
    { key: 'levels', hecho: activos.length > 0 },
    { key: 'who', hecho: asignaciones.length > 0 },
    { key: 'grid', hecho: !!tabla?.vigente },
  ] as const
  const techoInvalido = !techoValido(techoTexto)

  return (
    <div className="space-y-6">
      {/* Guía de tres pasos: cada uno marca palomita al terminarlo */}
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label={t('steps.title')}>
        {pasos.map((p, i) => (
          <li key={p.key} className={`flex items-center gap-2 ${p.hecho ? 'text-foreground' : 'text-muted-foreground'}`}>
            {p.hecho ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <Circle className="h-4 w-4" />}
            <span>{i + 1}. {t(`steps.${p.key}`)}</span>
          </li>
        ))}
      </ol>

      {/* 1. Niveles */}
      <NivelesSection activos={activos} />

      {/* 2. Quién es qué */}
      <section className="rounded-lg border border-input p-4 space-y-3">
        <h3 className="font-semibold">{t('who.title')}</h3>
        {qEquipo.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : miembros.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('who.empty')}</p>
        ) : (
          <>
            {activos.length === 0 && <p className="text-sm text-muted-foreground">{t('who.needLevels')}</p>}
            {miembros.map(m => (
              <div key={m.staffId} className="flex items-center justify-between gap-3">
                <span className="text-sm">{m.firstName} {m.lastName}</span>
                <PermissionGate
                  permission="staffpay:manage"
                  fallback={<span className="text-sm text-muted-foreground">{nivelDe(m.staffId)?.payLevelName ?? t('who.noLevel')}</span>}
                >
                  <Select
                    value={nivelDe(m.staffId)?.payLevelId ?? ''}
                    onValueChange={payLevelId => pedirAsignacion(m.staffId, `${m.firstName} ${m.lastName}`.trim(), payLevelId)}
                    disabled={activos.length === 0}
                  >
                    <SelectTrigger className="w-48 cursor-pointer" aria-label={`${m.firstName} ${m.lastName}`}>
                      <SelectValue placeholder={t('who.noLevel')} />
                    </SelectTrigger>
                    <SelectContent>{activos.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent>
                  </Select>
                </PermissionGate>
              </div>
            ))}
          </>
        )}
      </section>

      {porAsignar && (
        <AsignarNivelModal
          open
          onOpenChange={o => { if (!o) setPorAsignar(null) }}
          staffId={porAsignar.staffId}
          staffName={porAsignar.staffName}
          payLevelId={porAsignar.payLevelId}
          payLevelName={porAsignar.payLevelName}
          hoy={hoyEnSede(venueTimezone)}
        />
      )}

      {/* 3. Cuadrícula */}
      <section className="rounded-lg border border-input p-4 space-y-4">
        <h3 className="font-semibold">{t('grid.title')}</h3>

        {!tabla && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('grid.empty')}</p>
            <PermissionGate permission="staffpay:manage">
              <Button className="cursor-pointer" disabled={crearTabla.isPending} onClick={crearTablaVacia} data-tour="staffpay-table-create">
                {t('grid.create')}
              </Button>
            </PermissionGate>
          </div>
        )}

        {tabla && activos.length === 0 && <p className="text-sm text-muted-foreground">{t('grid.needLevels')}</p>}

        {tabla && activos.length > 0 && (
          <>
            {/* Simulador fijo arriba: «Una clase con [8] lugares, dada por [Head Coach] = $570» */}
            <div className="rounded-lg bg-muted/50 p-3 flex flex-wrap items-center gap-2 text-sm" data-tour="staffpay-simulator">
              <span>{t('grid.simulatorPrefix')}</span>
              <Input
                aria-label={t('grid.simulatorSeats')}
                type="number"
                min={0}
                className="w-20"
                value={simLugares ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                  setSimLugares(v === undefined || Number.isNaN(v) ? undefined : v)
                }}
              />
              <span>{t('grid.simulatorMiddle')}</span>
              <Select value={nivelSim ?? ''} onValueChange={setSimNivel}>
                <SelectTrigger className="w-40 cursor-pointer" aria-label={t('grid.simulatorLevel')}><SelectValue /></SelectTrigger>
                <SelectContent>{activos.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent>
              </Select>
              <span>=</span>
              <span data-testid="simulator-result" className="font-semibold">
                {sim.monto === null ? t('grid.simulatorMissing') : Currency(sim.monto)}
              </span>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('grid.countMode')}</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="staffpay-count-mode" aria-label={t('grid.booked')} checked readOnly className="mt-1" />
                <span>{t('grid.booked')} <span className="block text-muted-foreground">{t('grid.bookedHelp')}</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm opacity-60">
                <input type="radio" name="staffpay-count-mode" aria-label={t('grid.attended')} disabled className="mt-1" />
                <span>{t('grid.attended')} <span className="block text-muted-foreground">{t('grid.attendedHelp')}</span></span>
              </label>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Label htmlFor="staffpay-techo">{t('grid.ceiling')}</Label>
              <Input
                id="staffpay-techo"
                type="number"
                min={0}
                max={TECHO_MAX}
                className="w-24"
                value={techoTexto ?? ''}
                onChange={e => cambiarTecho(e.target.value)}
                aria-invalid={techoInvalido}
              />
              {techoInvalido && <span className="text-destructive">{t('grid.ceilingInvalid', { max: TECHO_MAX })}</span>}
              {faltan > 0 && <span className="text-amber-600 dark:text-amber-400">{t('grid.missingCount', { count: faltan })}</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2">{t('grid.row')}</th>
                    {activos.map(n => <th key={n.id} className="text-right py-2">{n.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: max + 1 }, (_, count) => (
                    <tr key={count} className="border-b border-border/50">
                      <td className="py-1">{count}</td>
                      {activos.map(n => {
                        const v = grid[n.id]?.[count]
                        return (
                          <td key={n.id} className="py-1 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                aria-label={t('grid.cellLabel', { level: n.name, count })}
                                className={`w-28 text-right ${v === undefined ? 'border-amber-500/60 bg-amber-500/5 placeholder:text-amber-600 dark:placeholder:text-amber-400' : ''}`}
                                placeholder={t('grid.missing')}
                                value={v ?? ''}
                                onChange={e => fijarCelda(n.id, count, e.target.value)}
                              />
                              {v !== undefined && count < max ? (
                                <RellenarHaciaAbajo
                                  desde={count}
                                  max={max}
                                  onAplicar={hasta => setGrid(g => rellenarHaciaAbajo(g, n.id, count, hasta))}
                                />
                              ) : (
                                <span className="inline-block w-8" aria-hidden="true" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{t('grid.overCeiling', { max })}</p>
            <PermissionGate permission="staffpay:manage">
              <Button className="cursor-pointer" disabled={techoInvalido} onClick={() => setPublicar(true)} data-tour="staffpay-publish">
                {t('grid.publish')}
              </Button>
            </PermissionGate>
            {publicar && (
              <PublicarTablaModal
                open={publicar}
                onOpenChange={setPublicar}
                tableId={tabla.id}
                maxCount={max}
                grid={grid}
                hoy={hoyEnSede(venueTimezone)}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}

/** «Rellenar hacia abajo hasta la fila N»: copia el monto de esta fila a las siguientes. */
function RellenarHaciaAbajo({ desde, max, onAplicar }: { desde: number; max: number; onAplicar: (hasta: number) => void }) {
  const { t } = useTranslation('staffPay')
  const [abierto, setAbierto] = useState(false)
  const [hasta, setHasta] = useState<number | undefined>(max)
  const valido = hasta !== undefined && Number.isInteger(hasta) && hasta > desde && hasta <= max
  return (
    <Popover open={abierto} onOpenChange={o => { setAbierto(o); if (o) setHasta(max) }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" aria-label={t('grid.fillDown')} title={t('grid.fillDown')}>
          <ArrowDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <Label htmlFor={`fill-${desde}`} className="text-sm">{t('grid.fillDown')}</Label>
        <div className="flex gap-2">
          <Input
            id={`fill-${desde}`}
            type="number"
            min={desde + 1}
            max={max}
            value={hasta ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
              setHasta(v === undefined || Number.isNaN(v) ? undefined : v)
            }}
          />
          <Button
            className="cursor-pointer"
            disabled={!valido}
            onClick={() => { if (valido) { onAplicar(hasta); setAbierto(false) } }}
          >
            {t('grid.fillApply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
