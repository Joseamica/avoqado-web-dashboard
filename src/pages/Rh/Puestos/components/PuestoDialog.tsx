import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { useCreatePosition, useUpdatePosition } from '@/hooks/useRh'
import { AvisoSinConexion } from '@/pages/StaffPay/components/AvisoSinConexion'
import { ROLES_SUGERIBLES, type Puesto, type WorkRelation } from '@/types/rh'

/** Lo que abre el diálogo: un puesto (editar), o un nombre y rol sugeridos (crear). `clave` renueva el formulario en cada apertura. */
export interface DatosPuestoDialog {
  clave: number
  puesto?: Puesto
  name?: string
  suggestedRole?: string
}

const RELACIONES: WorkRelation[] = ['EMPLEADO_NOMINA', 'ASIMILADO', 'INDEPENDIENTE_FACTURA', 'RENTA_SILLA']
/** «Sin definir» manda `null` (el Select de Radix no admite un valor vacío). */
const SIN_DEFINIR = 'none'

/** El servidor ya contesta 400/409 en español: se muestra tal cual. */
const mensajeDe = (err: unknown): string | undefined => (err as { response?: { data?: { message?: string } } })?.response?.data?.message

interface Props {
  open: boolean
  datos: DatosPuestoDialog
  onClose: () => void
}

export function PuestoDialog({ open, datos, onClose }: Props) {
  const { t } = useTranslation('rh')
  const { toast } = useToast()
  const { getDisplayName } = useRoleConfig()
  const crear = useCreatePosition()
  const actualizar = useUpdatePosition()
  const { puesto } = datos

  const [name, setName] = useState(puesto?.name ?? datos.name ?? '')
  const [rol, setRol] = useState(puesto?.suggestedRole ?? datos.suggestedRole ?? '')
  const [relacion, setRelacion] = useState<string>(puesto?.suggestedRelation ?? SIN_DEFINIR)
  const [checa, setChecaEntrada] = useState(puesto?.tracksAttendanceDefault ?? true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Candado SÍNCRONO: el estado no alcanza a apagar «Guardar» entre dos clics seguidos.
  const enVuelo = useRef(false)

  const valido = name.trim() !== '' && rol !== ''
  const enPausa = crear.isPaused || actualizar.isPaused

  // Cerrar la ventana: sin red el envío está EN PAUSA y cerrar lo quita de la cola de verdad (no sale al volver la red).
  const cerrar = () => {
    if (enPausa) {
      crear.cancelarEnPausa()
      actualizar.cancelarEnPausa()
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
    const cuerpo = {
      name: name.trim(),
      suggestedRole: rol,
      suggestedRelation: relacion === SIN_DEFINIR ? null : (relacion as WorkRelation),
      tracksAttendanceDefault: checa,
    }
    try {
      if (puesto) await actualizar.mutateAsync({ id: puesto.id, body: cuerpo })
      else await crear.mutateAsync(cuerpo)
      toast({ title: t(puesto ? 'positions.updated' : 'positions.created') })
      onClose()
    } catch (err) {
      setError(mensajeDe(err) ?? t('positions.errorGeneric'))
    } finally {
      enVuelo.current = false
      setGuardando(false)
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t(puesto ? 'positions.edit' : 'positions.create')}
      contentClassName="bg-muted/30"
      actions={
        <Button className="h-11 cursor-pointer" disabled={!valido || guardando} onClick={guardar} data-tour="rh-positions-save">
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
        {enPausa && <AvisoSinConexion texto={t('positions.offlineSave')} dataTour="rh-positions-offline" />}
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="rh-puesto-nombre">{t('positions.name')}</Label>
            <Input id="rh-puesto-nombre" className="h-12 text-base" maxLength={60} value={name} onChange={e => setName(e.target.value)} data-tour="rh-positions-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rh-puesto-rol">{t('positions.suggestedRole')}</Label>
            <Select name="suggestedRole" value={rol} onValueChange={setRol}>
              <SelectTrigger id="rh-puesto-rol" className="h-12 text-base">
                <SelectValue placeholder={t('positions.rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {ROLES_SUGERIBLES.map(r => (
                  <SelectItem key={r} value={r}>
                    {getDisplayName(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rh-puesto-relacion">{t('positions.suggestedRelation')}</Label>
            <Select name="suggestedRelation" value={relacion} onValueChange={setRelacion}>
              <SelectTrigger id="rh-puesto-relacion" className="h-12 text-base">
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
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox id="rh-puesto-checa" className="h-5 w-5" checked={checa} onCheckedChange={v => setChecaEntrada(v === true)} />
            <Label htmlFor="rh-puesto-checa" className="cursor-pointer text-base">
              {t('positions.tracksAttendance')}
            </Label>
          </div>
          {relacion === 'INDEPENDIENTE_FACTURA' && checa && (
            <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{t('relation.independentAttendanceWarning')}</span>
            </p>
          )}
        </section>
      </form>
    </FullScreenModal>
  )
}
