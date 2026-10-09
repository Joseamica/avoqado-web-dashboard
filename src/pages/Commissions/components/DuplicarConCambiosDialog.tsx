import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { DollarSign, Info, Loader2, Percent } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { commissionKeys } from '@/hooks/useCommissions'
import { cn } from '@/lib/utils'
import { commissionService } from '@/services/commission.service'
import type { CommissionConfig } from '@/types/commission'
import { quedoEnDuda, useEnvioUnico } from '../envioUnico'
import { cambiosDelReemplazo, tipoDelReemplazo } from '../reemplazarEsquema'
import { aCentavos, esMontoFijo, montoFijoValido, textoDeTasa } from '../tasaDelEsquema'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  original: CommissionConfig
  /** Al terminar (reemplazado, o ya no había nada que reemplazar): cierra el editor. */
  onHecho?: () => void
}

type Falla = { tipo: 'rechazo'; mensaje: string | null } | { tipo: 'sinRespuesta' }
const codigo = (err: unknown) => (err as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code

/**
 * «Duplicar con cambios» (ft-graves, B1; founder, opción A): UNA llamada al reemplazo atómico del servidor. El nuevo, con la tasa
 * nueva y todo lo demás del original, rige desde ahora y el original queda desactivado en la misma transacción: nunca pagan los
 * dos y, si algo falla, no cambia nada.
 */
export default function DuplicarConCambiosDialog({ open, onOpenChange, original, onHecho }: Props) {
  const { t, i18n } = useTranslation('commissions')
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { venueId, fullBasePath } = useCurrentVenue()
  const envio = useEnvioUnico()

  const [fijo, setFijo] = useState(esMontoFijo(original.calcType))
  const [valor, setValor] = useState('')
  const [nombre, setNombre] = useState(original.name)
  const [falla, setFalla] = useState<Falla | null>(null)

  const numero = valor.trim() === '' ? null : Number(valor)
  const tasa = numero === null || !Number.isFinite(numero) ? null : fijo ? aCentavos(numero) : numero / 100
  const tasaValida = tasa !== null && (fijo ? montoFijoValido(tasa) : tasa > 0 && tasa <= 1)
  const calcType = tipoDelReemplazo(original, fijo)
  const listo = tasaValida && nombre.trim() !== '' && !envio.enviando

  const cerrarTodo = () => {
    queryClient.invalidateQueries({ queryKey: commissionKeys.all })
    onOpenChange(false)
    onHecho?.()
  }

  const reemplazar = async () => {
    if (!venueId || tasa === null || !tasaValida) return
    setFalla(null)
    const cambios = cambiosDelReemplazo(original, { name: nombre.trim(), calcType, defaultRate: tasa })
    try {
      const nuevo = await envio.enviar(`reemplazo:${original.id}:${JSON.stringify(cambios)}`, paso =>
        paso('reemplazo', clave => commissionService.replaceConfig(venueId, original.id, cambios, clave)),
      )
      if (!nuevo) return
      toast({ title: t('config.replace.done', { nuevo: nombre.trim(), anterior: original.name }) })
      cerrarTodo()
      navigate(`${fullBasePath}/commissions/config/${nuevo.id}`)
    } catch (err: any) {
      if (codigo(err) === 'ESQUEMA_YA_INACTIVO') {
        // Otro reemplazo ganó o alguien lo desactivó: se recarga y se dice; no hay nada que reintentar.
        toast({ title: t('config.replace.alreadyInactive', { anterior: original.name }), variant: 'destructive' })
        cerrarTodo()
        return
      }
      setFalla(quedoEnDuda(err) ? { tipo: 'sinRespuesta' } : { tipo: 'rechazo', mensaje: err?.response?.data?.message ?? null })
    }
  }

  const tasaAnterior = textoDeTasa(original.calcType, original.defaultRate, i18n.language)
  const tasaNueva = tasaValida && tasa !== null ? textoDeTasa(calcType, tasa, i18n.language) : '—'

  return (
    <FullScreenModal
      open={open}
      onClose={() => !envio.enviando && onOpenChange(false)}
      title={t('config.duplicateWithChanges')}
      contentClassName="bg-muted/30 px-4 py-6"
      actions={
        <Button onClick={reemplazar} disabled={!listo}>
          {envio.enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('config.replace.confirmButton')}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-border/50 bg-card p-6">
        <p className="text-sm text-muted-foreground">{t('config.replace.intro')}</p>

        <div className="inline-flex rounded-full bg-muted/50 p-1">
          {[false, true].map(esFijo => (
            <button
              key={String(esFijo)}
              type="button"
              aria-pressed={fijo === esFijo}
              onClick={() => {
                setFijo(esFijo)
                setValor('')
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                fijo === esFijo ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {esFijo ? <DollarSign className="h-4 w-4" /> : <Percent className="h-4 w-4" />}
              {esFijo ? t('wizard.step2.fixedAmount') : t('wizard.step2.percentage')}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reemplazo-tasa">{t('config.replace.rate')}</Label>
          <div className="relative max-w-[12rem]">
            {fijo && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>}
            <Input
              id="reemplazo-tasa"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              aria-invalid={valor !== '' && !tasaValida}
              className={cn('h-12 text-base', fijo ? 'pl-7' : 'pr-8')}
            />
            {!fijo && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>}
          </div>
          {valor !== '' && !tasaValida && (
            <p className="text-sm text-destructive">{fijo ? t('wizard.step2.fixedAmountRange') : t('config.replace.rateRange')}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reemplazo-nombre">{t('config.name')}</Label>
          <Input id="reemplazo-nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="h-12 text-base" />
        </div>

        <div className="space-y-2 rounded-xl border border-input bg-muted/40 p-3 text-sm">
          <p>{t('config.replace.confirm', { nuevo: nombre.trim() || original.name, tasaNueva, anterior: original.name, tasaAnterior })}</p>
          {calcType === 'TIERED' && (
            <p className="flex gap-2 text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('config.replace.tieredResetHint')}</span>
            </p>
          )}
        </div>

        {falla && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            {falla.tipo === 'rechazo' && falla.mensaje && <p>{falla.mensaje}</p>}
            <p>{falla.tipo === 'rechazo' ? t('config.replace.createError', { anterior: original.name }) : t('config.replace.noResponse')}</p>
          </div>
        )}
      </div>
    </FullScreenModal>
  )
}
