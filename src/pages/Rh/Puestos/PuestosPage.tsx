import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Loader2, Pencil, Plus } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PermissionGate } from '@/components/PermissionGate'
import { useAccess } from '@/hooks/use-access'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useToast } from '@/hooks/use-toast'
import { useArchivePosition, usePositions, usePositionSuggestions } from '@/hooks/useRh'
import { useUltimoNoNulo } from '@/pages/StaffPay/alCerrar'
import { AvisoSinConexion } from '@/pages/StaffPay/components/AvisoSinConexion'
import type { Puesto } from '@/types/rh'
import { PuestoDialog, type DatosPuestoDialog } from './components/PuestoDialog'
import { SugeridosChips } from './components/SugeridosChips'

/** Puestos por página (el servidor impone su propio tope de 100). */
const LIMITE = 50

const mensajeDe = (err: unknown): string | undefined => (err as { response?: { data?: { message?: string } } })?.response?.data?.message

interface FilasProps {
  verArchivados: boolean
  puedeEditar: boolean
  columnas: number
  nombreDeRol: (rol: string) => string
  onEditar: (p: Puesto) => void
  onArchivar: (p: Puesto) => void
}

function FilaDePuesto({ puesto: p, puedeEditar, nombreDeRol, onEditar, onArchivar }: Omit<FilasProps, 'verArchivados' | 'columnas'> & { puesto: Puesto }) {
  const { t } = useTranslation('rh')
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-input px-3 py-1 text-sm font-medium">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground" style={p.color ? { backgroundColor: p.color } : undefined} />
            {p.name}
          </span>
          {p.archivedAt && <Badge variant="outline">{t('positions.archived')}</Badge>}
        </div>
      </TableCell>
      <TableCell>{nombreDeRol(p.suggestedRole)}</TableCell>
      <TableCell>{p.suggestedRelation ? t(`relation.${p.suggestedRelation}`) : <span className="text-muted-foreground">{t('relation.none')}</span>}</TableCell>
      <TableCell>{t(p.tracksAttendanceDefault ? 'positions.yes' : 'positions.no')}</TableCell>
      <TableCell>{p.personasVigentes}</TableCell>
      {puedeEditar && (
        <TableCell>
          {!p.archivedAt && (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-11 w-11 cursor-pointer" aria-label={t('positions.editAria', { name: p.name })} onClick={() => onEditar(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 cursor-pointer" aria-label={t('positions.archiveAria', { name: p.name })} onClick={() => onArchivar(p)}>
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}

/** Una página del listado (su propia consulta: cada «Cargar más» suma una y todas se refrescan al archivar o editar). */
function FilasDePagina({ offset, ...props }: FilasProps & { offset: number }) {
  const { t } = useTranslation('rh')
  const q = usePositions({ includeArchived: props.verArchivados, limit: LIMITE, offset })
  if (!q.data) {
    return (
      <TableRow>
        <TableCell colSpan={props.columnas}>
          {q.isError ? (
            <span role="alert" className="flex flex-wrap items-center gap-3 text-sm">
              {t('positions.loadError')}
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void q.refetch()}>
                {t('positions.retry')}
              </Button>
            </span>
          ) : (
            <Skeleton className="h-6 w-full" />
          )}
        </TableCell>
      </TableRow>
    )
  }
  return (
    <>
      {q.data.data.map(p => (
        <FilaDePuesto key={p.id} puesto={p} {...props} />
      ))}
    </>
  )
}

export default function PuestosPage() {
  const { t } = useTranslation('rh')
  const { toast } = useToast()
  const { can } = useAccess()
  const { getDisplayName } = useRoleConfig()
  const puedeEditar = can('teams:update')
  const archivar = useArchivePosition()
  const sugeridos = usePositionSuggestions(puedeEditar)

  const [verArchivados, setVerArchivados] = useState(false)
  const [paginas, setPaginas] = useState(1)
  const [dialogo, setDialogo] = useState<DatosPuestoDialog | null>(null)
  const [porArchivar, setPorArchivar] = useState<Puesto | null>(null)
  const clave = useRef(0)
  // Candado SÍNCRONO: `isPending` no alcanza a apagar «Archivar» entre dos clics seguidos.
  const archivando = useRef(false)
  // Lo que nombran los diálogos mientras se cierran: no se quedan vacíos durante la animación de salida.
  const datosDelDialogo = useUltimoNoNulo(dialogo)
  const puestoAArchivar = useUltimoNoNulo(porArchivar)

  // La primera página da el total y el estado general; la última dice si hay más. Con una sola página son la misma consulta.
  const primera = usePositions({ includeArchived: verArchivados, limit: LIMITE, offset: 0 })
  const ultima = usePositions({ includeArchived: verArchivados, limit: LIMITE, offset: (paginas - 1) * LIMITE })
  const total = primera.data?.total ?? 0
  const mostrados = (paginas - 1) * LIMITE + (ultima.data?.data.length ?? 0)
  const cargandoMas = paginas > 1 && ultima.isLoading
  const hayMas = !!ultima.data?.hasMore

  const abrir = (d: Omit<DatosPuestoDialog, 'clave'>) => setDialogo({ ...d, clave: ++clave.current })
  const cambiarArchivados = (v: boolean) => {
    setVerArchivados(v)
    setPaginas(1)
  }

  const archivarConfirmado = () => {
    const p = porArchivar
    if (!p || archivando.current) return
    archivando.current = true
    archivar.mutate(p.id, {
      onSuccess: () => toast({ title: t('positions.archivedToast') }),
      onError: err => toast({ title: mensajeDe(err) ?? t('positions.errorGeneric'), variant: 'destructive' }),
      onSettled: () => {
        archivando.current = false
      },
    })
    setPorArchivar(null)
  }
  // Sin red el archivado queda EN PAUSA: se dice, y «Cancelar envío» lo quita de la cola de verdad.
  const cancelarArchivado = () => {
    archivar.cancelarEnPausa()
    archivando.current = false
  }

  const columnas = puedeEditar ? 6 : 5
  const filas: FilasProps = {
    verArchivados,
    puedeEditar,
    columnas,
    nombreDeRol: getDisplayName,
    onEditar: p => abrir({ puesto: p }),
    onArchivar: setPorArchivar,
  }

  return (
    <div className="space-y-6 bg-background p-4 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('positions.title')}</h1>
          <p className="text-muted-foreground">{t('positions.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-h-11 items-center gap-2">
            <Switch id="rh-puestos-archivados" checked={verArchivados} onCheckedChange={cambiarArchivados} />
            <Label htmlFor="rh-puestos-archivados" className="cursor-pointer">
              {t('positions.showArchived')}
            </Label>
          </div>
          <PermissionGate permission="teams:update">
            <Button className="h-11 cursor-pointer" onClick={() => abrir({})} data-tour="rh-positions-create-btn">
              <Plus className="h-4 w-4" />
              {t('positions.create')}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {archivar.isPaused && <AvisoSinConexion texto={t('positions.offlineArchive')} onCancelar={cancelarArchivado} dataTour="rh-positions-archive-offline" />}

      {puedeEditar && <SugeridosChips sugeridos={sugeridos.data?.data ?? []} onElegir={s => abrir({ name: s.name, suggestedRole: s.suggestedRole })} />}

      {primera.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !primera.data ? (
        // Un fallo de red NO se ve como «no hay puestos».
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          {t('positions.loadError')}
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void primera.refetch()}>
            {t('positions.retry')}
          </Button>
        </div>
      ) : total === 0 ? (
        <p className="rounded-lg border border-input p-6 text-center text-muted-foreground">{t('positions.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-input">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('people.position')}</TableHead>
                  <TableHead>{t('positions.permissions')}</TableHead>
                  <TableHead>{t('positions.suggestedRelation')}</TableHead>
                  <TableHead>{t('people.checks')}</TableHead>
                  <TableHead>{t('positions.people')}</TableHead>
                  {puedeEditar && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: paginas }, (_, i) => (
                  <FilasDePagina key={i} offset={i * LIMITE} {...filas} />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('positions.shown', { shown: mostrados, total })}</p>
            {(hayMas || cargandoMas) && (
              <Button variant="outline" className="h-11 cursor-pointer" disabled={cargandoMas} onClick={() => setPaginas(n => n + 1)}>
                {cargandoMas && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('positions.loadMore')}
              </Button>
            )}
          </div>
        </>
      )}

      {datosDelDialogo && <PuestoDialog key={datosDelDialogo.clave} open={dialogo !== null} datos={datosDelDialogo} onClose={() => setDialogo(null)} />}

      <AlertDialog open={porArchivar !== null} onOpenChange={abierto => !abierto && setPorArchivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('positions.archive')}</AlertDialogTitle>
            <AlertDialogDescription>{puestoAArchivar && t('positions.archiveConfirm', { name: puestoAArchivar.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 cursor-pointer">{t('positions.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="h-11 cursor-pointer" onClick={archivarConfirmado}>
              {t('positions.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
