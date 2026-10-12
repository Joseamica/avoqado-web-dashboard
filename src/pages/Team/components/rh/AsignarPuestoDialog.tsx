import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAssignPosition, usePositions } from '@/hooks/useRh'
import { AvisoSinConexion } from '@/pages/StaffPay/components/AvisoSinConexion'
import { textoDelServidor } from '@/utils/apiError'
import type { Puesto, WorkRelation } from '@/types/rh'

const RELACIONES: WorkRelation[] = ['EMPLEADO_NOMINA', 'ASIMILADO', 'INDEPENDIENTE_FACTURA', 'RENTA_SILLA']
/** «Sin definir» es `null` (el Select de Radix no admite un valor vacío: en el control se llama 'none'). */
const SIN_DEFINIR = 'none'
/** Puestos que se ofrecen (el servidor topa en 100). Si hay más, se dice cuántos faltan: nunca se corta en silencio. */
export const LIMITE_PUESTOS = 100

export function CampoPuesto({
  value,
  onChange,
  puestos,
  total,
}: {
  value: string
  onChange: (id: string) => void
  puestos: Array<{ id: string; name: string }>
  total: number
}) {
  const { t } = useTranslation('rh')
  return (
    <div className="space-y-2">
      <Label htmlFor="rh-asignar-puesto">{t('people.position')}</Label>
      <Select name="positionId" value={value} onValueChange={onChange}>
        <SelectTrigger id="rh-asignar-puesto" className="h-12 text-base" data-tour="rh-assign-position">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {puestos.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {total > puestos.length && <p className="text-sm text-muted-foreground">{t('positions.shown', { shown: puestos.length, total })}</p>}
    </div>
  )
}

export function CampoRelacion({ value, onChange }: { value: WorkRelation | null; onChange: (v: WorkRelation | null) => void }) {
  const { t } = useTranslation('rh')
  return (
    <div className="space-y-2">
      <Label htmlFor="rh-asignar-relacion">{t('people.relation')}</Label>
      <Select name="relation" value={value ?? SIN_DEFINIR} onValueChange={v => onChange(v === SIN_DEFINIR ? null : (v as WorkRelation))}>
        <SelectTrigger id="rh-asignar-relacion" className="h-12 text-base" data-tour="rh-assign-relation">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_DEFINIR}>{t('relation.none')}</SelectItem>
          {RELACIONES.map(r => (
            <SelectItem key={r} value={r}>
              {t(`relation.${r}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">{t('relation.help')}</p>
    </div>
  )
}

/** Un fallo de carga se dice como fallo (nunca como lista vacía) y se puede reintentar. `type="button"`: vive dentro de formularios. */
export function ErrorConReintento({ texto, onReintentar }: { texto: string; onReintentar: () => void }) {
  const { t } = useTranslation('rh')
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
      {texto}
      <Button type="button" variant="outline" className="h-11 cursor-pointer" onClick={onReintentar}>
        {t('positions.retry')}
      </Button>
    </div>
  )
}

/** Fecha civil de la sede: hoy o pasada, nunca futura (el servidor rechaza futuras y periodos cerrados). `min`: no antes de… */
export function CampoFecha({
  value,
  onChange,
  hoy,
  min,
  nota,
}: {
  value: string
  onChange: (v: string) => void
  hoy: string
  min?: string
  nota?: string
}) {
  const { t } = useTranslation('rh')
  return (
    <div className="space-y-2">
      <Label htmlFor="rh-asignar-fecha">{t('profile.date')}</Label>
      <Input
        id="rh-asignar-fecha"
        type="date"
        className="h-12 text-base"
        min={min}
        max={hoy}
        value={value}
        onChange={e => onChange(e.target.value)}
        data-tour="rh-assign-date"
      />
      {nota && <p className="text-sm text-muted-foreground">{nota}</p>}
      <p className="text-sm text-muted-foreground">{t('profile.dateHelp')}</p>
    </div>
  )
}

/** Spec RH §5.2: informativo, nunca bloquea. */
export function AvisoIndependiente() {
  const { t } = useTranslation('rh')
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-muted p-3 text-sm text-warning-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{t('relation.independentAttendanceWarning')}</span>
    </p>
  )
}

interface Props {
  open: boolean
  staffId: string
  hoy: string
  onClose: () => void
  /** Ya se asignó: la ficha decide si ofrece cambiar el rol (nunca se cambia solo). */
  onAsignado: (puesto: Puesto) => void
}

export function AsignarPuestoDialog({ open, staffId, hoy, onClose, onAsignado }: Props) {
  const { t } = useTranslation('rh')
  const { toast } = useToast()
  const asignar = useAssignPosition()
  // Sólo los activos: sin `includeArchived`.
  const puestos = usePositions({ limit: LIMITE_PUESTOS }, open)
  const lista = puestos.data?.data ?? []

  const [positionId, setPositionId] = useState('')
  const [relacion, setRelacion] = useState<WorkRelation | null>(null)
  const [fecha, setFecha] = useState(hoy)
  const [checa, setChecaEntrada] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Candado SÍNCRONO: el estado no alcanza a apagar «Guardar» entre dos clics seguidos.
  const enVuelo = useRef(false)

  const valido = positionId !== '' && fecha !== '' && fecha <= hoy

  const elegirPuesto = (id: string) => {
    setPositionId(id)
    const p = lista.find(x => x.id === id)
    if (p) setChecaEntrada(p.tracksAttendanceDefault)
  }

  // Sin red el envío está EN PAUSA: cerrar lo quita de la cola de verdad (no sale al volver la red).
  const cerrar = () => {
    if (asignar.isPaused) {
      asignar.cancelarEnPausa()
      enVuelo.current = false
      setGuardando(false)
    }
    onClose()
  }

  const guardar = async () => {
    const puesto = lista.find(x => x.id === positionId)
    if (!valido || !puesto || enVuelo.current) return
    enVuelo.current = true
    setGuardando(true)
    setError(null)
    try {
      await asignar.mutateAsync({ staffId, body: { positionId, relation: relacion, fecha, tracksAttendance: checa } })
      toast({ title: t('profile.assigned') })
      onAsignado(puesto)
      onClose()
    } catch (err) {
      // 400 (fecha futura, periodo cerrado) y 409 (traslape) llegan en español: tal cual.
      setError(textoDelServidor(err) ?? t('positions.errorGeneric'))
    } finally {
      enVuelo.current = false
      setGuardando(false)
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t('profile.assign')}
      contentClassName="bg-muted/30"
      actions={
        <Button className="h-11 cursor-pointer" disabled={!valido || guardando} onClick={guardar} data-tour="rh-assign-save">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('positions.save')}
        </Button>
      }
    >
      <form
        className="mx-auto max-w-xl space-y-4 p-6"
        onSubmit={e => {
          e.preventDefault()
          void guardar()
        }}
      >
        {asignar.isPaused && <AvisoSinConexion texto={t('positions.offlineSave')} dataTour="rh-assign-offline" />}
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          {!puestos.data ? (
            // Sin datos: fallo, sin red (consulta en pausa) o cargando. Nunca un select vacío que parezca «no hay puestos».
            puestos.isError ? (
              <ErrorConReintento texto={t('positions.loadError')} onReintentar={() => void puestos.refetch()} />
            ) : puestos.fetchStatus === 'paused' ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t('profile.positionsOffline')}
              </p>
            ) : (
              <Skeleton className="h-12 w-full" aria-busy="true" />
            )
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.noPositions')}</p>
          ) : (
            <CampoPuesto value={positionId} onChange={elegirPuesto} puestos={lista} total={puestos.data.total} />
          )}
          <CampoRelacion value={relacion} onChange={setRelacion} />
          <CampoFecha value={fecha} onChange={setFecha} hoy={hoy} />
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox id="rh-asignar-checa" className="h-5 w-5" checked={checa} onCheckedChange={v => setChecaEntrada(v === true)} />
            <Label htmlFor="rh-asignar-checa" className="cursor-pointer text-base">
              {t('positions.tracksAttendance')}
            </Label>
          </div>
          {relacion === 'INDEPENDIENTE_FACTURA' && checa && <AvisoIndependiente />}
        </section>
      </form>
    </FullScreenModal>
  )
}
