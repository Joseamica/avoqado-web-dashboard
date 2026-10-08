import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { usePublishTable } from '@/hooks/useStaffPay'
import { celdasDesdeCuadricula, type Cuadricula } from '../cuadricula'
import type { ReglasPayload } from '../reglas'
import { AvisoSinConexion } from './AvisoSinConexion'
import { CampoVigencia } from './VigenciaConEfecto'
import { useVigenciaSimulada } from '../useVigenciaSimulada'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  maxCount: number
  grid: Cuadricula
  /** Las reglas de clase de la versión (spec §6.6): viajan también al simular, para que el efecto las cuente. */
  reglas: ReglasPayload
  /** «Hoy» en la zona del negocio (YYYY-MM-DD): default de la vigencia. */
  hoy: string
}

export function PublicarTablaModal({ open, onOpenChange, tableId, maxCount, grid, reglas, hoy }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  // La vista previa no escribe: su propia llave (`simulacion`), para que el aviso y la cancelación sean sólo del envío que guarda.
  const simular = usePublishTable(true)
  const publicar = usePublishTable()
  const [guardando, setGuardando] = useState(false)
  // La cuadrícula en edición puede guardar filas por encima del techo: no viajan.
  const cells = useMemo(() => celdasDesdeCuadricula(grid, maxCount), [grid, maxCount])
  // Vista previa del efecto («cambia el pago de 12 clases de septiembre…») cada vez que cambia la fecha.
  const vigencia = useVigenciaSimulada(
    hoy,
    fecha => simular.mutateAsync({ tableId, effectiveFrom: fecha, maxCount, cells, ...reglas, simular: true }),
    tableId,
    simular.isPaused,
  )

  // Cerrar la ventana: sin red el envío está EN PAUSA (C5) y cerrar lo quita de la cola de verdad (no sale al volver la red).
  const cerrar = () => {
    if (publicar.isPaused) {
      publicar.cancelarEnPausa()
      setGuardando(false)
    }
    onOpenChange(false)
  }

  const guardar = async () => {
    if (vigencia.bloqueada || guardando) return
    setGuardando(true)
    try {
      await publicar.mutateAsync({ tableId, effectiveFrom: vigencia.fecha, maxCount, cells, ...reglas })
      toast({ title: t('publish.saved') })
      onOpenChange(false)
    } catch (err) {
      // Una fecha cerrada se explica en línea, con su atajo; lo demás, en un aviso.
      if (!vigencia.tomarError(err)) toast({ title: (err as any)?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t('publish.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" disabled={vigencia.bloqueada || guardando} onClick={guardar} data-tour="staffpay-publish-confirm">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('publish.confirm')}
        </Button>
      }
    >
      <div className="max-w-xl mx-auto space-y-4 p-6">
        {publicar.isPaused && <AvisoSinConexion texto={t('offline.willSendSaveClose')} dataTour="staffpay-publish-offline" />}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <CampoVigencia id="staffpay-vigencia" label={t('publish.effectiveFrom')} textoCalculando={t('publish.effectLoading')} vigencia={vigencia} />
        </section>
      </div>
    </FullScreenModal>
  )
}
