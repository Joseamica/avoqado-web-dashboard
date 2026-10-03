import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAssignLevel } from '@/hooks/useStaffPay'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

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
  const [fecha, setFecha] = useState(hoy)
  const [efecto, setEfecto] = useState<number | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const fechaValida = FECHA_ISO.test(fecha)

  useEffect(() => {
    if (!fechaValida) { setEfecto(null); return }
    let vivo = true
    setCalculando(true)
    asignar
      .mutateAsync({ staffId, payLevelId, effectiveFrom: fecha, simular: true })
      .then(r => { if (vivo) setEfecto(r.clasesQueCambian) })
      .catch(() => { if (vivo) setEfecto(null) })
      .finally(() => { if (vivo) setCalculando(false) })
    return () => { vivo = false }
  }, [fecha, staffId, payLevelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!fechaValida || guardando) return
    setGuardando(true)
    try {
      await asignar.mutateAsync({ staffId, payLevelId, effectiveFrom: fecha })
      toast({ title: t('assign.saved') })
      onOpenChange(false)
    } catch (err) {
      toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
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
        <Button className="cursor-pointer" disabled={!fechaValida || guardando} onClick={guardar} data-tour="staffpay-assign-confirm">
          {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('assign.confirm')}
        </Button>
      }
    >
      <div className="max-w-xl mx-auto p-6">
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <p className="text-base font-medium">{t('assign.summary', { name: staffName, level: payLevelName })}</p>
          <div className="space-y-2">
            <Label htmlFor="staffpay-asignar-desde">{t('assign.effectiveFrom')}</Label>
            <Input id="staffpay-asignar-desde" type="date" className="h-12 text-base" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {calculando ? t('assign.effectLoading') : efecto !== null ? t('assign.effect', { count: efecto }) : null}
          </p>
        </section>
      </div>
    </FullScreenModal>
  )
}
