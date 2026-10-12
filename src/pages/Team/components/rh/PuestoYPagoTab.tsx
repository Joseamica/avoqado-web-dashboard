import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useToast } from '@/hooks/use-toast'
import { rhKeys, useEndAssignment, usePayOverview, useStaffAssignments } from '@/hooks/useRh'
import { rhService } from '@/services/rh.service'
import { useUltimoNoNulo } from '@/pages/StaffPay/alCerrar'
import { AvisoSinConexion } from '@/pages/StaffPay/components/AvisoSinConexion'
import { hoyEnSede } from '@/pages/StaffPay/hoyEnSede'
import { textoDelServidor } from '@/utils/apiError'
import { useVenueDateTime } from '@/utils/datetime'
import type { Asignacion, Puesto } from '@/types/rh'
import { AsignarPuestoDialog, AvisoIndependiente, CampoFecha } from './AsignarPuestoDialog'
import { CambiarAsignacionDialog } from './CambiarAsignacionDialog'

/**
 * Los puestos vigentes (sin fin) de la persona. El historial va por fecha de inicio: una vigente vieja puede quedar detrás de
 * muchas versiones nuevas de otro puesto, así que «las abiertas de la primera página» no es el conjunto. Se recorre de 100 en
 * 100 (el tope del servidor) hasta el final, deduplicando por id.
 * ponytail: una petición hasta 100 versiones por persona; si alguien junta cientos, que GET /team/:id mande currentAssignments.
 */
async function asignacionesAbiertas(venueId: string, staffId: string): Promise<Asignacion[]> {
  const abiertas = new Map<string, Asignacion>()
  for (let page = 0; ; page++) {
    const p = await rhService.history(venueId, staffId, page, 100)
    for (const a of p.data) if (a.effectiveTo === null) abiertas.set(a.id, a)
    if (!p.hasMore || p.data.length === 0) return [...abiertas.values()]
  }
}

const tasa = (x: number) => Number((x * 100).toFixed(2))

function Relacion({ a }: { a: Asignacion }) {
  const { t } = useTranslation('rh')
  return a.relation ? <span>{t(`relation.${a.relation}`)}</span> : <span className="text-muted-foreground">{t('relation.none')}</span>
}

function ErrorConReintento({ texto, onReintentar }: { texto: string; onReintentar: () => void }) {
  const { t } = useTranslation('rh')
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
      {texto}
      <Button variant="outline" className="h-11 cursor-pointer" onClick={onReintentar}>
        {t('positions.retry')}
      </Button>
    </div>
  )
}

/** Una página del historial (su propia consulta: cada «Cargar más» suma una y todas se refrescan tras asignar o cambiar). */
function PaginaDeHistorial({ staffId, page }: { staffId: string; page: number }) {
  const { t } = useTranslation('rh')
  const { formatCalendarDate } = useVenueDateTime()
  const q = useStaffAssignments(staffId, page)
  if (!q.data) {
    return (
      <li>
        {q.isError ? (
          <ErrorConReintento texto={t('positions.loadError')} onReintentar={() => void q.refetch()} />
        ) : (
          <Skeleton className="h-6 w-full" />
        )}
      </li>
    )
  }
  return (
    <>
      {q.data.data.map(a => (
        <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
          <span className="font-medium">{a.positionName}</span>
          <Relacion a={a} />
          <span className="text-muted-foreground">
            {t('profile.since', { date: formatCalendarDate(a.effectiveFrom) })}
            {a.effectiveTo && ` · ${t('profile.until', { date: formatCalendarDate(a.effectiveTo) })}`}
          </span>
        </li>
      ))}
    </>
  )
}

interface Props {
  staffId: string
  /** Nombre de la sede: la ficha es de una sede y sus puestos también. */
  sede: string
  rolActual: string
  /** Abre el diálogo de editar miembro que ya existe en la ficha. Sin él (no se puede editar a esta persona) no hay oferta de rol. */
  onCambiarRol?: () => void
  /** Lo que ya vivía en la ficha (nivel de pago por clase, comisiones): va entre «Cómo se le paga hoy» y el historial. */
  children?: ReactNode
}

