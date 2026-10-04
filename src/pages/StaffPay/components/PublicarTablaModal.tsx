import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { usePublishTable } from '@/hooks/useStaffPay'
import { celdasDesdeCuadricula, type Cuadricula } from '../cuadricula'
import { CampoVigencia } from './VigenciaConEfecto'
import { useVigenciaSimulada } from '../useVigenciaSimulada'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  maxCount: number
  grid: Cuadricula
  /** «Hoy» en la zona del negocio (YYYY-MM-DD): default de la vigencia. */
  hoy: string
}

export function PublicarTablaModal({ open, onOpenChange, tableId, maxCount, grid, hoy }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  const publicar = usePublishTable()
  const [guardando, setGuardando] = useState(false)
  // La cuadrícula en edición puede guardar filas por encima del techo: no viajan.
  const cells = useMemo(() => celdasDesdeCuadricula(grid, maxCount), [grid, maxCount])
  // Vista previa del efecto («cambia el pago de 12 clases de septiembre…») cada vez que cambia la fecha.
  const vigencia = useVigenciaSimulada(hoy, fecha => publicar.mutateAsync({ tableId, effectiveFrom: fecha, maxCount, cells, simular: true }), tableId)

  const guardar = async () => {
    if (vigencia.bloqueada || guardando) return
    setGuardando(true)
    try {
      await publicar.mutateAsync({ tableId, effectiveFrom: vigencia.fecha, maxCount, cells })
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
      onClose={() => onOpenChange(false)}
      title={t('publish.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" disabled={vigencia.bloqueada || guardando} onClick={guardar} data-tour="staffpay-publish-confirm">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('publish.confirm')}
        </Button>
      }
    >
      <div className="max-w-xl mx-auto p-6">
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <CampoVigencia id="staffpay-vigencia" label={t('publish.effectiveFrom')} textoCalculando={t('publish.effectLoading')} vigencia={vigencia} />
        </section>
      </div>
    </FullScreenModal>
  )
}
