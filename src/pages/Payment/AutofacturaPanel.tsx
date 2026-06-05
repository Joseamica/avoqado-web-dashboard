/**
 * Autofactura (Flow A) — public self-invoice panel for the digital-receipt page.
 *
 * Mounts ONLY on the public receipt view (`/receipts/public/:accessKey`). A
 * customer who scanned the QR can capture their own fiscal data and stamp a CFDI
 * for their ticket — no login, no dashboard auth.
 *
 * The gate is SERVER-SIDE: the public endpoints below validate the merchant has
 * autofactura enabled, the ticket is paid + in-month + not already invoiced, and
 * rate-limit per IP / access key. The UI never reads dashboard permissions.
 *
 * Fetch pattern mirrors `ReceiptViewer`: plain `axios` against
 * `${VITE_API_URL}/api/v1/public/...` (NO `withCredentials`, NO `api` client),
 * error bodies read from `err.response.data`.
 */

import { useState } from 'react'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Receipt as ReceiptIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  autofacturaReceptorSchema,
  EMPTY_AUTOFACTURA_RECEPTOR,
  type AutofacturaReceptorFormValues,
} from '@/pages/Cfdi/components/receptor-catalog'
import { ReceptorFields } from '@/pages/Cfdi/components/receptor-fields'

const API_BASE = import.meta.env.VITE_API_URL

/** Stamped CFDI as returned by the public endpoints. */
interface AutofacturaCfdi {
  uuid: string
  status?: string
  serie?: string
  folio?: string
  pdfUrl?: string
  xmlUrl?: string
}

/** A status read where the ticket is already invoiced (STAMPED). */
function isStamped(cfdi: AutofacturaCfdi | null | undefined): cfdi is AutofacturaCfdi {
  if (!cfdi) return false
  // Treat a present cfdi with a downloadable PDF (or an explicit STAMPED status) as invoiced.
  return cfdi.status === 'STAMPED' || !!cfdi.pdfUrl || !!cfdi.uuid
}

type ResultState =
  | { kind: 'idle' }
  | { kind: 'success'; cfdi: AutofacturaCfdi }
  | { kind: 'validation'; reasons: string[] }
  | { kind: 'pacRejected' }
  | { kind: 'forbidden' }
  | { kind: 'conflict'; message: string }
  | { kind: 'notFound' }
  | { kind: 'generic'; message: string }

