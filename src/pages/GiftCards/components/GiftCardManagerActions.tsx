import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ban, Copy, KeyRound, Loader2, LockOpen, Scale, XCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { PermissionGate } from '@/components/PermissionGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useGiftCardOperation, useGiftCardSaleCancel } from '@/hooks/use-gift-cards'
import { useToast } from '@/hooks/use-toast'
import { quedoEnDuda } from '@/pages/Commissions/envioUnico'
import { Currency } from '@/utils/currency'
import type { GiftCardDetail, GiftCardOperation, GiftCardReason } from '@/types/giftCard'
import {
  MOTIVOS_POR_ACCION,
  NOTA_MAXIMA,
  accionesDisponibles,
  leerMonto,
  textoDelServidorConCodigo,
  validarAjuste,
  validarMotivoYNota,
  type AccionConMotivo,
  type ErrorDeFormulario,
} from '../giftCardText'

/**
 * Acciones del gerente sobre UNA tarjeta (spec §5.6 y §5.7), todas con `giftCards:manage` y con su `operationKey`:
 * - la llave la genera `useGiftCardOperation`/`useGiftCardSaleCancel` UNA vez por operación (huella = contenido);
 * - si la respuesta no llegó (red o 5xx) el formulario dice «no supimos si se guardó», CONGELA el cuerpo que mandó (cambiar
 *   el contenido sería otra operación con otra llave) y «Intentar otra vez» reenvía ESE cuerpo tal cual, con la misma llave y
 *   SIN volver a validarlo contra el saldo refrescado (auditoría r1, D-1: si el primer intento sí se aplicó, validar contra el
 *   saldo nuevo bloquearía el reintento; el server devuelve el resultado original y no aplica dos veces);
 * - cerrar o desmontar el diálogo abandona el intento (notas 14-15): reabrir es una acción nueva con llave nueva;
 * - un 4xx con `code` enseña el texto del server tal cual y deja corregir; sin `code`, el genérico (notas 10 y 12).
 * Ajustar y Reponer son formularios ⇒ `FullScreenModal` (ui-patterns.md, auditoría r1 D-3); bloquear/desbloquear, iniciar la
 * cancelación y liberarla son confirmaciones breves ⇒ `AlertDialog`. Se montan al abrirse: cada apertura empieza limpia. El
 * estado y el motivo vigente salen del detalle de C4 (`cancel`, `currentBlock`), nunca de la libreta paginada (D-2).
 */

type Dialogo = 'ajustar' | 'bloquear' | 'desbloquear' | 'reponer' | 'cancelar' | 'liberar' | null
type Ajuste = Extract<GiftCardOperation, { tipo: 'AJUSTE' }>
type Reposicion = Extract<GiftCardOperation, { tipo: 'REEMPLAZAR_CODIGO' }>

/** Notas 14-15: cerrar (o desmontarse sin cerrar, p. ej. al cerrar la hoja) abandona el intento en duda; reabrir = llave nueva. */
function useCerrarOlvidando(olvidarIntento: () => void, onClose: () => void) {
  useEffect(() => olvidarIntento, [olvidarIntento])
  return () => {
    olvidarIntento()
    onClose()
  }
}

/** El texto de un error de formulario, con sus montos ya en pesos. */
function useTextoDeError() {
  const { t } = useTranslation('giftCards')
  return (e: ErrorDeFormulario) =>
    t(e.key, { amount: Currency(e.amount ?? 0), min: Currency(e.min ?? 0), max: Currency(e.max ?? 0) })
}

/** Resultado de un envío: listo, en duda (se reintenta con la misma llave) o rechazado con el texto del server. */
function useEnvioDeDialogo() {
  const { t } = useTranslation('giftCards')
  const [enDuda, setEnDuda] = useState(false)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const atrapar = (err: unknown) => {
    if (quedoEnDuda(err)) {
      setEnDuda(true)
      setErrorServidor(null)
    } else {
      setEnDuda(false)
      setErrorServidor(textoDelServidorConCodigo(err) ?? t('errors.generic'))
    }
  }
  const limpiar = () => {
    setEnDuda(false)
    setErrorServidor(null)
  }
  return { enDuda, errorServidor, atrapar, limpiar }
}

