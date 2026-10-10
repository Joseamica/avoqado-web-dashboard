import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useConfirmPriceContract, useIssueCfdi } from '@/hooks/use-cfdi'
import type { CfdiReceptor, IssueCfdiValidationError, PriceContractPreview } from '@/services/cfdi.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { EMPTY_RECEPTOR, receptorSchema, type ReceptorFormValues } from './receptor-catalog'
import { ReceptorFields } from './receptor-fields'
import { avisoDeErrorAlFacturar } from './issueCfdiErrors'

/** Lo que se le manda a «Facturar»: la venta y el receptor tal como se capturó en ese intento. */
interface IntentoDeFacturar {
  orderId: string
  receptor: CfdiReceptor
}

function mismoIntento(a: IntentoDeFacturar, b: IntentoDeFacturar): boolean {
  // Los dos salen de `intentoDesde`, así que las llaves van en el mismo orden.
  return JSON.stringify(a) === JSON.stringify(b)
}

interface IssueCfdiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Order to invoice (Flow B). */
  orderId: string
  /**
   * Optional explicit venue id. The staff hook resolves the venue from the
   * active context, so this is accepted for forward-compat with the public
   * autofactura page (Flow A) — it is not required for staff issuance.
   */
  venueId?: string
}

/**
 * Flow B — "Facturar una cuenta". A FullScreenModal that captures the receptor's
 * fiscal data and emits (stamps) a CFDI for a closed/paid order.
 *
 * The receptor form itself lives in `receptor-fields.tsx` so the public
 * autofactura page (Flow A) can reuse the exact same fields + schema later.
 */
