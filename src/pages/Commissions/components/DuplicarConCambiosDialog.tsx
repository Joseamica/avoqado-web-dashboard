import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, DollarSign, Loader2, Percent } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { commissionKeys, useUpdateCommissionConfig } from '@/hooks/useCommissions'
import { cn } from '@/lib/utils'
import type { CommissionConfig } from '@/types/commission'
import { useEnvioUnico } from '../envioUnico'
import { crearReemplazo, tipoDelReemplazo } from '../reemplazarEsquema'
import { aCentavos, esMontoFijo, montoFijoValido, textoDeTasa } from '../tasaDelEsquema'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  original: CommissionConfig
  /** Al terminar bien (el original ya quedó desactivado). */
  onHecho?: () => void
}

/**
 * «Duplicar con cambios» (ft-graves, B1; founder, opción A): crea un esquema nuevo con la tasa nueva y todo lo demás del original,
 * y DESPUÉS desactiva el original. Nunca pagan los dos: si crear falla, el original sigue igual; si desactivar falla, se dice y se
 * reintenta sólo la desactivación (sin crear otro).
 */
export default function DuplicarConCambiosDialog({ open, onOpenChange, original, onHecho }: Props) {
  const { t, i18n } = useTranslation('commissions')
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { venueId, fullBasePath } = useCurrentVenue()
  const desactivarOriginal = useUpdateCommissionConfig()
  const envio = useEnvioUnico()

  const [fijo, setFijo] = useState(esMontoFijo(original.calcType))
  const [valor, setValor] = useState('')
  const [nombre, setNombre] = useState(original.name)
  // Crear falló: lo que dijo el servidor (si dijo algo); el original sigue activo y se dice siempre.
  const [error, setError] = useState<{ mensaje: string | null } | null>(null)
  const [originalSigueActivo, setOriginalSigueActivo] = useState(false)
  // El nuevo, una vez creado: reintentar sólo desactiva el original, nunca vuelve a crear.
  const creado = useRef<CommissionConfig | null>(null)

  const numero = valor.trim() === '' ? null : Number(valor)
  const tasa = numero === null || !Number.isFinite(numero) ? null : fijo ? aCentavos(numero) : numero / 100
  const tasaValida = tasa !== null && (fijo ? montoFijoValido(tasa) : tasa > 0 && tasa <= 1)
  const calcType = tipoDelReemplazo(original, fijo)
  const listo = tasaValida && nombre.trim() !== '' && !envio.enviando && !desactivarOriginal.isPending

  const terminar = (nuevo: CommissionConfig) => {
    queryClient.invalidateQueries({ queryKey: commissionKeys.all })
    toast({ title: t('config.replace.done', { nuevo: nombre.trim(), anterior: original.name }) })
    onOpenChange(false)
    onHecho?.()
    navigate(`${fullBasePath}/commissions/config/${nuevo.id}`)
  }

  const reemplazar = async () => {
    if (!venueId || tasa === null || !tasaValida) return
    setError(null)
    const cambio = { name: nombre.trim(), calcType, defaultRate: tasa }
    try {
      const nuevo = await envio.enviar(`reemplazo:${original.id}:${JSON.stringify(cambio)}`, async paso => {
        if (!creado.current) creado.current = await crearReemplazo(venueId, original, cambio, paso)
        return creado.current
      })
      if (!nuevo) return
      await desactivar(nuevo)
    } catch (err: any) {
      // Crear falló: el original sigue activo y nada cambió.
      setError({ mensaje: err?.response?.data?.message ?? null })
    }
  }

  const desactivar = async (nuevo: CommissionConfig) => {
    try {
      await desactivarOriginal.mutateAsync({ configId: original.id, data: { active: false } })
      setOriginalSigueActivo(false)
      terminar(nuevo)
    } catch {
      queryClient.invalidateQueries({ queryKey: commissionKeys.all })
      setOriginalSigueActivo(true)
    }
  }

  const tasaAnterior = textoDeTasa(original.calcType, original.defaultRate, i18n.language)
  const tasaNueva = tasaValida && tasa !== null ? textoDeTasa(calcType, tasa, i18n.language) : '—'
  const enCurso = envio.enviando || desactivarOriginal.isPending

  return (
    <FullScreenModal
      open={open}
      onClose={() => !enCurso && onOpenChange(false)}
      title={t('config.duplicateWithChanges')}
      contentClassName="bg-muted/30 px-4 py-6"
      actions={
        !originalSigueActivo && (
          <Button onClick={reemplazar} disabled={!listo}>
            {enCurso && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('config.replace.confirmButton')}
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-xl space-y-4">
        {originalSigueActivo && creado.current ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('config.replace.originalStillActive', { anterior: original.name })}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{t('config.replace.originalStillActiveHint', { anterior: original.name })}</p>
              <Button variant="outline" onClick={() => desactivar(creado.current!)} disabled={desactivarOriginal.isPending}>
                {desactivarOriginal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('config.replace.retryDeactivate', { anterior: original.name })}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
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

            <p className="rounded-xl border border-input bg-muted/40 p-3 text-sm">
              {t('config.replace.confirm', { nuevo: nombre.trim() || original.name, tasaNueva, anterior: original.name, tasaAnterior })}
            </p>
            {error && (
              <div role="alert" className="space-y-1 text-sm text-destructive">
                {error.mensaje && <p>{error.mensaje}</p>}
                <p>{t('config.replace.createError', { anterior: original.name })}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </FullScreenModal>
  )
}