function Avisos({ error, errorServidor, enDuda }: { error: string | null; errorServidor: string | null; enDuda: boolean }) {
  const { t } = useTranslation('giftCards')
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {errorServidor && (
        <p role="alert" className="text-sm text-destructive">
          {errorServidor}
        </p>
      )}
      {enDuda && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('actions.inDoubt')}
        </p>
      )}
    </>
  )
}

function Motivos({ accion, value, onChange }: { accion: AccionConMotivo; value: GiftCardReason | ''; onChange: (r: GiftCardReason) => void }) {
  const { t } = useTranslation('giftCards')
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('actions.reason')}</p>
      <RadioGroup value={value} onValueChange={v => onChange(v as GiftCardReason)} aria-label={t('actions.reason')} className="gap-1.5">
        {MOTIVOS_POR_ACCION[accion].map(r => (
          <div key={r} className="flex items-center gap-2">
            <RadioGroupItem id={`gift-${accion}-${r}`} value={r} />
            <Label htmlFor={`gift-${accion}-${r}`} className="cursor-pointer font-normal">
              {t(`reason.${r}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

function Nota({ id, value, onChange, opcional }: { id: string; value: string; onChange: (v: string) => void; opcional?: boolean }) {
  const { t } = useTranslation('giftCards')
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t(opcional ? 'actions.noteOptional' : 'actions.note')}</Label>
      <Textarea id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={NOTA_MAXIMA} rows={3} placeholder={t('actions.notePlaceholder')} />
    </div>
  )
}

/** Formulario de edición ⇒ FullScreenModal (ui-patterns.md): cerrar a la izquierda, título al centro, enviar a la derecha. */
function AjustarModal({ venueId, detail, onClose }: { venueId: string; detail: GiftCardDetail; onClose: () => void }) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const textoDeError = useTextoDeError()
  const { operar, enviando, olvidarIntento } = useGiftCardOperation(venueId, detail.id)
  const cerrar = useCerrarOlvidando(olvidarIntento, onClose)
  const envio = useEnvioDeDialogo()
  const [direccion, setDireccion] = useState<'INCREMENT' | 'DECREMENT'>('INCREMENT')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState<GiftCardReason | ''>('')
  const [nota, setNota] = useState('')
  const [intentado, setIntentado] = useState(false)
  // El cuerpo YA mandado: si quedó en duda, el reintento lo reenvía tal cual (misma huella ⇒ misma llave).
  const [congelado, setCongelado] = useState<Ajuste | null>(null)
  const saldo = detail.balance
  const cantidad = leerMonto(monto)
  const error = validarAjuste({ direccion, cantidad, saldo, motivo, nota })

  const enviarAjuste = async (op: Ajuste) => {
    try {
      const r = await operar(op)
      if (!r) return
      toast({ title: t('actions.adjust.done') })
      cerrar()
    } catch (err) {
      envio.atrapar(err)
    }
  }

  const confirmar = async () => {
    // 🔴 Auditoría r1 (D-1): en duda NO se revalida contra el saldo refrescado (si el primer intento sí se aplicó, el saldo
    // nuevo ya lo trae y la validación bloquearía el reintento). Se reenvía el cuerpo congelado con la misma llave.
    if (envio.enDuda && congelado) return enviarAjuste(congelado)
    setIntentado(true)
    if (error || cantidad == null || !motivo) return
    const op: Ajuste = { tipo: 'AJUSTE', direccion, amount: cantidad, reason: motivo, note: nota.trim() }
    setCongelado(op)
    await enviarAjuste(op)
  }

  return (
    <FullScreenModal
      open
      onClose={() => !enviando && cerrar()}
      title={t('actions.adjust.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={() => void confirmar()} disabled={enviando} data-tour="gift-card-adjust-confirm">
          {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {t(envio.enDuda ? 'actions.retry' : 'actions.adjust.confirm')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 p-6" data-tour="gift-card-adjust-dialog">
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Scale className="h-4 w-4 shrink-0" />
            {t('actions.adjust.description', { balance: Currency(saldo) })}
          </p>
          {/* En duda los campos quedan congelados: cambiar el contenido sería otra operación con otra llave. */}
          <fieldset disabled={enviando || envio.enDuda} className="space-y-5">
            <RadioGroup
              value={direccion}
              onValueChange={v => setDireccion(v as 'INCREMENT' | 'DECREMENT')}
              aria-label={t('actions.adjust.direction')}
              className="grid grid-cols-2 gap-2"
            >
              {(['INCREMENT', 'DECREMENT'] as const).map(d => (
                <div key={d} className="flex items-center gap-2 rounded-lg border border-input p-3">
                  <RadioGroupItem id={`gift-adjust-${d}`} value={d} />
                  <Label htmlFor={`gift-adjust-${d}`} className="cursor-pointer font-normal">
                    {t(d === 'INCREMENT' ? 'actions.adjust.increment' : 'actions.adjust.decrement')}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="space-y-1.5">
              <Label htmlFor="gift-adjust-amount">{t('actions.adjust.amount')}</Label>
              <Input
                id="gift-adjust-amount"
                inputMode="decimal"
                autoComplete="off"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="150.00"
                className="h-12 text-base"
                data-tour="gift-card-adjust-amount"
              />
            </div>
            <Motivos accion="AJUSTE" value={motivo} onChange={setMotivo} />
            <Nota id="gift-adjust-note" value={nota} onChange={setNota} />
          </fieldset>
          {/* En duda no se enseña la validación contra el saldo refrescado: no aplica al reintento. */}
          <Avisos error={intentado && error && !envio.enDuda ? textoDeError(error) : null} errorServidor={envio.errorServidor} enDuda={envio.enDuda} />
        </section>
      </div>
    </FullScreenModal>
  )
}

function BloqueoDialog({
  venueId,
  detail,
  tipo,
  onClose,
}: {
  venueId: string
  detail: GiftCardDetail
  tipo: 'BLOQUEAR' | 'DESBLOQUEAR'
  onClose: () => void
}) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const textoDeError = useTextoDeError()
  const { operar, enviando, olvidarIntento } = useGiftCardOperation(venueId, detail.id)
  const cerrar = useCerrarOlvidando(olvidarIntento, onClose)
  const envio = useEnvioDeDialogo()
  const [motivo, setMotivo] = useState<GiftCardReason | ''>('')
  const [nota, setNota] = useState('')
  const [intentado, setIntentado] = useState(false)
  const error = validarMotivoYNota({ motivo, nota })
  const clave = tipo === 'BLOQUEAR' ? 'block' : 'unblock'

  // En duda los campos están congelados (fieldset): el reintento lleva el MISMO contenido ⇒ la misma huella y la misma llave.
  const confirmar = async () => {
    setIntentado(true)
    if (error || !motivo) return
    try {
      const r = await operar({ tipo, reason: motivo, ...(nota.trim() ? { note: nota.trim() } : {}) })
      if (!r) return
      toast({ title: t(`actions.${clave}.done`) })
      cerrar()
    } catch (err) {
      envio.atrapar(err)
    }
  }

  return (
    <AlertDialog open onOpenChange={abierto => !abierto && !enviando && cerrar()}>
      <AlertDialogContent data-tour={`gift-card-${clave}-dialog`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`actions.${clave}.title`)}</AlertDialogTitle>
          <AlertDialogDescription>{t(`actions.${clave}.description`)}</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset disabled={enviando || envio.enDuda} className="space-y-4">
          <Motivos accion={tipo} value={motivo} onChange={setMotivo} />
          <Nota id={`gift-${clave}-note`} value={nota} onChange={setNota} opcional={motivo !== 'OTHER'} />
        </fieldset>
        <Avisos error={intentado && error ? textoDeError(error) : null} errorServidor={envio.errorServidor} enDuda={envio.enDuda} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>{t('actions.cancel')}</AlertDialogCancel>
          <Button
            variant={tipo === 'BLOQUEAR' ? 'destructive' : 'default'}
            onClick={() => void confirmar()}
            disabled={enviando}
            data-tour={`gift-card-${clave}-confirm`}
          >
            {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t(envio.enDuda ? 'actions.retry' : `actions.${clave}.confirm`)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Formulario de edición ⇒ FullScreenModal. Tras reponer, el MISMO modal enseña el código nuevo una vez. */
function ReponerModal({ venueId, detail, onClose }: { venueId: string; detail: GiftCardDetail; onClose: () => void }) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const { operar, enviando, olvidarIntento } = useGiftCardOperation(venueId, detail.id)
  const cerrar = useCerrarOlvidando(olvidarIntento, onClose)
  const envio = useEnvioDeDialogo()
  const [folio, setFolio] = useState('')
  const [nota, setNota] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [congelado, setCongelado] = useState<Reposicion | null>(null)
  // 🔴 El código nuevo vive SÓLO en este estado: se enseña una vez y se borra al cerrar (spec §4.1).
  const [nuevo, setNuevo] = useState<{ display: string; last4: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const folioLimpio = folio.trim()
  const notaLimpia = nota.trim()
  // Nota 15b: el server topa la nota en 500 (su 400 no trae `code`): se explica antes de mandarla.
  const errorDeFormulario = !folioLimpio
    ? t('actions.replace.errors.folio')
    : notaLimpia.length > NOTA_MAXIMA
      ? t('actions.errors.noteTooLong')
      : null

  const enviarReposicion = async (op: Reposicion) => {
    try {
      const r = await operar(op)
      if (!r) return
      if (r.nuevoCodigo) setNuevo(r.nuevoCodigo)
      else {
        toast({ title: t('actions.replace.doneToast') })
        cerrar()
      }
    } catch (err) {
      envio.atrapar(err)
    }
  }

  const confirmar = async () => {
    // En duda: el MISMO cuerpo con la MISMA llave (si el primero sí repuso, el server devuelve el código vigente).
    if (envio.enDuda && congelado) return enviarReposicion(congelado)
    setIntentado(true)
    if (errorDeFormulario) return
    const op: Reposicion = { tipo: 'REEMPLAZAR_CODIGO', reason: 'LOST_CARD', folio: folioLimpio, ...(notaLimpia ? { note: notaLimpia } : {}) }
    setCongelado(op)
    await enviarReposicion(op)
  }

  const copiar = async () => {
    if (!nuevo) return
    try {
      await navigator.clipboard.writeText(nuevo.display)
      setCopiado(true)
    } catch {
      /* sin portapapeles (http o permiso negado): el código sigue a la vista para anotarlo */
    }
  }

  const terminar = () => {
    setNuevo(null)
    setCopiado(false)
    cerrar()
  }

  return (
    <FullScreenModal
      open
      onClose={() => (nuevo ? terminar() : !enviando && cerrar())}
      title={t(nuevo ? 'actions.replace.newCodeTitle' : 'actions.replace.title')}
      contentClassName="bg-muted/30"
      actions={
        nuevo ? (
          <Button onClick={terminar} data-tour="gift-card-new-code-done">
            {t('actions.replace.done')}
          </Button>
        ) : (
          <Button onClick={() => void confirmar()} disabled={enviando} data-tour="gift-card-replace-confirm">
            {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t(envio.enDuda ? 'actions.retry' : 'actions.replace.confirm')}
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 p-6" data-tour={nuevo ? 'gift-card-new-code-dialog' : 'gift-card-replace-dialog'}>
        {nuevo ? (
          <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-6">
            <p className="text-sm text-muted-foreground">{t('actions.replace.newCodeOnce')}</p>
            <p className="select-all rounded-lg border border-input bg-muted/40 p-4 text-center font-mono text-2xl tracking-wider" data-tour="gift-card-new-code">
              {nuevo.display}
            </p>
            <Button variant="outline" onClick={() => void copiar()}>
              <Copy className="mr-1 h-4 w-4" />
              {t(copiado ? 'actions.replace.copied' : 'actions.replace.copy')}
            </Button>
          </section>
        ) : (
          <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4 shrink-0" />
              {t('actions.replace.description')}
            </p>
            <fieldset disabled={enviando || envio.enDuda} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="gift-replace-folio">{t('actions.replace.folio')}</Label>
                <Input
                  id="gift-replace-folio"
                  autoComplete="off"
                  value={folio}
                  onChange={e => setFolio(e.target.value)}
                  className="h-12 text-base"
                  data-tour="gift-card-replace-folio"
                />
                <p className="text-xs text-muted-foreground">{t('actions.replace.folioHint')}</p>
              </div>
              <Nota id="gift-replace-note" value={nota} onChange={setNota} opcional />
            </fieldset>
            <Avisos error={intentado && !envio.enDuda ? errorDeFormulario : null} errorServidor={envio.errorServidor} enDuda={envio.enDuda} />
          </section>
        )}
      </div>
    </FullScreenModal>
  )
}

function CancelarVentaDialog({
  venueId,
  venta,
  modo,
  onClose,
}: {
  venueId: string
  venta: NonNullable<GiftCardDetail['order']>
  modo: 'cancelar' | 'liberar'
  onClose: () => void
}) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const { iniciar, liberar, enviando, olvidarIntento } = useGiftCardSaleCancel(venueId, venta.id)
  const cerrar = useCerrarOlvidando(olvidarIntento, onClose)
  const envio = useEnvioDeDialogo()
  // F6 del índice: liberar sólo con la confirmación EXPLÍCITA de que la devolución NO se hizo (un timeout no lo prueba).
  const [comprobado, setComprobado] = useState(false)
  const puedeConfirmar = modo === 'cancelar' || comprobado

  const confirmar = async () => {
    if (!puedeConfirmar) return
    envio.limpiar()
    try {
      const r = await (modo === 'cancelar' ? iniciar() : liberar({ confirmacionNoDevuelto: true }))
      if (!r) return
      toast({ title: t(modo === 'cancelar' ? 'actions.cancelSale.started' : 'actions.cancelSale.released') })
      cerrar()
    } catch (err) {
      envio.atrapar(err)
    }
  }

  return (
    <AlertDialog open onOpenChange={abierto => !abierto && !enviando && cerrar()}>
      <AlertDialogContent data-tour={modo === 'cancelar' ? 'gift-card-cancel-sale-dialog' : 'gift-card-release-dialog'}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(modo === 'cancelar' ? 'actions.cancelSale.title' : 'actions.cancelSale.releaseTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {modo === 'cancelar' ? t('actions.cancelSale.descriptionAll') : t('actions.cancelSale.releaseDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {modo === 'cancelar' ? (
          <>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
              <li>{t('actions.cancelSale.step1')}</li>
              <li>{t('actions.cancelSale.step2')}</li>
              <li>{t('actions.cancelSale.step3')}</li>
            </ol>
            <p className="text-xs text-muted-foreground">{t('actions.cancelSale.sameDay')}</p>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-input p-3">
            <Checkbox
              id="gift-release-check"
              checked={comprobado}
              onCheckedChange={v => setComprobado(v === true)}
              disabled={enviando || envio.enDuda}
              data-tour="gift-card-release-check"
            />
            <Label htmlFor="gift-release-check" className="cursor-pointer text-sm font-normal leading-snug">
              {t('actions.cancelSale.releaseCheck')}
            </Label>
          </div>
        )}
        <Avisos error={null} errorServidor={envio.errorServidor} enDuda={envio.enDuda} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>{t('actions.cancel')}</AlertDialogCancel>
          <Button
            variant={modo === 'cancelar' ? 'destructive' : 'default'}
            onClick={() => void confirmar()}
            disabled={enviando || !puedeConfirmar}
            data-tour={modo === 'cancelar' ? 'gift-card-cancel-sale-confirm' : 'gift-card-release-confirm'}
          >
            {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t(envio.enDuda ? 'actions.retry' : modo === 'cancelar' ? 'actions.cancelSale.confirm' : 'actions.cancelSale.releaseConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function GiftCardManagerActions({ venueId, detail }: { venueId: string; detail: GiftCardDetail }) {
  const { t } = useTranslation('giftCards')
  const { fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const a = accionesDisponibles(detail)
  // La venta (cuenta de tarjetas) de este sobre; `null` sólo en datos sin orden.
  const venta = detail.order
  const cerrar = () => setDialogo(null)
  const ninguna = !a.ajustar && !a.bloquear && !a.desbloquear && !a.reponer && !a.cancelarVenta && !a.ventaEnCancelacion
  // «Cancelar venta» lo decide el server (C4 `cancel`, el mismo predicado que iniciarCancelacionDeVenta de B2): si no se
  // puede, el botón se ve apagado y dice por qué. `reason: null` = una tarjeta bloqueada por otro motivo (o sin venta).
  const cancelacion = venta ? detail.cancel : null
  const motivoSinCancelar =
    cancelacion && !cancelacion.allowed && cancelacion.reason !== 'IN_PROGRESS'
      ? (cancelacion.reason ?? (detail.status === 'BLOCKED' ? 'BLOCKED_OTHER' : 'GENERIC'))
      : null

  return (
    <PermissionGate permission="giftCards:manage">
      <section className="space-y-3" data-tour="gift-card-actions">
        <h3 className="text-sm font-semibold">{t('actions.title')}</h3>

        {a.ventaEnCancelacion && venta && (
          <Alert className="border-input bg-muted/40">
            <AlertDescription className="space-y-3 text-sm">
              <p>{t('actions.cancelSale.inProgressAll')}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(`${fullBasePath}/orders/${venta.id}`)} data-tour="gift-card-go-to-sale">
                  {t('actions.cancelSale.goToSale')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialogo('liberar')} data-tour="gift-card-release-cancel">
                  {t('actions.cancelSale.release')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {a.ajustar && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setDialogo('ajustar')} data-tour="gift-card-adjust">
              <Scale className="mr-1 h-4 w-4" />
              {t('actions.adjust.button')}
            </Button>
          )}
          {a.bloquear && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setDialogo('bloquear')} data-tour="gift-card-block">
              <Ban className="mr-1 h-4 w-4" />
              {t('actions.block.button')}
            </Button>
          )}
          {a.desbloquear && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setDialogo('desbloquear')} data-tour="gift-card-unblock">
              <LockOpen className="mr-1 h-4 w-4" />
              {t('actions.unblock.button')}
            </Button>
          )}
          {a.reponer && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setDialogo('reponer')} data-tour="gift-card-replace-code">
              <KeyRound className="mr-1 h-4 w-4" />
              {t('actions.replace.button')}
            </Button>
          )}
          {venta && !a.ventaEnCancelacion && (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer text-destructive disabled:cursor-not-allowed"
              onClick={() => setDialogo('cancelar')}
              disabled={!a.cancelarVenta}
              data-tour="gift-card-cancel-sale"
            >
              <XCircle className="mr-1 h-4 w-4" />
              {t('actions.cancelSale.button')}
            </Button>
          )}
        </div>

        {/* Nota 2: si el server explica por qué no (`cancel.message`), su texto va en vez del genérico del motivo. */}
        {motivoSinCancelar && (
          <p className="text-xs text-muted-foreground" data-tour="gift-card-cancel-sale-reason">
            {cancelacion?.message || t(`actions.cancelSale.blocker.${motivoSinCancelar}`)}
          </p>
        )}
        {ninguna && !motivoSinCancelar && <p className="text-xs text-muted-foreground">{t('actions.none')}</p>}

        {dialogo === 'ajustar' && <AjustarModal venueId={venueId} detail={detail} onClose={cerrar} />}
        {(dialogo === 'bloquear' || dialogo === 'desbloquear') && (
          <BloqueoDialog venueId={venueId} detail={detail} tipo={dialogo === 'bloquear' ? 'BLOQUEAR' : 'DESBLOQUEAR'} onClose={cerrar} />
        )}
        {dialogo === 'reponer' && <ReponerModal venueId={venueId} detail={detail} onClose={cerrar} />}
        {(dialogo === 'cancelar' || dialogo === 'liberar') && venta && (
          <CancelarVentaDialog venueId={venueId} venta={venta} modo={dialogo} onClose={cerrar} />
        )}
      </section>
    </PermissionGate>
  )
}