export function IssueCfdiDialog({ open, onOpenChange, orderId }: IssueCfdiDialogProps) {
  const { t, i18n } = useTranslation('cfdi')
  const { toast } = useToast()
  const { can } = useAccess()
  const { formatDate } = useVenueDateTime()
  const issueMutation = useIssueCfdi()
  const confirmMutation = useConfirmPriceContract()
  /** Validation reasons from a 422 — rendered inline, modal stays open. */
  const [reasons, setReasons] = useState<string[]>([])
  /**
   * Vista previa del contrato de precio que trae el 422 cuando lo que bloquea es una venta vieja de IVA mixto
   * sin contrato. Confirmable + `cfdi:configure` ⇒ se ofrece confirmar AQUÍ (nunca `window.confirm`).
   */
  const [priceContract, setPriceContract] = useState<PriceContractPreview | null>(null)
  /** true = se está enseñando el resumen de la venta con «Sí, el precio incluía IVA». */
  const [reviewingPriceContract, setReviewingPriceContract] = useState(false)
  /** Por qué no se pudo confirmar (texto del dashboard; el del servidor si el código no se conoce). */
  const [confirmError, setConfirmError] = useState<string | null>(null)
  /** Ya quedó confirmado pero NO se facturó sola (el receptor se editó): aviso persistente de que falta «Emitir». */
  const [confirmadoSinEmitir, setConfirmadoSinEmitir] = useState(false)
  // La misma regla que el servidor: confirmar exige `cfdi:configure` (de fábrica OWNER y ADMIN).
  const canConfirmPriceContract = can('cfdi:configure')
  /**
   * 🔴 Codex (B3b, código r1, P1 #1): cada vez que el diálogo abre, cierra o cambia de venta empieza otra «sesión».
   * Lo que quedó en vuelo de una sesión anterior (un 422, una confirmación) ya no manda sobre lo que está en pantalla.
   */
  const sesionRef = useRef(0)
  /**
   * El intento EXACTO que produjo el 422 con vista previa. Tras confirmar se reenvía ESTE —nunca lo que diga el
   * formulario en ese momento—: antes se releía el formulario, y cerrar/reabrir con otro receptor mientras se
   * confirmaba facturaba la venta original con el RFC nuevo sin que nadie tocara «Emitir».
   */
  const intentoRef = useRef<{ sesion: number; intento: IntentoDeFacturar } | null>(null)

  const clearPriceContract = () => {
    setPriceContract(null)
    setReviewingPriceContract(false)
    setConfirmError(null)
  }

  const form = useForm<ReceptorFormValues>({
    resolver: zodResolver(receptorSchema),
    defaultValues: EMPTY_RECEPTOR,
  })

  // Reset form + reasons whenever the modal (re)opens. Abrir, cerrar o cambiar de venta abre otra sesión.
  useEffect(() => {
    sesionRef.current += 1
    intentoRef.current = null
    if (open) {
      form.reset(EMPTY_RECEPTOR)
      setReasons([])
      setConfirmadoSinEmitir(false)
      clearPriceContract()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId])

  const close = () => onOpenChange(false)

  // Sin `cfdi:configure` la tarjeta de abajo ya dice «Pídele al dueño…»: el motivo del servidor («confírmalo antes de
  // facturar») contradiría a la tarjeta, así que no se repite en la lista roja.
  const reasonsVisibles = priceContract?.confirmable && !canConfirmPriceContract ? reasons.filter(r => !/confírmalo/i.test(r)) : reasons

  const intentoDesde = (values: ReceptorFormValues): IntentoDeFacturar => ({
    orderId,
    receptor: {
      rfc: values.rfc.toUpperCase(),
      razonSocial: values.razonSocial,
      regimenFiscal: values.regimenFiscal,
      codigoPostal: values.codigoPostal,
      usoCfdi: values.usoCfdi,
      ...(values.email?.trim() && { email: values.email.trim() }),
    },
  })

  const facturar = (intento: IntentoDeFacturar) => {
    const sesion = sesionRef.current
    setReasons([])
    setConfirmadoSinEmitir(false)
    clearPriceContract()
    intentoRef.current = null
    issueMutation.mutate(intento, {
      onSuccess: () => {
        // Success toast + list invalidation handled by the hook.
        close()
      },
      onError: (err: any) => {
        const status = err?.response?.status
        const data = err?.response?.data ?? {}

        // 422 — validation failed: render the reasons inline, keep modal open.
        if (status === 422) {
          // El diálogo se cerró o cambió de venta mientras se facturaba: estos motivos (y su vista previa) son de
          // un intento que ya no está en pantalla. No se pintan, y sobre todo no se ofrece confirmarlos.
          if (sesion !== sesionRef.current) return
          const body = data as Partial<IssueCfdiValidationError>
          const list: string[] =
            Array.isArray(body.reasons) && body.reasons.length > 0 ? body.reasons : [body.error || t('issueDialog.errors.validation')]
          setReasons(list)
          // Sólo viene cuando el bloqueo es el contrato de precio desconocido. Si no es confirmable, el servidor
          // ya puso su motivo en `reasons` en lugar del «confírmalo»: no se agrega nada más.
          const vista = body.priceContract && typeof body.priceContract === 'object' ? body.priceContract : null
          setPriceContract(vista)
          intentoRef.current = vista ? { sesion, intento } : null
          return
        }

        // 502 — PAC rejected the stamp. C2 · ronda QA (D1): con `timbreEnDuda` el PAC NO rechazó: no contestó claro y la factura quedó en
        // espera de confirmación (la conciliación la confirma); volver a emitir no ayuda.
        if (status === 502) {
          toast(
            data.timbreEnDuda
              ? {
                  title: t('issueDialog.errors.pacNoAnswer'),
                  description: t('issueDialog.errors.pacNoAnswerDetail'),
                  variant: 'destructive',
                }
              : { title: t('issueDialog.errors.pacRejected'), description: data.message || data.error || '', variant: 'destructive' },
          )
          return
        }

        // 409 — la venta ya tiene factura vigente, la cancelación anterior sigue en trámite, o hay otra
        // emisión en curso. El texto del servidor dice cuál factura y qué hacer; el título, cuál caso es.
        if (status === 409) {
          toast({ ...avisoDeErrorAlFacturar(409, data, t), variant: 'destructive' })
          return
        }

        // 403 — feature not active or merchant not enabled (upsell).
        if (status === 403) {
          toast({ title: t('issueDialog.errors.forbidden'), description: data.error || '', variant: 'destructive' })
          return
        }

        // 404 — order not found / no fiscal emisor configured.
        if (status === 404) {
          toast({ ...avisoDeErrorAlFacturar(404, data, t), variant: 'destructive' })
          return
        }

        // Anything else (network, 500, ...).
        toast({
          title: t('issueDialog.errors.generic'),
          description: data.message || data.error || err?.message || '',
          variant: 'destructive',
        })
      },
    })
  }

  const onSubmit = (values: ReceptorFormValues) => facturar(intentoDesde(values))

  const confirmPriceContract = () => {
    if (!priceContract) return
    const sesion = sesionRef.current
    const pendiente = intentoRef.current
    setConfirmError(null)
    confirmMutation.mutate(
      // La versión y la huella de lo que la persona VIO: si la venta cambió desde entonces, el servidor no toca nada.
      { orderId, version: priceContract.version, huella: priceContract.huella },
      {
        onSuccess: () => {
          // Se cerró, se reabrió o cambió la venta mientras se confirmaba: la confirmación ya quedó en el servidor (el
          // hook lo avisa), pero lo que está en pantalla es otra sesión. No se toca su estado ni se factura sola.
          if (sesion !== sesionRef.current) return
          // Ya quedó confirmada: esta vista y su «confírmalo» no se vuelven a ofrecer; confirmarla otra vez sólo daría
          // «ya tiene un contrato de precio definido».
          setReasons([])
          clearPriceContract()
          intentoRef.current = null
          // Ya no la bloquea el contrato: se reenvía EXACTAMENTE el intento que produjo el 422, y sólo si el formulario
          // sigue diciendo lo mismo. Si la persona cambió el receptor después, factura ella con «Emitir»: nunca se manda
          // algo distinto de lo que está en pantalla. El formulario se compara NORMALIZADO por el mismo esquema que
          // armó el intento (Codex B3b r2 N2: " MAVERICKS " viajó como "MAVERICKS" y sin normalizar parecía editado).
          const enPantalla = receptorSchema.safeParse(form.getValues())
          if (
            pendiente &&
            pendiente.sesion === sesion &&
            pendiente.intento.orderId === orderId &&
            enPantalla.success &&
            mismoIntento(intentoDesde(enPantalla.data), pendiente.intento)
          ) {
            facturar(pendiente.intento)
          } else {
            // No se factura sola: el toast del hook se va solo, así que el aviso queda en el diálogo.
            setConfirmadoSinEmitir(true)
          }
        },
        onError: (err: any) => {
          if (sesion !== sesionRef.current) return
          const status = err?.response?.status
          const data = err?.response?.data ?? {}
          setReviewingPriceContract(false)
          // 409 (la venta cambió / ya no es confirmable), 404 o 403: esta vista previa ya no sirve y confirmarla otra
          // vez con la misma huella daría lo mismo ⇒ se retira el botón. «Facturar» trae una vista previa nueva.
          if (status === 409 || status === 404 || status === 403) setPriceContract(null)
          // CAMBIO_DESDE_LA_VISTA: el servidor habla en términos del MCP («vista previa»); aquí el texto es del
          // dashboard. Para códigos que el diálogo no conoce se sigue mostrando el del servidor.
          setConfirmError(
            data.code === 'CAMBIO_DESDE_LA_VISTA'
              ? t('issueDialog.priceContract.changedSinceReview', { submit: t('issueDialog.submit') })
              : data.error || data.message || t('issueDialog.priceContract.confirmError'),
          )
        },
      },
    )
  }

  return (
    <FullScreenModal
      open={open}
      onClose={close}
      title={t('issueDialog.title')}
      subtitle={t('issueDialog.subtitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={issueMutation.isPending || confirmMutation.isPending}
          data-tour="cfdi-issue-submit"
        >
          {issueMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('issueDialog.submit')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl p-6 space-y-5">
        {confirmadoSinEmitir && (
          <div role="status" className="rounded-2xl border border-input bg-card p-4 text-sm font-medium">
            {t('issueDialog.priceContract.confirmedManual', { submit: t('issueDialog.submit') })}
          </div>
        )}

        {reasonsVisibles.length > 0 && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {t('issueDialog.errors.validation')}
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-7 text-sm">
              {reasonsVisibles.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {priceContract?.confirmable && canConfirmPriceContract && (
          <section className="rounded-2xl border border-input bg-card p-5 space-y-4" data-tour="cfdi-price-contract">
            {!reviewingPriceContract ? (
              <>
                <p className="text-sm text-muted-foreground">{t('issueDialog.priceContract.explain')}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirmError(null)
                    setReviewingPriceContract(true)
                  }}
                  data-tour="cfdi-price-contract-confirm"
                >
                  {t('issueDialog.priceContract.confirmButton')}
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold">{t('issueDialog.priceContract.reviewTitle')}</h3>
                <dl className="grid grid-cols-1 gap-3 rounded-xl border border-input bg-muted/40 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('issueDialog.priceContract.sale')}</dt>
                    <dd className="font-medium">{t('issueDialog.priceContract.saleNumber', { number: priceContract.orderNumber })}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('issueDialog.priceContract.date')}</dt>
                    <dd className="font-medium">{formatDate(priceContract.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('issueDialog.priceContract.total')}</dt>
                    <dd className="font-medium">{Currency(priceContract.totalMxn, false, i18n.language)}</dd>
                  </div>
                </dl>
                <p className="text-sm text-muted-foreground">{t('issueDialog.priceContract.reviewNote')}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setReviewingPriceContract(false)}
                    disabled={confirmMutation.isPending}
                  >
                    {t('issueDialog.priceContract.back')}
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmPriceContract}
                    disabled={confirmMutation.isPending}
                    data-tour="cfdi-price-contract-confirm-yes"
                  >
                    {confirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('issueDialog.priceContract.confirmYes')}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {priceContract?.confirmable && !canConfirmPriceContract && (
          <section className="rounded-2xl border border-input bg-card p-5 text-sm space-y-1">
            <p className="font-medium">{t('issueDialog.priceContract.needsConfirmation')}</p>
            <p className="text-muted-foreground">{t('issueDialog.priceContract.askOwner')}</p>
          </section>
        )}

        {confirmError && (
          <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive space-y-1">
            <p>{confirmError}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <ReceptorFields form={form} />
          </form>
        </Form>
      </div>
    </FullScreenModal>
  )
}

export default IssueCfdiDialog
