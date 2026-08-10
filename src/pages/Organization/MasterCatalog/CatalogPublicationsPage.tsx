import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  confirmCatalogPublication,
  listCatalogPublications,
  newCatalogIdempotencyKey,
  previewCatalogPublication,
  recoverCatalogPublication,
} from '@/features/master-catalog/api'
import type {
  CatalogPublicationDecision,
  CatalogPublicationListItem,
  CatalogPublicationPreview,
  CatalogPublicationResult,
} from '@/features/master-catalog/types'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'
import CatalogPreviewTable from './components/CatalogPreviewTable'

const OPERATION = 'CATALOG_FIELDS_PUBLISH' as const

export default function CatalogPublicationsPage() {
  const { orgId = '' } = useParams<{ orgId: string }>()
  const { t } = useTranslation('organization')
  const { canMutateContent } = useMasterCatalogAccess({ orgId })
  const [catalogItemId, setCatalogItemId] = useState('')
  const [venueId, setVenueId] = useState('')
  const [productId, setProductId] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [preview, setPreview] = useState<CatalogPublicationPreview | null>(null)
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, { decision: CatalogPublicationDecision; overrideId: string }>>({})
  const [recovery, setRecovery] = useState<CatalogPublicationResult | null>(null)
  const [history, setHistory] = useState<CatalogPublicationListItem[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void listCatalogPublications(orgId, { pageSize: 25 })
      .then(page => {
        if (active) setHistory(page.items)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [orgId])

  const expired = Boolean(preview?.expiresAt && new Date(preview.expiresAt).getTime() <= Date.now())
  const hasUndecided = preview?.lines.some(line => line.fields.some(field => field.decision === 'UNDECIDED')) ?? false
  const canConfirm = canMutateContent && preview?.canConfirm === true && !expired && !hasUndecided && Boolean(preview.previewToken)

  function acceptPreview(nextPreview: CatalogPublicationPreview) {
    setPreview(nextPreview)
    const drafts: Record<string, { decision: CatalogPublicationDecision; overrideId: string }> = {}
    nextPreview.lines.forEach(line =>
      line.fields.forEach(field => {
        drafts[field.field] = { decision: field.decision, overrideId: field.overrideId ?? '' }
      }),
    )
    setDecisionDrafts(drafts)
  }

  async function prepare() {
    if (![catalogItemId, venueId, productId].every(value => value.trim())) return
    setBusy(true)
    setMessage(null)
    setRecovery(null)
    const key = idempotencyKey.trim() || newCatalogIdempotencyKey('catalog-publish')
    setIdempotencyKey(key)
    try {
      acceptPreview(
        await previewCatalogPublication(orgId, {
          operation: OPERATION,
          idempotencyKey: key,
          targets: [{ catalogItemId: catalogItemId.trim(), venueId: venueId.trim(), productId: productId.trim() }],
        }),
      )
    } catch {
      setMessage(t('masterCatalog.publications.previewError', { defaultValue: 'No se pudo preparar la publicación.' }))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!preview || !canConfirm) return
    setBusy(true)
    try {
      const result = await confirmCatalogPublication(orgId, {
        publicationBatchId: preview.publicationBatchId,
        previewToken: preview.previewToken,
        confirm: true,
        idempotencyKey,
      })
      setRecovery(result)
      setPreview(null)
    } catch {
      setMessage(t('masterCatalog.publications.confirmError', { defaultValue: 'La publicación cambió. Prepara una revisión nueva.' }))
    } finally {
      setBusy(false)
    }
  }

  async function reviewDecisions() {
    if (!preview) return
    const fields = preview.lines.flatMap(line => line.fields)
    const decisions = fields.map(field => {
      const draft = decisionDrafts[field.field] ?? { decision: field.decision, overrideId: field.overrideId ?? '' }
      return draft.decision === 'APPROVE_LOCAL_OVERRIDE'
        ? { field: field.field, decision: draft.decision, overrideId: draft.overrideId.trim() }
        : { field: field.field, decision: draft.decision }
    })
    if (decisions.some(decision => decision.decision === 'APPROVE_LOCAL_OVERRIDE' && !('overrideId' in decision && decision.overrideId)))
      return
    setBusy(true)
    try {
      acceptPreview(
        await previewCatalogPublication(orgId, {
          operation: OPERATION,
          idempotencyKey,
          targets: [{ catalogItemId: catalogItemId.trim(), venueId: venueId.trim(), productId: productId.trim(), decisions }],
        }),
      )
    } catch {
      setMessage(t('masterCatalog.publications.previewError', { defaultValue: 'No se pudo preparar la publicación.' }))
    } finally {
      setBusy(false)
    }
  }

  async function recover() {
    if (!idempotencyKey.trim()) return
    setBusy(true)
    setPreview(null)
    setMessage(null)
    try {
      setRecovery(await recoverCatalogPublication(orgId, OPERATION, idempotencyKey.trim()))
    } catch {
      setMessage(t('masterCatalog.publications.recoveryError', { defaultValue: 'No se encontró un resultado para esa clave.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('masterCatalog.publications.title', { defaultValue: 'Publicaciones' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('masterCatalog.publications.description', {
            defaultValue: 'Revisa cada cambio corporativo contra el producto local antes de publicarlo.',
          })}
        </p>
      </header>
      {canMutateContent ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.publications.prepareTitle', { defaultValue: 'Preparar publicación' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.publications.prepareDescription', {
                defaultValue: 'Los overrides aprobados conservan el valor local y su procedencia.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="publication-item">{t('masterCatalog.publications.itemId', { defaultValue: 'ID del artículo' })}</Label>
              <Input id="publication-item" value={catalogItemId} onChange={event => setCatalogItemId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publication-venue">{t('masterCatalog.publications.venueId', { defaultValue: 'ID de la sucursal' })}</Label>
              <Input id="publication-venue" value={venueId} onChange={event => setVenueId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publication-product">{t('masterCatalog.publications.productId', { defaultValue: 'ID del producto' })}</Label>
              <Input id="publication-product" value={productId} onChange={event => setProductId(event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="publication-key">{t('masterCatalog.publications.key', { defaultValue: 'Clave de idempotencia' })}</Label>
              <Input
                id="publication-key"
                value={idempotencyKey}
                onChange={event => setIdempotencyKey(event.target.value)}
                placeholder={t('masterCatalog.publications.keyPlaceholder', { defaultValue: 'Se genera al preparar si la dejas vacía' })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={prepare}
                disabled={busy || !canMutateContent || !catalogItemId.trim() || !venueId.trim() || !productId.trim()}
                data-tour="master-catalog-publication-preview"
              >
                {t('masterCatalog.publications.prepare', { defaultValue: 'Preparar publicación' })}
              </Button>
              <Button variant="outline" onClick={recover} disabled={busy || !idempotencyKey.trim()}>
                {t('masterCatalog.publications.recover', { defaultValue: 'Consultar resultado' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.readOnly.title', { defaultValue: 'Modo de solo lectura' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.readOnly.publicationsDescription', {
                defaultValue: 'Puedes consultar resultados por clave, pero no preparar publicaciones.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="publication-key-readonly">
                {t('masterCatalog.publications.key', { defaultValue: 'Clave de idempotencia' })}
              </Label>
              <Input id="publication-key-readonly" value={idempotencyKey} onChange={event => setIdempotencyKey(event.target.value)} />
            </div>
            <Button className="self-end" variant="outline" onClick={recover} disabled={busy || !idempotencyKey.trim()}>
              {t('masterCatalog.publications.recover', { defaultValue: 'Consultar resultado' })}
            </Button>
          </CardContent>
        </Card>
      )}
      {canMutateContent && preview && (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.publications.preview', { defaultValue: 'Cambios propuestos' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {preview.lines.map(line => (
              <div key={`${line.catalogItemId}-${line.venueId}`} className="space-y-3">
                <div className="flex gap-2">
                  <Badge variant="secondary">{line.status}</Badge>
                  {line.diagnosticCode && <Badge variant="destructive">{line.diagnosticCode}</Badge>}
                </div>
                <CatalogPreviewTable fields={line.fields} />
                {line.fields.some(field => field.decision === 'UNDECIDED' || line.status === 'LOCAL_DIVERGENCE') && (
                  <section
                    className="grid gap-3 rounded-lg border border-border p-4"
                    aria-label={t('masterCatalog.publications.decisions', { defaultValue: 'Decisiones de publicación' })}
                  >
                    {line.fields.map(field => {
                      const draft = decisionDrafts[field.field] ?? { decision: field.decision, overrideId: field.overrideId ?? '' }
                      return (
                        <div key={field.field} className="grid gap-2 md:grid-cols-[1fr_1.5fr_2fr] md:items-end">
                          <div className="font-medium">{field.field}</div>
                          <div className="space-y-1">
                            <Label htmlFor={`decision-${field.field}`}>
                              {t('masterCatalog.publications.fieldDecision', { defaultValue: 'Decisión' })}
                            </Label>
                            <select
                              id={`decision-${field.field}`}
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={draft.decision}
                              onChange={event =>
                                setDecisionDrafts(current => ({
                                  ...current,
                                  [field.field]: { ...draft, decision: event.target.value as CatalogPublicationDecision },
                                }))
                              }
                            >
                              <option value="PUBLISH_CORPORATE">
                                {t('masterCatalog.publications.useCorporate', { defaultValue: 'Usar valor corporativo' })}
                              </option>
                              <option value="APPROVE_LOCAL_OVERRIDE">
                                {t('masterCatalog.publications.keepLocal', { defaultValue: 'Conservar valor local' })}
                              </option>
                              <option value="UNDECIDED">
                                {t('masterCatalog.publications.keepPending', { defaultValue: 'Mantener pendiente' })}
                              </option>
                            </select>
                          </div>
                          {draft.decision === 'APPROVE_LOCAL_OVERRIDE' && (
                            <div className="space-y-1">
                              <Label htmlFor={`override-${field.field}`}>
                                {t('masterCatalog.publications.overrideId', { defaultValue: 'ID del override aprobado' })}
                              </Label>
                              <Input
                                id={`override-${field.field}`}
                                value={draft.overrideId}
                                onChange={event =>
                                  setDecisionDrafts(current => ({
                                    ...current,
                                    [field.field]: { ...draft, overrideId: event.target.value },
                                  }))
                                }
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <Button
                      variant="outline"
                      className="w-fit"
                      onClick={() => void reviewDecisions()}
                      disabled={
                        busy ||
                        Object.values(decisionDrafts).some(draft => draft.decision === 'APPROVE_LOCAL_OVERRIDE' && !draft.overrideId.trim())
                      }
                    >
                      {t('masterCatalog.publications.reviewDecisions', { defaultValue: 'Revisar decisiones' })}
                    </Button>
                  </section>
                )}
              </div>
            ))}
            {expired && (
              <p role="alert" className="text-sm text-destructive">
                {t('masterCatalog.publications.expired', { defaultValue: 'La revisión expiró.' })}
              </p>
            )}
            <Button onClick={confirm} disabled={!canConfirm || busy} data-tour="master-catalog-publication-confirm">
              {t('masterCatalog.publications.confirm', { defaultValue: 'Confirmar publicación' })}
            </Button>
          </CardContent>
        </Card>
      )}
      {recovery && (
        <p role="status" className="rounded-md border border-border bg-muted/40 p-4 font-medium" aria-live="polite">
          {recovery.state}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t('masterCatalog.publications.history', { defaultValue: 'Historial reciente' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table aria-label={t('masterCatalog.publications.historyLabel', { defaultValue: 'Historial de publicaciones' })}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('masterCatalog.columns.operation', { defaultValue: 'Operación' })}</TableHead>
                <TableHead>{t('masterCatalog.columns.status', { defaultValue: 'Estado' })}</TableHead>
                <TableHead>{t('masterCatalog.columns.lines', { defaultValue: 'Líneas' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map(batch => (
                <TableRow key={batch.publicationBatchId}>
                  <TableCell>{batch.operation}</TableCell>
                  <TableCell>{batch.state}</TableCell>
                  <TableCell>{batch.lineCount}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    {t('masterCatalog.publications.historyEmpty', { defaultValue: 'Aún no hay publicaciones.' })}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