/** Pestaña «Puesto y pago» (spec RH §6). Sólo se monta fuera de marca blanca: ahí todo /rh responde 403. */
export function PuestoYPagoTab({ staffId, sede, rolActual, onCambiarRol, children }: Props) {
  const { t } = useTranslation('rh')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { venueTimezone, formatCalendarDate } = useVenueDateTime()
  const { getDisplayName } = useRoleConfig()
  const hoy = hoyEnSede(venueTimezone)

  const vigentes = useQuery({
    queryKey: [...rhKeys.all(venueId), 'vigentes', staffId],
    queryFn: () => asignacionesAbiertas(venueId!, staffId),
    enabled: !!venueId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const resumen = usePayOverview(staffId)
  const [paginas, setPaginas] = useState(1)
  const primera = useStaffAssignments(staffId, 0)
  const ultima = useStaffAssignments(staffId, paginas - 1)
  const totalHistorial = primera.data?.total ?? 0
  const cargandoMas = paginas > 1 && ultima.isLoading

  // Diálogos: `clave` renueva el formulario en cada apertura; `useUltimoNoNulo` lo deja pintado durante la animación de salida.
  const clave = useRef(0)
  const [asignando, setAsignando] = useState<number | null>(null)
  const [cambiando, setCambiando] = useState<{ clave: number; asignacion: Asignacion } | null>(null)
  const asignandoVisible = useUltimoNoNulo(asignando)
  const cambiandoVisible = useUltimoNoNulo(cambiando)

  // Spec §3.4: el puesto sólo SUGIERE un rol. Si difiere, se ofrece; nunca se cambia solo.
  const [rolOfrecido, setRolOfrecido] = useState<string | null>(null)
  const ofrecerRol = (p: Puesto) => setRolOfrecido(p.suggestedRole !== rolActual ? p.suggestedRole : null)
  const mostrarOferta = !!onCambiarRol && !!rolOfrecido && rolOfrecido !== rolActual

  // Terminar: confirmación con el último día (hoy por default). Sin red queda en pausa; cerrar lo quita de la cola.
  const terminar = useEndAssignment()
  const [terminando, setTerminando] = useState<Asignacion | null>(null)
  const terminandoVisible = useUltimoNoNulo(terminando)
  const [fechaFin, setFechaFin] = useState(hoy)
  const [errorFin, setErrorFin] = useState<string | null>(null)
  const finEnVuelo = useRef(false)
  const abrirTerminar = (a: Asignacion) => {
    setFechaFin(hoy)
    setErrorFin(null)
    setTerminando(a)
  }
  const cerrarTerminar = () => {
    if (terminar.isPaused) {
      terminar.cancelarEnPausa()
      finEnVuelo.current = false
    }
    setTerminando(null)
  }
  const confirmarTerminar = async () => {
    if (!terminando || finEnVuelo.current || fechaFin === '' || fechaFin > hoy) return
    finEnVuelo.current = true
    setErrorFin(null)
    try {
      await terminar.mutateAsync({ assignmentId: terminando.id, fecha: fechaFin })
      toast({ title: t('profile.ended') })
      setTerminando(null)
    } catch (err) {
      setErrorFin(textoDelServidor(err) ?? t('positions.errorGeneric'))
    } finally {
      finEnVuelo.current = false
    }
  }

  const abiertas = vigentes.data ?? []
  const independienteQueCheca = abiertas.some(a => a.relation === 'INDEPENDIENTE_FACTURA' && a.tracksAttendance)

  return (
    <div className="space-y-6">
      {/* ─── Puestos vigentes ─── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t('profile.current')}</h2>
          <PermissionGate permission="teams:update">
            <Button className="h-11 cursor-pointer" onClick={() => setAsignando(++clave.current)} data-tour="rh-profile-assign-btn">
              <Plus className="h-4 w-4" />
              {t('profile.assign')}
            </Button>
          </PermissionGate>
        </div>

        {mostrarOferta && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-input p-3 text-sm">
            <span className="min-w-0 flex-1">
              {t('profile.changeRoleOffer', { current: getDisplayName(rolActual), suggested: getDisplayName(rolOfrecido) })}
            </span>
            <Button variant="outline" className="h-11 cursor-pointer" onClick={() => setRolOfrecido(null)}>
              {t('profile.notNow')}
            </Button>
            <Button className="h-11 cursor-pointer" onClick={onCambiarRol} data-tour="rh-profile-change-role">
              {t('profile.changeRole')}
            </Button>
          </div>
        )}

        {independienteQueCheca && <AvisoIndependiente />}

        {!vigentes.data ? (
          vigentes.isError ? (
            <ErrorConReintento texto={t('positions.loadError')} onReintentar={() => void vigentes.refetch()} />
          ) : (
            <Skeleton className="h-20 w-full" />
          )
        ) : abiertas.length === 0 ? (
          <p className="rounded-xl border border-input p-4 text-sm text-muted-foreground">{t('people.noPosition')}</p>
        ) : (
          <ul className="space-y-3">
            {abiertas.map(a => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-input p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{a.positionName}</p>
                  <p className="text-sm text-muted-foreground">
                    {sede} · {t('profile.since', { date: formatCalendarDate(a.effectiveFrom) })}
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>
                      {t('people.relation')}: <Relacion a={a} />
                    </span>
                    <span>
                      {t('people.checks')}: <span>{t(a.tracksAttendance ? 'positions.yes' : 'positions.no')}</span>
                    </span>
                  </p>
                </div>
                <PermissionGate permission="teams:update">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-11 cursor-pointer"
                      aria-label={t('profile.changeAria', { name: a.positionName })}
                      onClick={() => setCambiando({ clave: ++clave.current, asignacion: a })}
                    >
                      {t('profile.change')}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 cursor-pointer"
                      aria-label={t('profile.endAria', { name: a.positionName })}
                      onClick={() => abrirTerminar(a)}
                    >
                      {t('profile.end')}
                    </Button>
                  </div>
                </PermissionGate>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Cómo se le paga hoy (calculado en vivo por el servidor, spec §3.5) ─── */}
      <Card className="border-input">
        <CardHeader>
          <CardTitle className="text-base">{t('profile.liveTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!resumen.data ? (
            resumen.isError ? (
              <ErrorConReintento texto={t('profile.liveError')} onReintentar={() => void resumen.refetch()} />
            ) : (
              <Skeleton className="h-16 w-full" />
            )
          ) : (
            <>
              {/* `null` = quien mira no tiene commissions:read (lo decide el servidor). */}
              {resumen.data.comisiones && (
                <div className="space-y-1">
                  <p className="font-medium">{t('profile.liveCommissions')}</p>
                  {resumen.data.comisiones.length === 0 ? (
                    <p className="text-muted-foreground">{t('profile.liveNoCommissions')}</p>
                  ) : (
                    <ul className="space-y-1">
                      {resumen.data.comisiones.map(c => (
                        <li key={c.configId}>
                          {c.nombre}
                          {c.excluida ? (
                            <span className="text-muted-foreground"> · {t('profile.liveExcluded')}</span>
                          ) : (
                            c.tasaPersonal !== null && (
                              <span className="text-muted-foreground">
                                {' '}
                                · {t('profile.liveCustomRate', { rate: tasa(c.tasaPersonal) })}
                              </span>
                            )
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {resumen.data.nivelDeClase !== 'SIN_PERMISO' && (
                <div className="space-y-1">
                  <p className="font-medium">{t('profile.liveClassLevel')}</p>
                  {resumen.data.nivelDeClase ? (
                    <p>
                      {resumen.data.nivelDeClase.nombre}{' '}
                      <span className="text-muted-foreground">
                        · {t('profile.since', { date: formatCalendarDate(resumen.data.nivelDeClase.desde) })}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">{t('profile.liveNoLevel')}</p>
                  )}
                </div>
              )}
              <p>{t('profile.liveTips')}</p>
              <p className="text-muted-foreground">{t('profile.phase1bNote')}</p>
            </>
          )}
        </CardContent>
      </Card>

      {children}

      {/* ─── Historial, de 20 en 20 ─── */}
      {totalHistorial > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t('profile.history')}</h2>
          <ul className="divide-y divide-border/50 rounded-xl border border-input px-4">
            {Array.from({ length: paginas }, (_, i) => (
              <PaginaDeHistorial key={i} staffId={staffId} page={i} />
            ))}
          </ul>
          {(ultima.data?.hasMore || cargandoMas) && (
            <Button variant="outline" className="h-11 cursor-pointer" disabled={cargandoMas} onClick={() => setPaginas(n => n + 1)}>
              {cargandoMas && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('positions.loadMore')}
            </Button>
          )}
        </section>
      )}
      {primera.isError && !primera.data && (
        <ErrorConReintento texto={t('positions.loadError')} onReintentar={() => void primera.refetch()} />
      )}

      {asignandoVisible !== null && (
        <AsignarPuestoDialog
          key={asignandoVisible}
          open={asignando !== null}
          staffId={staffId}
          hoy={hoy}
          onClose={() => setAsignando(null)}
          onAsignado={ofrecerRol}
        />
      )}
      {cambiandoVisible && (
        <CambiarAsignacionDialog
          key={cambiandoVisible.clave}
          open={cambiando !== null}
          asignacion={cambiandoVisible.asignacion}
          hoy={hoy}
          onClose={() => setCambiando(null)}
          onCambioDePuesto={ofrecerRol}
        />
      )}

      <AlertDialog open={terminando !== null} onOpenChange={abierto => !abierto && cerrarTerminar()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.end')}</AlertDialogTitle>
            <AlertDialogDescription>
              {terminandoVisible && t('profile.endConfirm', { name: terminandoVisible.positionName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {terminar.isPaused && <AvisoSinConexion texto={t('positions.offlineSave')} dataTour="rh-end-offline" />}
          {errorFin && (
            <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
              {errorFin}
            </p>
          )}
          <CampoFecha value={fechaFin} onChange={setFechaFin} hoy={hoy} />
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 cursor-pointer">{t('positions.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              className="h-11 cursor-pointer"
              disabled={terminar.isPending || fechaFin === '' || fechaFin > hoy}
              onClick={() => void confirmarTerminar()}
              data-tour="rh-end-confirm"
            >
              {terminar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('profile.end')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