export function AutofacturaPanel({ accessKey }: { accessKey: string }) {
  const { t } = useTranslation('cfdi')
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  // ── GET status on load: is this ticket already invoiced? ────────────────────
  const {
    data: existingCfdi,
    isLoading: isStatusLoading,
    isError: isStatusError,
  } = useQuery({
    queryKey: ['public-cfdi-status', accessKey],
    queryFn: async () => {
      const res = await axios.get<{ cfdi: AutofacturaCfdi | null }>(`${API_BASE}/api/v1/public/receipt/${accessKey}/cfdi`)
      return res.data?.cfdi ?? null
    },
    enabled: !!accessKey,
    retry: 1,
  })

  const form = useForm<AutofacturaReceptorFormValues>({
    resolver: zodResolver(autofacturaReceptorSchema),
    defaultValues: EMPTY_AUTOFACTURA_RECEPTOR,
  })

  // ── POST autofactura ────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values: AutofacturaReceptorFormValues) => {
      const res = await axios.post<{ cfdi: AutofacturaCfdi }>(`${API_BASE}/api/v1/public/receipt/${accessKey}/cfdi`, {
        rfc: values.rfc.toUpperCase(),
        razonSocial: values.razonSocial,
        regimenFiscal: values.regimenFiscal,
        codigoPostal: values.codigoPostal,
        usoCfdi: values.usoCfdi,
        email: values.email.trim(),
      })
      return res.data.cfdi
    },
    onSuccess: cfdi => {
      setResult({ kind: 'success', cfdi })
      setOpen(false)
    },
    onError: (err: unknown) => {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const data = (axios.isAxiosError(err) ? err.response?.data : undefined) as
        | { error?: string; reasons?: string[] }
        | undefined

      switch (status) {
        case 422: {
          const reasons =
            Array.isArray(data?.reasons) && data.reasons.length > 0
              ? data.reasons
              : [data?.error || t('autofactura.errors.validation')]
          setResult({ kind: 'validation', reasons })
          return
        }
        case 502:
          setResult({ kind: 'pacRejected' })
          return
        case 403:
          setResult({ kind: 'forbidden' })
          setOpen(false)
          return
        case 409:
          // Could be "already invoiced" (then a stamped CFDI exists) or unpaid /
          // out-of-month (no CFDI). Refetch the status: if it now returns a
          // stamped CFDI we render the download state; otherwise the conflict
          // message below stays as the fallback.
          setResult({ kind: 'conflict', message: data?.error || t('autofactura.errors.conflict') })
          setOpen(false)
          queryClient.invalidateQueries({ queryKey: ['public-cfdi-status', accessKey] })
          return
        case 404:
          setResult({ kind: 'notFound' })
          setOpen(false)
          return
        default:
          setResult({
            kind: 'generic',
            message: data?.error || (axios.isAxiosError(err) ? err.message : '') || t('autofactura.errors.generic'),
          })
      }
    },
  })

  const onSubmit = (values: AutofacturaReceptorFormValues) => {
    setResult(prev => (prev.kind === 'validation' ? { kind: 'idle' } : prev))
    mutation.mutate(values)
  }

  const openForm = () => {
    form.reset(EMPTY_AUTOFACTURA_RECEPTOR)
    setResult({ kind: 'idle' })
    setOpen(true)
  }

  // While we don't yet know the status, don't flash a CTA.
  if (isStatusLoading) return null

  // ── Success view (just stamped) ─────────────────────────────────────────────
  if (result.kind === 'success') {
    const cfdi = result.cfdi
    const folio = [cfdi.serie, cfdi.folio].filter(Boolean).join('-')
    return (
      <Card className="border-input shadow-sm">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t('autofactura.success.title')}</h2>
            {folio && <p className="text-sm text-muted-foreground">{t('autofactura.success.folio', { folio })}</p>}
            <p className="text-xs font-mono text-muted-foreground break-all">{t('autofactura.success.uuid', { uuid: cfdi.uuid })}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {cfdi.pdfUrl && (
              <Button asChild size="lg" className="h-12 w-full sm:w-auto">
                <a href={cfdi.pdfUrl} target="_blank" rel="noopener noreferrer" data-tour="autofactura-download-pdf">
                  <Download className="mr-2 h-4 w-4" />
                  {t('autofactura.downloadPdf')}
                </a>
              </Button>
            )}
            {cfdi.xmlUrl && (
              <Button asChild variant="outline" size="lg" className="h-12 w-full sm:w-auto">
                <a href={cfdi.xmlUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  {t('autofactura.downloadXml')}
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Already invoiced (from the GET status on load) → download state ─────────
  if (isStamped(existingCfdi)) {
    const folio = [existingCfdi.serie, existingCfdi.folio].filter(Boolean).join('-')
    return (
      <Card className="border-input shadow-sm">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ReceiptIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('autofactura.alreadyInvoiced')}</p>
            {folio && <p className="text-xs text-muted-foreground">{t('autofactura.success.folio', { folio })}</p>}
          </div>
          {existingCfdi.pdfUrl ? (
            <Button asChild size="lg" className="h-12 w-full sm:w-auto">
              <a href={existingCfdi.pdfUrl} target="_blank" rel="noopener noreferrer" data-tour="autofactura-download-pdf">
                <Download className="mr-2 h-4 w-4" />
                {t('autofactura.downloadPdf')}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('autofactura.noPdf')}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── 409 (unpaid / out-of-month, no stamped cfdi) → informational message ─────
  if (result.kind === 'conflict') {
    return (
      <Card className="border-input shadow-sm">
        <CardContent className="p-6 text-center space-y-2">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
          <p className="text-sm text-muted-foreground">{result.message}</p>
        </CardContent>
      </Card>
    )
  }

  // ── 403 → merchant hasn't enabled autofactura → friendly, no form ───────────
  if (result.kind === 'forbidden') {
    return (
      <Card className="border-input shadow-sm">
        <CardContent className="p-6 text-center space-y-2">
          <ReceiptIcon className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('autofactura.errors.forbidden')}</p>
        </CardContent>
      </Card>
    )
  }

  // ── 404 → receipt not found ─────────────────────────────────────────────────
  if (result.kind === 'notFound') {
    return (
      <Card className="border-input shadow-sm">
        <CardContent className="p-6 text-center space-y-2">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t('autofactura.errors.notFound')}</p>
        </CardContent>
      </Card>
    )
  }

  // If the status GET itself failed, stay silent rather than block the receipt.
  if (isStatusError) return null

  // ── Default: the "Facturar mi cuenta" CTA + the form Dialog ─────────────────
  return (
    <Card className="border-input shadow-sm">
      <CardContent className="p-6 space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ReceiptIcon className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t('autofactura.cta.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('autofactura.cta.subtitle')}</p>
        </div>
        <Button size="lg" className="h-12 w-full sm:w-auto" onClick={openForm} data-tour="autofactura-btn">
          {t('autofactura.cta.button')}
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('autofactura.dialog.title')}</DialogTitle>
            <DialogDescription>{t('autofactura.dialog.subtitle')}</DialogDescription>
          </DialogHeader>

          {result.kind === 'validation' && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {t('autofactura.errors.validation')}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-7 text-sm">
                {result.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {result.kind === 'pacRejected' && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {t('autofactura.errors.pacRejected')}
            </div>
          )}

          {result.kind === 'generic' && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {result.message}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <ReceptorFields form={form} emailRequired />
              <Button type="submit" size="lg" className="h-12 w-full" disabled={mutation.isPending} data-tour="autofactura-submit">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('autofactura.dialog.submit')}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default AutofacturaPanel
