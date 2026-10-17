import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
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
import { giftCardKeys, useGiftCardOperation, useGiftCardSaleCancel } from '@/hooks/use-gift-cards'
import { useToast } from '@/hooks/use-toast'
import { quedoEnDuda } from '@/pages/Commissions/envioUnico'
import { Currency } from '@/utils/currency'
import type { GiftCardDetail, GiftCardOperation, GiftCardReason } from '@/types/giftCard'
import {
  MOTIVOS_POR_ACCION,
  NOTA_MAXIMA,
  accionesDisponibles,
  estadoDeCancelacion,
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
 * - D4 r1 (I1): cerrar, desmontar o recargar la página (ronda final) NO olvida un intento en duda (mover un saldo dos veces
 *   es peor que tragarse un ajuste idéntico). Al reabrir, el diálogo sale con el aviso, el MISMO cuerpo prellenado y
 *   congelado, «Intentar otra vez» (misma llave) y «Descartar este intento» (lo que siga es una acción nueva). Un 4xx
 *   definitivo ya no deja nada pendiente;
 * - D4 r1 (I2): con la respuesta del server el diálogo TERMINA en ese mismo instante (cierra, o «Reponer» pasa a su código):
 *   la relectura no se espera y un segundo clic no manda otra operación;
 * - un 4xx con `code` enseña el texto del server tal cual y deja corregir; sin `code`, el genérico (notas 10 y 12).
 * Ajustar y Reponer son formularios ⇒ `FullScreenModal` (ui-patterns.md, auditoría r1 D-3); bloquear/desbloquear, iniciar la
 * cancelación y liberarla son confirmaciones breves ⇒ `AlertDialog`. El estado y el motivo vigente salen del detalle de C4
 * (`cancel`, `currentBlock`), nunca de la libreta paginada (D-2).
 */

type Dialogo = 'ajustar' | 'bloquear' | 'desbloquear' | 'reponer' | 'cancelar' | 'liberar' | null
type Ajuste = Extract<GiftCardOperation, { tipo: 'AJUSTE' }>
type Bloqueo = Extract<GiftCardOperation, { tipo: 'BLOQUEAR' | 'DESBLOQUEAR' }>
type Reposicion = Extract<GiftCardOperation, { tipo: 'REEMPLAZAR_CODIGO' }>
/** Tope del folio: el del zod del server (`giftCard.schema.ts`); su 400 no trae `code`. */
const FOLIO_MAXIMO = 64

/** El texto de un error de formulario, con sus montos ya en pesos. */
function useTextoDeError() {
  const { t } = useTranslation('giftCards')
  return (e: ErrorDeFormulario) =>
    t(e.key, { amount: Currency(e.amount ?? 0), min: Currency(e.min ?? 0), max: Currency(e.max ?? 0) })
}

/**
 * Un envío de diálogo: listo, en duda (se reintenta con la misma llave) o rechazado con el texto del server.
 * D4 r1 (I2): `ocupado` se prende con el clic y tras el éxito se QUEDA prendido: el diálogo terminó y ni un segundo clic ni
 * Enter mandan otra operación (antes, con la relectura pendiente, el botón seguía vivo y el segundo clic llevaba llave nueva).
 */
function useEnvioDeDialogo(enDudaInicial: boolean) {
  const { t } = useTranslation('giftCards')
  const [enDuda, setEnDuda] = useState(enDudaInicial)
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const ocupado = useRef(false)
  const correr = async <T,>(enviar: () => Promise<T | undefined>, alExito: (r: T) => void) => {
    if (ocupado.current) return
    ocupado.current = true
    try {
      const r = await enviar()
      if (r === undefined) ocupado.current = false
      else alExito(r)
    } catch (err) {
      ocupado.current = false
      if (quedoEnDuda(err)) {
        setEnDuda(true)
        setErrorServidor(null)
      } else {
        setEnDuda(false)
        setErrorServidor(textoDelServidorConCodigo(err) ?? t('errors.generic'))
      }
    }
  }
  return { enDuda, errorServidor, correr }
}

/** Avisos del diálogo. `descartar` sólo llega cuando el intento en duda viene de una apertura anterior (D4 r1, I1). */
function Avisos({
  error,
  errorServidor,
  enDuda,
  descartar,
  enviando,
}: {
  error: string | null
  errorServidor: string | null
  enDuda: boolean
  descartar?: () => void
  enviando: boolean
}) {
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
        <div className="space-y-2">
          <p role="status" className="text-sm text-muted-foreground">
            {t(descartar ? 'actions.inDoubtBefore' : 'actions.inDoubt')}
          </p>
          {descartar && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={descartar} disabled={enviando} data-tour="gift-card-discard-attempt">
              {t('actions.discard')}
            </Button>
          )}
        </div>
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
  const { operar, enviando, intentoEnDuda, descartarIntento } = useGiftCardOperation(venueId, detail.id)
  // D4 r1 (I1): un ajuste en duda de una apertura anterior vuelve PRELLENADO y CONGELADO (si hubiera que reescribir la nota,
  // un error de dedo sería otra huella, otra llave y otro movimiento).
  const [previo] = useState<Ajuste | null>(() => {
    const op = intentoEnDuda('AJUSTE')
    return op?.tipo === 'AJUSTE' ? op : null
  })
  const envio = useEnvioDeDialogo(previo != null)
  const [direccion, setDireccion] = useState<'INCREMENT' | 'DECREMENT'>(previo?.direccion ?? 'INCREMENT')
  const [monto, setMonto] = useState(previo ? String(previo.amount) : '')
  const [motivo, setMotivo] = useState<GiftCardReason | ''>(previo?.reason ?? '')
  const [nota, setNota] = useState(previo?.note ?? '')
  const [intentado, setIntentado] = useState(false)
  // El cuerpo YA mandado: si quedó en duda, el reintento lo reenvía tal cual (misma huella ⇒ misma llave).
  const [congelado, setCongelado] = useState<Ajuste | null>(previo)
  const saldo = detail.balance
  const cantidad = leerMonto(monto)
  const error = validarAjuste({ direccion, cantidad, saldo, motivo, nota })

  const enviarAjuste = (op: Ajuste) =>
    envio.correr(
      () => operar(op),
      () => {
        toast({ title: t('actions.adjust.done') })
        onClose()
      },
    )

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

  const descartar = () => {
    descartarIntento('AJUSTE')
    onClose()
  }

  return (
    <FullScreenModal
      open
      onClose={() => !enviando && onClose()}
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
          <Avisos
            error={intentado && error && !envio.enDuda ? textoDeError(error) : null}
            errorServidor={envio.errorServidor}
            enDuda={envio.enDuda}
            descartar={previo ? descartar : undefined}
            enviando={enviando}
          />
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
  const { operar, enviando, intentoEnDuda, descartarIntento } = useGiftCardOperation(venueId, detail.id)
  const [previo] = useState<Bloqueo | null>(() => {
    const op = intentoEnDuda(tipo)
    return op?.tipo === 'BLOQUEAR' || op?.tipo === 'DESBLOQUEAR' ? op : null
  })
  const envio = useEnvioDeDialogo(previo != null)
  const [motivo, setMotivo] = useState<GiftCardReason | ''>(previo?.reason ?? '')
  const [nota, setNota] = useState(previo?.note ?? '')
  const [intentado, setIntentado] = useState(false)
  const [congelado, setCongelado] = useState<Bloqueo | null>(previo)
  const error = validarMotivoYNota({ motivo, nota })
  const clave = tipo === 'BLOQUEAR' ? 'block' : 'unblock'

  const enviarBloqueo = (op: Bloqueo) =>
    envio.correr(
      () => operar(op),
      () => {
        toast({ title: t(`actions.${clave}.done`) })
        onClose()
      },
    )

  const confirmar = async () => {
    if (envio.enDuda && congelado) return enviarBloqueo(congelado)
    setIntentado(true)
    if (error || !motivo) return
    const op: Bloqueo = { tipo, reason: motivo, ...(nota.trim() ? { note: nota.trim() } : {}) }
    setCongelado(op)
    await enviarBloqueo(op)
  }

  const descartar = () => {
    descartarIntento(tipo)
    onClose()
  }

  return (
    <AlertDialog open onOpenChange={abierto => !abierto && !enviando && onClose()}>
      <AlertDialogContent data-tour={`gift-card-${clave}-dialog`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`actions.${clave}.title`)}</AlertDialogTitle>
          <AlertDialogDescription>{t(`actions.${clave}.description`)}</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset disabled={enviando || envio.enDuda} className="space-y-4">
          <Motivos accion={tipo} value={motivo} onChange={setMotivo} />
          <Nota id={`gift-${clave}-note`} value={nota} onChange={setNota} opcional={motivo !== 'OTHER'} />
        </fieldset>
        <Avisos
          error={intentado && error && !envio.enDuda ? textoDeError(error) : null}
          errorServidor={envio.errorServidor}
          enDuda={envio.enDuda}
          descartar={previo ? descartar : undefined}
          enviando={enviando}
        />
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
  const { operar, enviando, intentoEnDuda, descartarIntento } = useGiftCardOperation(venueId, detail.id)
  const [previo] = useState<Reposicion | null>(() => {
    const op = intentoEnDuda('REEMPLAZAR_CODIGO')
    return op?.tipo === 'REEMPLAZAR_CODIGO' ? op : null
  })
  const envio = useEnvioDeDialogo(previo != null)
  const [folio, setFolio] = useState(previo?.folio ?? '')
  const [nota, setNota] = useState(previo?.note ?? '')
  const [intentado, setIntentado] = useState(false)
  const [congelado, setCongelado] = useState<Reposicion | null>(previo)
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

  // I2: con la respuesta pasa DE INMEDIATO a la vista del código (sin botón de confirmar); no espera la relectura.
  const enviarReposicion = (op: Reposicion) =>
    envio.correr(
      () => operar(op),
      r => {
        if (r.nuevoCodigo) setNuevo(r.nuevoCodigo)
        else {
          toast({ title: t('actions.replace.doneToast') })
          onClose()
        }
      },
    )

  const confirmar = async () => {
    // En duda: el MISMO cuerpo con la MISMA llave (si el primero sí repuso, el server devuelve el código vigente).
    if (envio.enDuda && congelado) return enviarReposicion(congelado)
    setIntentado(true)
    if (errorDeFormulario) return
    const op: Reposicion = { tipo: 'REEMPLAZAR_CODIGO', reason: 'LOST_CARD', folio: folioLimpio, ...(notaLimpia ? { note: notaLimpia } : {}) }
    setCongelado(op)
    await enviarReposicion(op)
  }

  const descartar = () => {
    descartarIntento('REEMPLAZAR_CODIGO')
    onClose()
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
    onClose()
  }

  return (
    <FullScreenModal
      open
      onClose={() => (nuevo ? terminar() : !enviando && onClose())}
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
                  maxLength={FOLIO_MAXIMO}
                  className="h-12 text-base"
                  data-tour="gift-card-replace-folio"
                />
                <p className="text-xs text-muted-foreground">{t('actions.replace.folioHint')}</p>
              </div>
              <Nota id="gift-replace-note" value={nota} onChange={setNota} opcional />
            </fieldset>
            <Avisos
              error={intentado && !envio.enDuda ? errorDeFormulario : null}
              errorServidor={envio.errorServidor}
              enDuda={envio.enDuda}
              descartar={previo ? descartar : undefined}
              enviando={enviando}
            />
          </section>
        )}
      </div>
    </FullScreenModal>
  )
}

