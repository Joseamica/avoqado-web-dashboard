import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeftRight, Loader2, Send } from 'lucide-react'
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
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PermissionGate } from '@/components/PermissionGate'
import { useAccess } from '@/hooks/use-access'
import { useGiftCardResend } from '@/hooks/use-gift-cards'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import type { GiftCardDeliveryChannel, GiftCardDetail, GiftCardResendBody } from '@/types/giftCard'
import { correoValido, errorDeEntrega, estadoVisible, limpiarTelefono } from '../giftCardText'
import { Avisos, useEnvioDeDialogo } from './GiftCardManagerActions'

/**
 * 1b P1 (E14, E15): cómo va la entrega de UNA tarjeta y, para el gerente, «Reenviar» y «Cambiar destino».
 * - La información se ve con `giftCards:read` (quien abre el detalle); las acciones piden `giftCards:manage` (la ruta
 *   `POST …/resend` del panel, contrato 1b § 8) y el server vuelve a decidir.
 * - 🔴 El destino es `entrega.destino`, ENMASCARADO por el server. El detalle trae además el teléfono y el correo completos
 *   (compatibilidad con la 1a): aquí nunca se pintan.
 * - Sin `entrega` (un server sin S7) no se pinta nada: el detalle se ve como en la 1a.
 * - Las dos acciones siguen el molde de las del gerente (`GiftCardManagerActions`): una llave por operación con la huella del
 *   contenido (`useGiftCardResend`), el intento en duda congelado y guardado, «Intentar otra vez» con la MISMA llave y el MISMO
 *   cuerpo, «Descartar» al reabrir, y la relectura sin esperarla. Reenviar es una confirmación breve (`AlertDialog`); cambiar el
 *   destino es un formulario (`FullScreenModal`, ui-patterns.md).
 */

type Dialogo = 'reenviar' | 'cambiar' | null
/** Un destino escrito (WhatsApp con su teléfono o correo con su correo): el cuerpo de «Cambiar destino». */
type Destino = Extract<GiftCardResendBody, { deliveryChannel: 'WHATSAPP' | 'EMAIL' }>
type CanalDigital = Destino['deliveryChannel']
const CANALES_DIGITALES: readonly CanalDigital[] = ['WHATSAPP', 'EMAIL']
const esDigital = (c: GiftCardDeliveryChannel | undefined): c is CanalDigital => c === 'WHATSAPP' || c === 'EMAIL'
/** El tope del correo en el esquema del server (`resendSchema`, `giftCard.schema.ts`): su 400 no trae `code`. */
const CORREO_MAXIMO = 120

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

