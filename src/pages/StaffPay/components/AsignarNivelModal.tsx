import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useAssignLevel } from '@/hooks/useStaffPay'
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
  const asignar = useAssignLevel()
  const vigencia = useVigenciaSimulada(
    hoy,
    fecha => asignar.mutateAsync({ staffId, payLevelId, effectiveFrom: fecha, simular: true }),
    `${staffId}:${payLevelId}`,
  )
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (vigencia.bloqueada || guardando) return
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
      setGuardando(false)
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('assign.title', { name: staffName })}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" disabled={vigencia.bloqueada || guardando} onClick={guardar} data-tour="staffpay-assign-confirm">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('assign.confirm')}
        </Button>
      }
    >
      <div className="max-w-xl mx-auto p-6">
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <p className="text-base font-medium">{t('assign.summary', { name: staffName, level: payLevelName })}</p>
          <CampoVigencia id="staffpay-asignar-desde" label={t('assign.effectiveFrom')} textoCalculando={t('assign.effectLoading')} vigencia={vigencia} />
        </section>
      </div>
    </FullScreenModal>
  )
}
