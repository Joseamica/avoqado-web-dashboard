import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { useIssueCfdi } from '@/hooks/use-cfdi'
import { EMPTY_RECEPTOR, receptorSchema, type ReceptorFormValues } from './receptor-catalog'
import { ReceptorFields } from './receptor-fields'

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
  const { t } = useTranslation('cfdi')
  const { toast } = useToast()
  const issueMutation = useIssueCfdi()
  /** Validation reasons from a 422 — rendered inline, modal stays open. */
  const [reasons, setReasons] = useState<string[]>([])

  const form = useForm<ReceptorFormValues>({
    resolver: zodResolver(receptorSchema),
    defaultValues: EMPTY_RECEPTOR,
  })

  // Reset form + reasons whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      form.reset(EMPTY_RECEPTOR)
      setReasons([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => onOpenChange(false)

  const onSubmit = (values: ReceptorFormValues) => {
    setReasons([])
    issueMutation.mutate(
      {
        orderId,
        receptor: {
          rfc: values.rfc.toUpperCase(),
          razonSocial: values.razonSocial,
          regimenFiscal: values.regimenFiscal,
          codigoPostal: values.codigoPostal,
          usoCfdi: values.usoCfdi,
          ...(values.email?.trim() && { email: values.email.trim() }),
        },
      },
      {
        onSuccess: () => {
          // Success toast + list invalidation handled by the hook.
          close()
        },
        onError: (err: any) => {
          const status = err?.response?.status
          const data = err?.response?.data ?? {}

          // 422 — validation failed: render the reasons inline, keep modal open.
          if (status === 422) {
            const list: string[] =
              Array.isArray(data.reasons) && data.reasons.length > 0 ? data.reasons : [data.error || t('issueDialog.errors.validation')]
            setReasons(list)
            return
          }

          // 502 — PAC rejected the stamp.
          if (status === 502) {
            toast({
              title: t('issueDialog.errors.pacRejected'),
              description: data.message || data.error || '',
              variant: 'destructive',
            })
            return
          }

          // 409 — already in process / business rule.
          if (status === 409) {
            toast({ title: t('issueDialog.errors.conflict'), description: data.error || '', variant: 'destructive' })
            return
          }

          // 403 — feature not active or merchant not enabled (upsell).
          if (status === 403) {
            toast({ title: t('issueDialog.errors.forbidden'), description: data.error || '', variant: 'destructive' })
            return
          }

          // 404 — order not found / no fiscal emisor configured.
          if (status === 404) {
            toast({ title: t('issueDialog.errors.notFound'), description: data.error || '', variant: 'destructive' })
            return
          }

          // Anything else (network, 500, ...).
          toast({
            title: t('issueDialog.errors.generic'),
            description: data.message || data.error || err?.message || '',
            variant: 'destructive',
          })
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
        <Button onClick={form.handleSubmit(onSubmit)} disabled={issueMutation.isPending} data-tour="cfdi-issue-submit">
          {issueMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('issueDialog.submit')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl p-6 space-y-5">
        {reasons.length > 0 && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {t('issueDialog.errors.validation')}
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-7 text-sm">
              {reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
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