/** Reenviar al MISMO destino: no repone nada, así que es una confirmación breve. */
function ReenviarDialog({
  venueId,
  giftCardId,
  destino,
  onClose,
}: {
  venueId: string
  giftCardId: string
  destino: string
  onClose: () => void
}) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const { reenviar, enviando, intentoEnDuda, descartarIntento } = useGiftCardResend(venueId, giftCardId)
  // Un reenvío en duda de una apertura anterior vuelve con su aviso, «Intentar otra vez» (misma llave) y «Descartar».
  const [previo] = useState(() => intentoEnDuda('mismo') != null)
  const envio = useEnvioDeDialogo(previo, { mantieneLaDuda: () => intentoEnDuda('mismo') != null })

  const confirmar = () =>
    envio.correr(
      () => reenviar('mismo', {}),
      () => {
        toast({ title: t('deliveryActions.resendDone', { destino }) })
        onClose()
      },
    )

  const descartar = () => {
    descartarIntento('mismo')
    onClose()
  }

  return (
    <AlertDialog open onOpenChange={abierto => !abierto && !enviando && onClose()}>
      <AlertDialogContent data-tour="gift-card-resend-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deliveryActions.resendTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deliveryActions.resendDescription', { destino })}</AlertDialogDescription>
        </AlertDialogHeader>
        <Avisos
          error={null}
          errorServidor={envio.errorServidor}
          enDuda={envio.enDuda}
          descartar={previo ? descartar : undefined}
          enviando={enviando}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>{t('actions.cancel')}</AlertDialogCancel>
          <Button onClick={() => void confirmar()} disabled={enviando} data-tour="gift-card-resend-confirm">
            {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t(envio.enDuda ? 'actions.retry' : 'deliveryActions.resend')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Cambiar el destino: un formulario (FullScreenModal). Un destino NUEVO repone el código y la liga (E15), por eso el aviso fijo.
 * 🔴 Review Focus 1: si la respuesta se pierde, el destino que se mandó queda CONGELADO (corregir el teléfono sería otra llave y
 * otra reposición a otro teléfono) y «Intentar otra vez» repite ESE cuerpo con la MISMA llave; cerrar y reabrir lo trae de vuelta.
 */
function CambiarDestinoModal({
  venueId,
  giftCardId,
  canalActual,
  onClose,
}: {
  venueId: string
  giftCardId: string
  canalActual: GiftCardDeliveryChannel
  onClose: () => void
}) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const { reenviar, enviando, intentoEnDuda, descartarIntento } = useGiftCardResend(venueId, giftCardId)
  const [previo] = useState<Destino | null>(() => {
    const b = intentoEnDuda('cambiar')
    return b && esDigital(b.deliveryChannel) ? (b as Destino) : null
  })
  const envio = useEnvioDeDialogo(previo != null, {
    mantieneLaDuda: () => intentoEnDuda('cambiar') != null,
    errorDeReintento: (err, estabaEnDuda) => {
      const error = err as { response?: { status?: number; data?: { code?: string } }; config?: { _retry?: unknown } } | null
      const respuesta = error?.response
      return (estabaEnDuda || error?.config?._retry === true) &&
        respuesta?.status === 409 &&
        respuesta.data?.code === 'IDEMPOTENCY_KEY_REUSED'
        ? t('serverCodes.GIFT_CARD_STATE_CHANGED')
        : undefined
    },
  })
  const [canal, setCanal] = useState<CanalDigital>(previo?.deliveryChannel ?? (esDigital(canalActual) ? canalActual : 'WHATSAPP'))
  const [telefono, setTelefono] = useState(previo?.deliveryChannel === 'WHATSAPP' ? previo.recipientPhone : '')
  const [correo, setCorreo] = useState(previo?.deliveryChannel === 'EMAIL' ? previo.recipientEmail : '')
  const [intentado, setIntentado] = useState(false)
  // El cuerpo YA mandado: en duda, el reintento lo reenvía tal cual (misma huella ⇒ misma llave).
  const [congelado, setCongelado] = useState<Destino | null>(previo)

  const telefonoLimpio = limpiarTelefono(telefono)
  const cuerpo: Destino | null =
    canal === 'WHATSAPP'
      ? telefonoLimpio
        ? { deliveryChannel: 'WHATSAPP', recipientPhone: telefonoLimpio }
        : null
      : correoValido(correo)
        ? { deliveryChannel: 'EMAIL', recipientEmail: correo.trim() }
        : null
  const errorDeFormulario = cuerpo ? null : t(canal === 'WHATSAPP' ? 'deliveryActions.errors.phone' : 'deliveryActions.errors.email')

  const enviarDestino = (b: Destino) =>
    envio.correr(
      () => reenviar('cambiar', b),
      () => {
        toast({ title: t('deliveryActions.changeDone') })
        onClose()
      },
    )

  const confirmar = async () => {
    if (envio.enDuda && congelado) return enviarDestino(congelado)
    setIntentado(true)
    if (!cuerpo) return
    setCongelado(cuerpo)
    await enviarDestino(cuerpo)
  }

  const descartar = () => {
    descartarIntento('cambiar')
    onClose()
  }

  return (
    <FullScreenModal
      open
      onClose={() => !enviando && onClose()}
      title={t('deliveryActions.changeDestination')}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={() => void confirmar()} disabled={enviando} data-tour="gift-card-change-destination-confirm">
          {enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {t(envio.enDuda ? 'actions.retry' : 'deliveryActions.changeConfirm')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-6 p-6" data-tour="gift-card-change-destination-dialog">
        <section className="space-y-5 rounded-2xl border border-border/50 bg-card p-6">
          <Alert className="border-input bg-muted/40">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('deliveryActions.changeWarning')}</AlertDescription>
          </Alert>
          {/* En duda los campos quedan congelados: cambiar el destino sería otra operación con otra llave. */}
          <fieldset disabled={enviando || envio.enDuda} className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('deliveryActions.changeChannel')}</p>
              <RadioGroup
                value={canal}
                onValueChange={v => setCanal(v as CanalDigital)}
                aria-label={t('deliveryActions.changeChannel')}
                className="grid grid-cols-2 gap-2"
              >
                {CANALES_DIGITALES.map(c => (
                  <div key={c} className="flex items-center gap-2 rounded-lg border border-input p-3">
                    <RadioGroupItem id={`gift-destination-${c}`} value={c} data-tour={`gift-card-change-destination-${c.toLowerCase()}`} />
                    <Label htmlFor={`gift-destination-${c}`} className="cursor-pointer font-normal">
                      {t(`delivery.${c}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {canal === 'WHATSAPP' ? (
              <div className="space-y-1.5">
                <Label htmlFor="gift-destination-phone">{t('deliveryActions.changePhone')}</Label>
                <Input
                  id="gift-destination-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="55 1234 5678"
                  className="h-12 text-base"
                  data-tour="gift-card-change-destination-input"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="gift-destination-email">{t('deliveryActions.changeEmail')}</Label>
                <Input
                  id="gift-destination-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={correo}
                  onChange={e => setCorreo(e.target.value)}
                  maxLength={CORREO_MAXIMO}
                  className="h-12 text-base"
                  data-tour="gift-card-change-destination-input"
                />
              </div>
            )}
          </fieldset>
          <Avisos
            error={intentado && !envio.enDuda ? errorDeFormulario : null}
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

export function GiftCardDelivery({ venueId, detail }: { venueId: string; detail: GiftCardDetail }) {
  const { t } = useTranslation('giftCards')
  const { formatDateTime } = useVenueDateTime()
  const { can } = useAccess()
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const entrega = detail.entrega
  // Saldo a favor: no se entrega nada (el detalle ya dice «Saldo a favor de …»); ni Reenviar ni Cambiar destino.
  if (!entrega || detail.storeCredit) return null
  const digital = esDigital(entrega.channel)
  // S-4: sólo una tarjeta ACTIVA y vigente se reenvía o cambia de destino. La guardada en la tarjeta de un cliente es de la 1c.
  const conAcciones = estadoVisible(detail) === 'ACTIVE' && entrega.channel !== 'CUSTOMER_CARD'
  // Sin destino digital ni acciones para esta persona no hay nada que decir (el canal ya lo dice el detalle).
  if (!digital && !(conAcciones && can('giftCards:manage'))) return null
  const destino = entrega.destino ?? '—'
  const cerrar = () => setDialogo(null)

  return (
    <section className="space-y-3" data-tour="gift-card-delivery">
      <h3 className="text-sm font-semibold">{t('detail.facts.delivery')}</h3>
      {digital && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Dato label={t('deliveryInfo.destination')} value={destino} />
          {/* «Enviada» = el proveedor la aceptó, nunca «entregada» (E7). */}
          {entrega.status === 'SENT' && entrega.deliveredAt && (
            <Dato label={t('deliveryInfo.sentAt')} value={formatDateTime(entrega.deliveredAt)} />
          )}
          {entrega.intentos > 0 && <Dato label={t('deliveryInfo.attempts')} value={String(entrega.intentos)} />}
        </dl>
      )}
      {/* El motivo, traducido por su código (Review Focus 4): en otro idioma nunca sale el español crudo del server. */}
      {digital && entrega.status === 'FAILED' && (
        <p role="status" className="flex items-start gap-2 text-sm text-destructive" data-tour="gift-card-delivery-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorDeEntrega(entrega, t)}</span>
        </p>
      )}
      {conAcciones && (
        <PermissionGate permission="giftCards:manage">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {digital && (
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setDialogo('reenviar')}
                  data-tour="gift-card-resend"
                >
                  <Send className="mr-1 h-4 w-4" />
                  {t('deliveryActions.resend')}
                </Button>
              )}
              {/* Un destino nuevo repone el código: la misma regla de «Reponer» de la 1a (sin usar y sin guardar, E15). */}
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer disabled:cursor-not-allowed"
                onClick={() => setDialogo('cambiar')}
                disabled={!detail.canReplaceCode}
                data-tour="gift-card-change-destination"
              >
                <ArrowLeftRight className="mr-1 h-4 w-4" />
                {t('deliveryActions.changeDestination')}
              </Button>
            </div>
            {!detail.canReplaceCode && <p className="text-xs text-muted-foreground">{t('deliveryActions.cantChange')}</p>}
          </div>
        </PermissionGate>
      )}
      {dialogo === 'reenviar' && <ReenviarDialog venueId={venueId} giftCardId={detail.id} destino={destino} onClose={cerrar} />}
      {dialogo === 'cambiar' && (
        <CambiarDestinoModal venueId={venueId} giftCardId={detail.id} canalActual={entrega.channel} onClose={cerrar} />
      )}
    </section>
  )
}
