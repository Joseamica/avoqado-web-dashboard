import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useChangeAssignment, usePositions } from '@/hooks/useRh'
import { AvisoSinConexion } from '@/pages/StaffPay/components/AvisoSinConexion'
import { textoDelServidor } from '@/utils/apiError'
import type { Asignacion, Puesto, WorkRelation } from '@/types/rh'
import { AvisoIndependiente, CampoFecha, CampoPuesto, CampoRelacion, LIMITE_PUESTOS, PuestosSinDatos } from './AsignarPuestoDialog'

interface Props {
  open: boolean
  asignacion: Asignacion
  hoy: string
  onClose: () => void
  /** Cambió a OTRO puesto: la ficha decide si ofrece cambiar el rol (nunca se cambia solo). */
  onCambioDePuesto: (puesto: Puesto) => void
}

export function CambiarAsignacionDialog({ open, asignacion: a, hoy, onClose, onCambioDePuesto }: Props) {
  const { t } = useTranslation('rh')
  const { toast } = useToast()
  const cambiar = useChangeAssignment()
  const puestos = usePositions({ limit: LIMITE_PUESTOS }, open)
  const activos = puestos.data?.data ?? []
  // El puesto actual se ofrece aunque ya esté archivado: cambiar sólo la relación no exige otro puesto.
  const lista = activos.some(p => p.id === a.positionId) ? activos : [{ id: a.positionId, name: a.positionName }, ...activos]

  const [positionId, setPositionId] = useState(a.positionId)
  const [relacion, setRelacion] = useState<WorkRelation | null>(a.relation)
  // «Checa entrada y salida» decide si la persona sale en Turnos y Asistencia (un inversionista, no).
  const [checa, setChecaEntrada] = useState(a.tracksAttendance)
  const [fecha, setFecha] = useState(hoy)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enVuelo = useRef(false)

  // Sin cambios no hay nada que guardar (el servidor devolvería la misma). La fecha no puede ser anterior al inicio de esta versión
  // (el mismo día sí: la reemplaza).
  const sinCambios = positionId === a.positionId && relacion === a.relation && checa === a.tracksAttendance
  const valido = !sinCambios && positionId !== '' && fecha !== '' && fecha >= a.effectiveFrom && fecha <= hoy

  const cerrar = () => {
    if (cambiar.isPaused) {
      cambiar.cancelarEnPausa()
      enVuelo.current = false
      setGuardando(false)
    }
    onClose()
  }

  const guardar = async () => {
    if (!valido || enVuelo.current) return
    enVuelo.current = true
    setGuardando(true)
    setError(null)
    try {
      await cambiar.mutateAsync({ assignmentId: a.id, body: { positionId, relation: relacion, fecha, ...(checa !== a.tracksAttendance ? { tracksAttendance: checa } : {}) } })
      toast({ title: t('profile.changed') })
      const nuevo = activos.find(p => p.id === positionId)
      if (positionId !== a.positionId && nuevo) onCambioDePuesto(nuevo)
      onClose()
    } catch (err) {
      // 409 «Esta asignación cambió…», 400 de fecha o periodo cerrado: en español, tal cual.
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
      title={t('profile.changeTitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button className="h-11 cursor-pointer" disabled={!valido || guardando} onClick={guardar} data-tour="rh-change-save">
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
        {cambiar.isPaused && <AvisoSinConexion texto={t('positions.offlineSave')} dataTour="rh-change-offline" />}
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          {/* Sin catálogo (fallo, sin red o cargando) se dice, con «Reintentar»: la relación y la fecha se pueden cambiar igual. */}
          {puestos.data ? <CampoPuesto value={positionId} onChange={setPositionId} puestos={lista} total={puestos.data.total} /> : <PuestosSinDatos q={puestos} />}
          <CampoRelacion value={relacion} onChange={setRelacion} />
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox
              id="rh-cambiar-checa"
              className="h-5 w-5"
              checked={checa}
              onCheckedChange={v => setChecaEntrada(v === true)}
              data-tour="rh-change-tracks-attendance"
            />
            <Label htmlFor="rh-cambiar-checa" className="cursor-pointer text-base">
              {t('positions.tracksAttendance')}
            </Label>
          </div>
          <CampoFecha value={fecha} onChange={setFecha} hoy={hoy} min={a.effectiveFrom} nota={t('profile.changeHelp')} />
          {relacion === 'INDEPENDIENTE_FACTURA' && checa && <AvisoIndependiente />}
        </section>
      </form>
    </FullScreenModal>
  )
}
