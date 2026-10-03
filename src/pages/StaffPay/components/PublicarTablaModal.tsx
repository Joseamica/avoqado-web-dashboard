import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { usePublishTable } from '@/hooks/useStaffPay'
import { celdasDesdeCuadricula, type Cuadricula } from '../cuadricula'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

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
  const [fecha, setFecha] = useState(hoy)
  const [efecto, setEfecto] = useState<number | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const cells = useMemo(() => celdasDesdeCuadricula(grid), [grid])
  const fechaValida = FECHA_ISO.test(fecha)

  // Vista previa del efecto («cambia el pago de N clases») cada vez que cambia la fecha.
  useEffect(() => {
    if (!fechaValida) { setEfecto(null); return }
    let vivo = true
    setCalculando(true)
    publicar
      .mutateAsync({ tableId, effectiveFrom: fecha, maxCount, cells, simular: true })
      .then(r => { if (vivo) setEfecto(r.clasesQueCambian) })
      .catch(() => { if (vivo) setEfecto(null) })
      .finally(() => { if (vivo) setCalculando(false) })
    return () => { vivo = false }
  }, [fecha]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!fechaValida || guardando) return
    setGuardando(true)
    try {
      await publicar.mutateAsync({ tableId, effectiveFrom: fecha, maxCount, cells })
      toast({ title: t('publish.saved') })
      onOpenChange(false)
    } catch (err) {
      toast({ title: (err as any)?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
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
        <Button className="cursor-pointer" disabled={!fechaValida || guardando} onClick={guardar} data-tour="staffpay-publish-confirm">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('publish.confirm')}
        </Button>
      }
    >
      <div className="max-w-xl mx-auto p-6">
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staffpay-vigencia">{t('publish.effectiveFrom')}</Label>
            <Input id="staffpay-vigencia" type="date" className="h-12 text-base" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {calculando ? t('publish.effectLoading') : efecto !== null ? t('publish.effect', { count: efecto }) : null}
          </p>
        </section>
      </div>
    </FullScreenModal>
  )
}
