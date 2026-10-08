import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useAssignLevel } from '@/hooks/useStaffPay'
import { AvisoSinConexion } from './AvisoSinConexion'
import { CampoVigencia } from './VigenciaConEfecto'
import { useVigenciaSimulada } from '../useVigenciaSimulada'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string
  staffName: string
  payLevelId: string
  payLevelName: string
  /** «Hoy» en la zona del negocio (YYYY-MM-DD): default de la vigencia. */
  hoy: string
}

/** Cambiar el nivel de una persona: primero dice cuántas clases cambian (simulación) y sólo escribe al confirmar. */
export function AsignarNivelModal({ open, onOpenChange, staffId, staffName, payLevelId, payLevelName, hoy }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  // La vista previa no escribe: su propia llave (`simulacion`), para que el aviso y la cancelación sean sólo del envío que guarda.
  const simular = useAssignLevel(true)
  const asignar = useAssignLevel()
  const vigencia = useVigenciaSimulada(
    hoy,
    fecha => simular.mutateAsync({ staffId, payLevelId, effectiveFrom: fecha, simular: true }),
    `${staffId}:${payLevelId}`,
    simular.isPaused,
  )
  const [guardando, setGuardando] = useState(false)
  // Candado SÍNCRONO (revisión de E6b): el estado no alcanza a apagar el botón entre dos clics seguidos.
  const enVuelo = useRef(false)

  // Cerrar la ventana: sin red el envío está EN PAUSA (C5) y cerrar lo quita de la cola de verdad (no sale al volver la red).
  const cerrar = () => {
    if (asignar.isPaused) {
      asignar.cancelarEnPausa()
      enVuelo.current = false
      setGuardando(false)
    }
    onOpenChange(false)
  }

  const guardar = async () => {
    if (vigencia.bloqueada || guardando || enVuelo.current) return
    enVuelo.current = true
    setGuardando(true)
    try {
      await asignar.mutateAsync({ staffId, payLevelId, effectiveFrom: vigencia.fecha })
      toast({ title: t('assign.saved') })
      onOpenChange(false)
    } catch (err) {
      // Una fecha cerrada se explica en línea, con su atajo; lo demás, en un aviso.
      if (!vigencia.tomarError(err)) {
        toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
      }
    } finally {
      enVuelo.current = false
      setGuardando(false)
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t('assign.title', { name: staffName })}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" disabled={vigencia.bloqueada || guardando} onClick={guardar} data-tour="staffpay-assign-confirm">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('assign.confirm')}
        </Button>
      }
    >
      <div className="max-w-xl mx-auto space-y-4 p-6">
        {asignar.isPaused && <AvisoSinConexion texto={t('offline.willSendSaveClose')} dataTour="staffpay-assign-offline" />}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <p className="text-base font-medium">{t('assign.summary', { name: staffName, level: payLevelName })}</p>
          <CampoVigencia id="staffpay-asignar-desde" label={t('assign.effectiveFrom')} textoCalculando={t('assign.effectLoading')} vigencia={vigencia} />
        </section>
      </div>
    </FullScreenModal>
  )
}
