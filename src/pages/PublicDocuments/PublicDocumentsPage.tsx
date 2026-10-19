import { useEffect, useState, type DragEvent } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, ArrowUpRight, Check, FileCheck2, FileText, LockKeyhole, Upload } from 'lucide-react'
import avoqadoLogo from '@/assets/logo/avoqado-logo-light.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  createUploadId,
  getDocumentToken,
  publicDocuments,
  type DocumentContact,
  type DocumentRequest,
} from '@/services/publicDocuments.service'
import i18n from './i18n'
import './public-documents.css'

const contactSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  contactName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .transform(value => value.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10}$/)),
  identificationType: z.enum(['INE', 'PASSPORT']),
  privacyAccepted: z.boolean().refine(value => value),
})
type PendingFile = {
  uploadId: string
  key: string
  file: File
  progress: number
  state: 'uploading' | 'error'
  error?: string
  retryable?: boolean
}
const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status
const unavailable = (error: unknown) => [401, 403, 404, 410].includes(statusOf(error) || 0)
const hasFiles = (transfer: DataTransfer | null) => Array.from(transfer?.types || []).includes('Files')

function DocumentForm({ requestId }: { requestId: string }) {
  const { t } = useTranslation('publicDocuments')
  const queryClient = useQueryClient()
  const [token] = useState(() => getDocumentToken(requestId))
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [message, setMessage] = useState('')
  const [linkUnavailable, setLinkUnavailable] = useState(false)
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const queryKey = ['public-document-request', requestId]
  const form = useForm<DocumentContact>({
    resolver: zodResolver(contactSchema),
    defaultValues: { businessName: '', contactName: '', email: '', phone: '', identificationType: 'INE', privacyAccepted: false },
  })
  const identificationType = form.watch('identificationType')
  const request = useQuery({
    queryKey,
    queryFn: () => publicDocuments.get(requestId, token!),
    enabled: Boolean(token),
    networkMode: 'always',
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    document.title = t('title')
    document.documentElement.lang = i18n.language
  }, [t])
  useEffect(() => {
    // File drops outside a requirement must not replace the page and lose the form.
    const preventFileNavigation = (event: globalThis.DragEvent) => {
      if (hasFiles(event.dataTransfer)) event.preventDefault()
    }
    const endDrag = () => setDragTarget(null)
    document.addEventListener('dragover', preventFileNavigation)
    document.addEventListener('drop', preventFileNavigation)
    document.addEventListener('drop', endDrag)
    document.addEventListener('dragend', endDrag)
    return () => {
      document.removeEventListener('dragover', preventFileNavigation)
      document.removeEventListener('drop', preventFileNavigation)
      document.removeEventListener('drop', endDrag)
      document.removeEventListener('dragend', endDrag)
    }
  }, [])

  const handleFailure = (error: unknown, key: string) => {
    if (unavailable(error)) setLinkUnavailable(true)
    else setMessage(key)
  }
  const upload = useMutation({
    mutationFn: (item: PendingFile) =>
      publicDocuments.upload(requestId, token!, item.key, item.file, item.uploadId, percent => {
        setPending(items => items.map(current => (current.uploadId === item.uploadId ? { ...current, progress: percent } : current)))
      }),
    retry: false,
    onSuccess: (document, item) => {
      queryClient.setQueryData<DocumentRequest>(
        queryKey,
        data =>
          data && {
            ...data,
            documents: [...data.documents.filter(existing => existing.id !== document.id), document],
            pendingUploads: data.pendingUploads?.filter(upload => upload.uploadId !== item.uploadId),
          },
      )
      setPending(items => items.filter(current => current.uploadId !== item.uploadId))
    },
    onError: (error, item) => {
      const permanent = [400, 413, 415, 422, 429].includes(statusOf(error) || 0)
      const serverMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message
      setPending(items =>
        items.map(current =>
          current.uploadId === item.uploadId
            ? {
                ...current,
                state: 'error',
                retryable: !permanent,
                error: permanent && typeof serverMessage === 'string' ? serverMessage : undefined,
              }
            : current,
        ),
      )
      if (unavailable(error)) setLinkUnavailable(true)
    },
  })
  const remove = useMutation({
    mutationFn: (documentId: string) => publicDocuments.remove(requestId, token!, documentId),
    retry: false,
    onSuccess: (_data, documentId) =>
      queryClient.setQueryData<DocumentRequest>(
        queryKey,
        data => data && { ...data, documents: data.documents.filter(document => document.id !== documentId) },
      ),
    onError: error => handleFailure(error, 'removeError'),
  })
  const discard = useMutation({
    mutationFn: (item: { uploadId: string }) => publicDocuments.discardUpload(requestId, token!, item.uploadId),
    retry: false,
    onSuccess: async (_data, item) => {
      setPending(items => items.filter(current => current.uploadId !== item.uploadId))
      queryClient.setQueryData<DocumentRequest>(
        queryKey,
        data => data && { ...data, pendingUploads: data.pendingUploads?.filter(upload => upload.uploadId !== item.uploadId) },
      )
      await request.refetch()
    },
    onError: error => handleFailure(error, 'removeError'),
  })
  const submit = useMutation({
    mutationFn: (contact: DocumentContact) => publicDocuments.submit(requestId, token!, contact),
    retry: false,
    onSuccess: () => {
      queryClient.setQueryData<DocumentRequest>(queryKey, data => data && { ...data, status: 'SUBMITTED', documents: [], requirements: [] })
      form.reset()
    },
    onError: error => handleFailure(error, 'submitError'),
  })
  const data = request.data
  const restoredUploads = (data?.pendingUploads || []).filter(item => !pending.some(current => current.uploadId === item.uploadId))
  const busy = pending.some(item => item.state === 'uploading') || remove.isPending || discard.isPending || submit.isPending
  const fulfilled = (key: string) => {
    const files = data?.documents.filter(document => document.key === key) || []
    return (
      files.length > 0 &&
      !(
        key === 'identification' &&
        data?.provider === 'ANGELPAY' &&
        identificationType === 'INE' &&
        files.length < 2 &&
        !files.some(document => document.mimeType === 'application/pdf')
      )
    )
  }
  const required = data?.requirements.filter(requirement => requirement.required) || []
  const completeCount = required.filter(requirement => fulfilled(requirement.key)).length
  const canSubmit = online && !busy && pending.length === 0 && restoredUploads.length === 0 && completeCount === required.length

  const chooseFile = (key: string, file?: File) => {
    if (!data || !file || busy || !online) return
    setMessage('')
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
      !/\.(pdf|jpe?g|png)$/i.test(file.name) ||
      file.size > data.limits.maxFileBytes ||
      file.size === 0
    ) {
      setMessage('invalidFile')
      return
    }
    const requirement = data.requirements.find(item => item.key === key)!
    if (
      data.documents.length + pending.length + restoredUploads.length >= data.limits.maxFiles ||
      data.documents.filter(item => item.key === key).length +
        pending.filter(item => item.key === key).length +
        restoredUploads.filter(item => item.key === key).length >=
        requirement.maxFiles
    ) {
      setMessage('fileLimit')
      return
    }
    const item: PendingFile = { uploadId: createUploadId(), key, file, state: 'uploading', progress: 0 }
    setPending(items => [...items, item])
    upload.mutate(item)
  }
  const dragOver = (event: DragEvent<HTMLElement>, key: string) => {
    if (!hasFiles(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = busy || !online ? 'none' : 'copy'
    if (!busy && online) setDragTarget(key)
  }

  const notice = (title: string, body: string, retry = false) => (
    <section className="document-notice" role="status">
      <h1 className="text-3xl font-semibold tracking-tight">{t(title)}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{t(body)}</p>
      {retry && (
        <Button className="mt-6 min-h-11" onClick={() => void request.refetch()}>
          {t('retry')}
        </Button>
      )}
    </section>
  )
  return (
    <main className="document-portal min-h-svh bg-background text-foreground">
      <div className="document-container">
        <header className="document-header">
          <img src={avoqadoLogo} alt={t('brand')} className="document-logo" width="154" height="32" />
          <span className="document-private-label">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            {t('privateSpace')}
          </span>
        </header>
        {!token ? (
          notice('missingTitle', 'missingBody')
        ) : linkUnavailable || unavailable(request.error) || data?.status === 'REVOKED' || data?.status === 'EXPIRED' ? (
          notice('unavailableTitle', 'unavailableBody')
        ) : request.isPending ? (
          <p className="py-16" role="status">
            {t('loading')}
          </p>
        ) : request.isError ? (
          notice('loadError', 'connection', true)
        ) : data?.status === 'SUBMITTED' ? (
          <section className="document-notice" role="status">
            <span className="document-receipt-icon">
              <Check className="size-7" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">{t('successTitle')}</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t('successBody')}</p>
          </section>
        ) : (
          data && (
            <>
              <section className="document-introduction" data-tour="documents-introduction">
                <div className="document-introduction-copy">
                  <p className="document-eyebrow">{t('eyebrow')}</p>
                  <h1 className="document-title">{t('title')}</h1>
                  <p className="mt-4 text-muted-foreground">{t('intro')}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-sm">
                    <span className="document-provider">{t(`provider.${data.provider}`)}</span>
                    <span className="document-entity">{t(`entity.${data.entityType}`)}</span>
                  </div>
                  <div className="document-presentation-links">
                    <Button variant="outline" asChild className="min-h-11" data-tour="documents-terminal-summary">
                      <a href="/presentacion/terminal-avoqado-resumen.pdf" target="_blank" rel="noopener noreferrer">
                        <FileText className="size-4" aria-hidden="true" />
                        {t('terminalSummary')}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    </Button>
                    <a
                      className="document-presentation-full"
                      href="/presentacion/terminal-avoqado.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-tour="documents-terminal-presentation"
                    >
                      {t('terminalPresentation')}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
                <div className="document-terminal-visual">
                  <img
                    className="document-terminal-printer"
                    src="/presentacion/terminal-con-impresora.png"
                    alt={t('terminalPrinterAlt')}
                    width="827"
                    height="724"
                  />
                  <img
                    className="document-terminal-compact"
                    src="/presentacion/terminal-compacta.png"
                    alt={t('terminalCompactAlt')}
                    width="696"
                    height="734"
                  />
                </div>
              </section>
              {!online && (
                <p className="mb-6 rounded-xl bg-muted p-4 text-sm" role="status">
                  {t('offline')}
                </p>
              )}
              <div className="document-layout">
                <form
                  className="document-form"
                  noValidate
                  onSubmit={form.handleSubmit(
                    contact => {
                      if (canSubmit) {
                        setMessage('')
                        submit.mutate(contact)
                      }
                    },
                    () => setMessage('contactError'),
                  )}
                >
                  <section data-tour="documents-files" aria-labelledby="documents-heading">
                    <h2 id="documents-heading" className="document-section-title">
                      <span className="document-section-number" aria-hidden="true">
                        1
                      </span>
                      {t('filesTitle')}
                    </h2>
                    <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t('filesHint', { size: data.limits.maxFileBytes / 1024 / 1024 })}
                    </p>
                    <p className="document-completion" aria-live="polite">
                      <FileCheck2 className="size-4" aria-hidden="true" />
                      {t('savedCount', { count: completeCount, total: required.length })}
                    </p>
                    {data.requirements.map((requirement, index) => (
                      <section
                        key={requirement.key}
                        className="document-requirement"
                        data-tour={`documents-${requirement.key}`}
                        data-drag-active={!busy && online && dragTarget === requirement.key}
                        aria-labelledby={`heading-${requirement.key}`}
                        onDragEnter={event => dragOver(event, requirement.key)}
                        onDragOver={event => dragOver(event, requirement.key)}
                        onDragLeave={event => {
                          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
                          setDragTarget(current => (current === requirement.key ? null : current))
                        }}
                        onDrop={event => {
                          if (!hasFiles(event.dataTransfer)) return
                          event.preventDefault()
                          setDragTarget(null)
                          if (busy || !online) return
                          if (event.dataTransfer.files.length !== 1) {
                            setMessage('oneFileAtATime')
                            return
                          }
                          chooseFile(requirement.key, event.dataTransfer.files[0])
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 id={`heading-${requirement.key}`} className="document-file-heading">
                            <span className="document-file-number" aria-hidden="true">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            {requirement.label}
                          </h3>
                          <span className="document-required-label">{t(requirement.required ? 'required' : 'optional')}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{requirement.description}</p>
                        {requirement.key === 'identification' && <p className="mt-2 text-sm text-muted-foreground">{t('ineHint')}</p>}
                        <ul className="space-y-3 pt-3">
                          {data.documents
                            .filter(document => document.key === requirement.key)
                            .map(document => (
                              <li key={document.id} className="document-saved-file flex items-center gap-3 rounded-lg p-3">
                                <FileText className="size-5 shrink-0" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-sm">{document.fileName}</p>
                                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Check className="size-3" aria-hidden="true" />
                                    {t('saved')}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-11"
                                  disabled={busy || !online}
                                  aria-label={t('removeLabel', { name: document.fileName })}
                                  onClick={() => {
                                    setMessage('')
                                    remove.mutate(document.id)
                                  }}
                                >
                                  {t('remove')}
                                </Button>
                              </li>
                            ))}
                        </ul>
                        {restoredUploads
                          .filter(item => item.key === requirement.key)
                          .map(item => (
                            <div key={item.uploadId} className="mt-3 rounded-lg border border-input p-3">
                              <p className="break-words text-sm">{item.fileName}</p>
                              <p className="my-2 text-sm text-muted-foreground">{t('restoredUpload')}</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-11"
                                disabled={busy || !online}
                                onClick={() => {
                                  setMessage('')
                                  discard.mutate(item)
                                }}
                              >
                                {t('remove')}
                              </Button>
                            </div>
                          ))}
                        {pending
                          .filter(item => item.key === requirement.key)
                          .map(item => (
                            <div key={item.uploadId} className="mt-3 rounded-lg border border-input p-3" aria-live="polite">
                              <p className="break-words text-sm">{item.file.name}</p>
                              <p className="my-2 text-xs text-muted-foreground">
                                {item.state === 'error'
                                  ? item.error || t(item.retryable === false ? 'uploadRejected' : 'uploadError')
                                  : item.progress === 100
                                    ? t('confirming')
                                    : item.progress === 0
                                      ? t('uploadingUnknown')
                                      : t('uploading', { percent: item.progress })}
                              </p>
                              {item.state === 'uploading' ? (
                                <Progress value={item.progress} aria-label={item.file.name} />
                              ) : (
                                <div className="flex gap-2">
                                  {item.retryable !== false && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="min-h-11"
                                      disabled={busy || !online}
                                      onClick={() => {
                                        setPending(items =>
                                          items.map(current =>
                                            current.uploadId === item.uploadId ? { ...current, state: 'uploading', progress: 0 } : current,
                                          ),
                                        )
                                        upload.mutate(item)
                                      }}
                                    >
                                      {t('retry')}
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="min-h-11"
                                    disabled={busy || !online}
                                    onClick={() => {
                                      setMessage('')
                                      discard.mutate(item)
                                    }}
                                  >
                                    {t('remove')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        <Label
                          className={`document-upload mt-3 flex min-h-14 items-center gap-3 rounded-lg px-4 focus-within:ring-2 focus-within:ring-ring text-sm font-medium ${busy || !online ? 'opacity-50' : 'cursor-pointer'}`}
                        >
                          <span className="document-upload-icon">
                            <Upload className="size-4" aria-hidden="true" />
                          </span>
                          <span>
                            {t('addFile')}
                            <span id={`drop-hint-${requirement.key}`} className="document-drop-hint">
                              {t(!busy && online && dragTarget === requirement.key ? 'dropFile' : 'dragFile')}
                            </span>
                          </span>
                          <input
                            className="sr-only"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={busy || !online}
                            aria-label={t('uploadLabel', { label: requirement.label })}
                            aria-describedby={`drop-hint-${requirement.key}`}
                            onChange={event => {
                              chooseFile(requirement.key, event.target.files?.[0])
                              event.target.value = ''
                            }}
                          />
                        </Label>
                      </section>
                    ))}
                  </section>
                  <section className="document-contact" data-tour="documents-contact" aria-labelledby="contact-heading">
                    <h2 id="contact-heading" className="document-section-title mb-6">
                      <span className="document-section-number" aria-hidden="true">
                        2
                      </span>
                      {t('contactTitle')}
                    </h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {(['businessName', 'contactName', 'email', 'phone'] as const).map(name => (
                        <div key={name} className="space-y-2">
                          <Label htmlFor={`documents-${name}`}>{t(name)}</Label>
                          <Input
                            id={`documents-${name}`}
                            data-tour={`documents-${name}`}
                            className="h-12 text-base"
                            type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                            autoComplete={
                              name === 'businessName'
                                ? 'organization'
                                : name === 'contactName'
                                  ? 'name'
                                  : name === 'phone'
                                    ? 'tel-national'
                                    : 'email'
                            }
                            maxLength={name === 'phone' ? 20 : name === 'email' ? 254 : 160}
                            aria-invalid={Boolean(form.formState.errors[name])}
                            {...form.register(name)}
                          />
                        </div>
                      ))}
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="documents-identification">{t('identificationType')}</Label>
                        <select
                          id="documents-identification"
                          data-tour="documents-identification-type"
                          className="h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          {...form.register('identificationType')}
                        >
                          <option value="INE">{t('INE')}</option>
                          <option value="PASSPORT">{t('PASSPORT')}</option>
                        </select>
                      </div>
                    </div>
                  </section>
                  <div className="document-consent">
                    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                      {t('purpose', { provider: t(`provider.${data.provider}`) })}
                    </p>
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      {t('privacy')}
                    </a>
                    <Label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-normal leading-relaxed">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        data-tour="documents-privacy"
                        {...form.register('privacyAccepted')}
                      />
                      {t('consent')}
                    </Label>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('memoryHint')}</p>
                  </div>
                  {message && (
                    <p className="mt-5 text-sm text-destructive" role="alert">
                      {t(message, { size: data.limits.maxFileBytes / 1024 / 1024 })}
                    </p>
                  )}
                  <Button
                    className="document-submit mt-6 min-h-12 w-full text-base"
                    type="submit"
                    disabled={!canSubmit}
                    data-tour="documents-submit"
                  >
                    {t(submit.isPending ? 'submitting' : 'submit')}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">{t('submitHint')}</p>
                </form>
              </div>
            </>
          )
        )}
        <footer className="document-footer">
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          {t('security')}
        </footer>
      </div>
    </main>
  )
}
export default function PublicDocumentsPage({ requestId }: { requestId: string }) {
  return (
    <I18nextProvider i18n={i18n}>
      <DocumentForm requestId={requestId} />
    </I18nextProvider>
  )
}