function CancelarVentaDialog({
  venueId,
  giftCardId,
  venta,
  estado,
  modo,
  onClose,
}: {
  venueId: string
  giftCardId: string
  venta: NonNullable<GiftCardDetail['order']>
  /** La «foto» de la cancelación en el detalle de AHORA (`estadoDeCancelacion`; D4 r1, I1.3). */
  estado: string
  modo: 'cancelar' | 'liberar'
  onClose: () => void
}) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const accion = modo === 'cancelar' ? 'cancel-sale' : 'release-cancel'
  const { iniciar, liberar, enviando, intentoEnDuda, descartarIntento } = useGiftCardSaleCancel(venueId, venta.id)
  // Sólo se ofrece el intento en duda si la foto sigue igual: si cambió, su llave ya no aplica (I1.3).
  const [previo] = useState(() => intentoEnDuda(accion, estado) ?? null)
  const envio = useEnvioDeDialogo(previo != null)
  // La foto con la que se mandó: en duda, el reintento la repite (misma huella ⇒ misma llave) aunque el detalle ya cambió.
  const [congelado, setCongelado] = useState<string | null>(previo?.estado ?? null)
  // F6 del índice: liberar sólo con la confirmación EXPLÍCITA de que la devolución NO se hizo (un timeout no lo prueba). Un
  // intento en duda de liberar ya la llevaba: vuelve marcada (y congelada).
  const [comprobado, setComprobado] = useState(previo != null && modo === 'liberar')
  const puedeConfirmar = modo === 'cancelar' || comprobado

  /**
   * I1.3 y ronda final (Codex #7): tras «liberada», lo que muestra el server en la relectura. Sigue en cancelación ⇒ lo dice.
   * «Se pueden usar otra vez» SÓLO si lo confirma su propio predicado (`cancel.allowed`: sin cancelación y ninguna tarjeta de
   * la venta bloqueada) y ésta no está bloqueada. Lo demás —sin relectura, una hermana bloqueada (`reason: null`), otro día
   * (el server ya no llega a revisar los bloqueos)— no lo confirma ⇒ aviso neutro: que revise cada tarjeta.
   */
  const avisarLiberada = () => {
    const d = queryClient.getQueryData<InfiniteData<GiftCardDetail>>(giftCardKeys.detail(venueId, giftCardId))?.pages[0]
    const aviso =
      d?.cancel.reason === 'IN_PROGRESS' ? 'releaseNotConfirmed' : d?.cancel.allowed && d.status !== 'BLOCKED' ? 'released' : 'releasedCheckCards'
    toast({ title: t(`actions.cancelSale.${aviso}`) })
  }

  // Menor de r1: el reintento NO limpia el estado «en duda» (igual que los otros tres diálogos).
  const confirmar = () => {
    if (!puedeConfirmar) return
    const foto = envio.enDuda && congelado != null ? congelado : estado
    setCongelado(foto)
    return envio.correr(
      () => (modo === 'cancelar' ? iniciar(foto) : liberar({ confirmacionNoDevuelto: true }, foto)),
      ({ refresco }) => {
        onClose()
        if (modo === 'cancelar') toast({ title: t('actions.cancelSale.started') })
        else void refresco.then(avisarLiberada)
      },
    )
  }

  const descartar = () => {
    descartarIntento(accion)
    onClose()
  }

  return (
    <AlertDialog open onOpenChange={abierto => !abierto && !enviando && onClose()}>
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
        <Avisos
          error={null}
          errorServidor={envio.errorServidor}
          enDuda={envio.enDuda}
          descartar={previo ? descartar : undefined}
          enviando={enviando}
        />
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
          <CancelarVentaDialog
            venueId={venueId}
            giftCardId={detail.id}
            venta={venta}
            estado={estadoDeCancelacion(detail)}
            modo={dialogo}
            onClose={cerrar}
          />
        )}
      </section>
    </PermissionGate>
  )
}
