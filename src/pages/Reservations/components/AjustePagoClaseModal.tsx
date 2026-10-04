import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useAdjustClass } from '@/hooks/useStaffPay'
import { useVenueDateTime } from '@/utils/datetime'
import type { AjusteClaseInput, PagoDeClaseDto } from '@/types/staffPay'
import { useAccionDelModal } from '@/pages/StaffPay/accionDelModal'
import { useFocoDeVuelta } from '@/pages/StaffPay/foco'
import { A_MEDIO_ESCRIBIR, MONTO_MAXIMO, MONTO_VALIDO, mensajeLegible } from '@/pages/StaffPay/rangos'

export type ModoAjuste = 'conteo' | 'monto' | 'excluir'

// Límites del servidor: motivo 3..300 (recortado), conteo entero 0..500, monto 0..1,000,000 con hasta 2 decimales.
const MOTIVO_MIN = 3
const MOTIVO_MAX = 300
const CONTEO_MAX = 500
const ENTERO = /^\d+$/

interface Props {
  sessionId: string
  actual: PagoDeClaseDto
  /** Botón con el que se abrió: «No se paga» arranca con el interruptor prendido; conteo/monto lo apagan. */
  modo?: ModoAjuste
  onClose: () => void
}

/** Corregir conteo, ajustar monto o marcar «no se paga». Todo ajuste (y quitarlo) lleva motivo. */
export function AjustePagoClaseModal({ sessionId, actual, modo, onClose }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  const { formatCalendarDate } = useVenueDateTime()
  const guardar = useAdjustClass(sessionId)
  const previo = actual.ajuste
  const [conteo, setConteo] = useState(previo?.payCountOverride != null ? String(previo.payCountOverride) : '')
  const [monto, setMonto] = useState(previo?.payAmountOverride != null ? String(Number(previo.payAmountOverride)) : '')
  const [excluir, setExcluir] = useState(modo === 'excluir' ? true : modo ? false : (previo?.payExcluded ?? false))
  const [motivo, setMotivo] = useState('')
  // El aviso de monto espera a salir del campo mientras se teclea «0.» o «.» (no parpadea).
  const [montoTocado, setMontoTocado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const enVuelo = useRef(false)
  // Una clave por apertura y por acción (full-testing C14): el interceptor reintenta un PUT cuando se pierde la respuesta, y
  // sin clave el server lo registraba dos veces. Los reintentos de ESTE modal usan la misma.
  const [claves, setClaves] = useState(() => ({ guardar: crypto.randomUUID(), quitar: crypto.randomUUID() }))
  // 409 CLAVE_REUTILIZADA (esa clave ya se aplicó con otros valores): se dice en línea y la clave rota, o el modal se atora.
  const [errorClave, setErrorClave] = useState<string | null>(null)
  // Clase ya contabilizada en un cierre: corregirla no toca lo congelado. Se dice ANTES de guardar, no después.
  const origen = actual.periodoOrigen?.estado === 'CLOSED' ? actual.periodoOrigen : null
  const yaPagada = !!actual.lineas?.some(l => l.concepto === 'SERVICE' && l.pagadoEn)

  const conteoValido = conteo === '' || (ENTERO.test(conteo) && Number(conteo) <= CONTEO_MAX)
  const montoValido = monto === '' || (MONTO_VALIDO.test(monto) && Number(monto) <= MONTO_MAXIMO)
  const motivoValido = motivo.trim().length >= MOTIVO_MIN
  // Lo que la clase ya tiene viaja igual si la persona no lo cambió (QA N3): excluir NO borra el conteo ni el monto
  // corregidos (antes viajaban null y, al volver a pagarla, «Ajustar monto» abría vacío y el 7 regresaba a 6). Con el
  // interruptor prendido los campos están apagados: un texto inválido ahí no se guarda, se conserva lo que había.
  const leer = (texto: string, valido: boolean, previoValor: number | null) => (texto === '' ? null : valido ? Number(texto) : previoValor)
  const nuevo: AjusteClaseInput = {
    payCountOverride: leer(conteo, conteoValido, previo?.payCountOverride ?? null),
    payAmountOverride: leer(monto, montoValido, previo?.payAmountOverride != null ? Number(previo.payAmountOverride) : null),
    payExcluded: excluir,
    reason: motivo.trim(),
  }
  // Abrir «Corregir conteo» o «Ajustar monto» en una clase que no se paga la vuelve a pagar: se dice antes de guardar.
  const reincluye = !!previo?.payExcluded && !excluir
  // Sin ajuste previo, guardar «nada» no tiene sentido; con ajuste previo, dejarlo vacío equivale a quitarlo.
  const vacio = nuevo.payCountOverride === null && nuevo.payAmountOverride === null && !nuevo.payExcluded
  const puedeGuardar = motivoValido && (excluir || (conteoValido && montoValido)) && !(vacio && !previo) && !enviando

  const enviar = async (cuerpo: AjusteClaseInput, cual: 'guardar' | 'quitar') => {
    if (enVuelo.current) return
    enVuelo.current = true
    setEnviando(true)
    setErrorClave(null)
    try {
      await guardar.mutateAsync({ ...cuerpo, clientKey: claves[cual] })
      toast({ title: t('adjust.saved') })
      onClose()
    } catch (err) {
      if ((err as { response?: { data?: { code?: string } } } | null)?.response?.data?.code === 'CLAVE_REUTILIZADA') {
        setClaves(c => ({ ...c, [cual]: crypto.randomUUID() }))
        setErrorClave(mensajeLegible(err) ?? t('errors.generic'))
      } else {
        // El mensaje del server, sin «Error de validación: campo:» (full-testing A12).
        toast({ title: mensajeLegible(err) ?? t('errors.generic'), variant: 'destructive' })
      }
    } finally {
      enVuelo.current = false
      setEnviando(false)
    }
  }

  const foco = useFocoDeVuelta()
  const accion = useAccionDelModal(
    <Button type="button" className="cursor-pointer" disabled={!puedeGuardar} onClick={() => void enviar(nuevo, 'guardar')} data-tour="class-pay-adjust-save">
      {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {t('adjust.save')}
    </Button>,
  )

  return (
    <FullScreenModal
      open
      onClose={onClose}
      title={t('adjust.title')}
      contentClassName="bg-muted/30"
      actions={accion.actions}
      onOpenAutoFocus={foco.onOpenAutoFocusPantallaCompleta}
      onCloseAutoFocus={foco.onCloseAutoFocus}
    >
      <div className="max-w-xl mx-auto p-6">
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-5">
          {origen && (
            <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {t(yaPagada ? 'adjust.alreadyPaid' : 'adjust.alreadyCounted', {
                  start: formatCalendarDate(origen.start),
                  end: formatCalendarDate(origen.end),
                })}
              </span>
            </p>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <Switch checked={excluir} onCheckedChange={setExcluir} aria-label={t('adjust.exclude')} />
            <span className="text-base">{t('adjust.exclude')}</span>
          </label>
          {reincluye && <p className="text-sm text-muted-foreground">{t('adjust.reincludeNote')}</p>}
          {errorClave && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/40 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{errorClave}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="class-pay-adjust-count">{t('adjust.count')}</Label>
            <Input
              id="class-pay-adjust-count"
              className="h-12 text-base"
              type="number"
              inputMode="numeric"
              min={0}
              max={CONTEO_MAX}
              step={1}
              disabled={excluir}
              value={conteo}
              placeholder={actual.conteoCalculado != null ? String(actual.conteoCalculado) : ''}
              onChange={e => setConteo(e.target.value)}
              aria-invalid={!conteoValido}
            />
            <p className="text-xs text-muted-foreground">
              {actual.conteoCalculado != null ? t('adjust.countHint', { count: actual.conteoCalculado }) : t('adjust.emptyHint')}
            </p>
            {!excluir && !conteoValido && <p className="text-xs text-destructive">{t('adjust.countInvalid', { max: CONTEO_MAX })}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-pay-adjust-amount">{t('adjust.amount')}</Label>
            <Input
              id="class-pay-adjust-amount"
              className="h-12 text-base"
              type="number"
              inputMode="decimal"
              min={0}
              max={MONTO_MAXIMO}
              step="0.01"
              disabled={excluir}
              value={monto}
              onChange={e => setMonto(e.target.value)}
              onBlur={() => setMontoTocado(true)}
              aria-invalid={!montoValido}
            />
            <p className="text-xs text-muted-foreground">{t('adjust.amountHint')}</p>
            {!excluir && !montoValido && (montoTocado || !A_MEDIO_ESCRIBIR.test(monto)) && (
              <p className="text-xs text-destructive">{t('adjust.amountInvalid')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-pay-adjust-reason">{t('adjust.reason')}</Label>
            <Input
              id="class-pay-adjust-reason"
              className="h-12 text-base"
              maxLength={MOTIVO_MAX}
              value={motivo}
              placeholder={t('adjust.reasonPlaceholder')}
              onChange={e => setMotivo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('adjust.reasonHint', { min: MOTIVO_MIN })}</p>
          </div>

          {previo && (
            <div className="border-t border-border/50 pt-4 space-y-2">
              <p className="text-sm text-muted-foreground">{t('classCard.adjusted', { reason: previo.reason ?? '' })}</p>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={!motivoValido || enviando}
                onClick={() => void enviar({ payCountOverride: null, payAmountOverride: null, payExcluded: false, reason: motivo.trim() }, 'quitar')}
              >
                {t('adjust.clear')}
              </Button>
            </div>
          )}
        </section>
      </div>
      {accion.abajo}
    </FullScreenModal>
  )
}
