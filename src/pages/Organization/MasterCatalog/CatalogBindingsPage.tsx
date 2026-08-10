import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { confirmCatalogBindings, newCatalogIdempotencyKey, previewCatalogBindings } from '@/features/master-catalog/api'
import type { CatalogBindingDecision, CatalogBindingPreview } from '@/features/master-catalog/types'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'
import CatalogBindingDecisionTable from './components/CatalogBindingDecisionTable'

export default function CatalogBindingsPage() {
  const { orgId = '' } = useParams<{ orgId: string }>()
  const { t } = useTranslation('organization')
  const { canMutateContent } = useMasterCatalogAccess({ orgId })
  const [catalogItemId, setCatalogItemId] = useState('')
  const [venueId, setVenueId] = useState('')
  const [preview, setPreview] = useState<CatalogBindingPreview | null>(null)
  const [decisionKind, setDecisionKind] = useState<'LINK' | 'CREATE' | 'SKIP'>('SKIP')
  const [linkedProductId, setLinkedProductId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [localSku, setLocalSku] = useState('')
  const [initialPrice, setInitialPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const expired = Boolean(preview?.expiresAt && new Date(preview.expiresAt).getTime() <= Date.now())
  const canConfirm = canMutateContent && preview?.canConfirm === true && Boolean(preview.bindingBatchId && preview.previewToken) && !expired

  function selectedDecision(): CatalogBindingDecision | undefined {
    if (decisionKind === 'SKIP') return { decision: 'SKIP' }
    if (decisionKind === 'LINK' && linkedProductId.trim()) return { decision: 'LINK', productId: linkedProductId.trim() }
    if (decisionKind === 'CREATE' && categoryId.trim() && localSku.trim() && initialPrice.trim()) {
      return { decision: 'CREATE', create: { categoryId: categoryId.trim(), localSku: localSku.trim(), initialPrice: initialPrice.trim() } }
    }
    return undefined
  }

  async function prepare(withDecision = false) {
    if (!catalogItemId.trim() || !venueId.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const decision = withDecision ? selectedDecision() : undefined
      setPreview(
        await previewCatalogBindings(orgId, [
          { catalogItemId: catalogItemId.trim(), venueId: venueId.trim(), ...(decision ? { decision } : {}) },
        ]),
      )
    } catch {
      setMessage(t('masterCatalog.bindings.previewError', { defaultValue: 'No se pudieron preparar las asignaciones.' }))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!canConfirm || !preview?.bindingBatchId || !preview.previewToken) return
    setBusy(true)
    try {
      const result = await confirmCatalogBindings(orgId, {
        bindingBatchId: preview.bindingBatchId,
        previewToken: preview.previewToken,
        confirm: true,
        idempotencyKey: newCatalogIdempotencyKey('catalog-binding'),
      })
      setMessage(result.state)
      setPreview(null)
    } catch {
      setMessage(t('masterCatalog.bindings.confirmError', { defaultValue: 'La asignación cambió. Prepara una revisión nueva.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('masterCatalog.bindings.title', { defaultValue: 'Asignaciones a sucursales' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('masterCatalog.bindings.description', {
            defaultValue: 'Relaciona cada artículo corporativo con un producto local existente o prepara su creación.',
          })}
        </p>
      </header>
      {canMutateContent ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.bindings.prepareTitle', { defaultValue: 'Preparar asignación' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.bindings.prepareDescription', { defaultValue: 'La revisión no modifica el producto local.' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="binding-item">{t('masterCatalog.bindings.itemId', { defaultValue: 'ID del artículo' })}</Label>
              <Input id="binding-item" value={catalogItemId} onChange={event => setCatalogItemId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="binding-venue">{t('masterCatalog.bindings.venueId', { defaultValue: 'ID de la sucursal' })}</Label>
              <Input id="binding-venue" value={venueId} onChange={event => setVenueId(event.target.value)} />
            </div>
            <Button
              className="md:col-span-2 md:w-fit"
              onClick={() => void prepare(false)}
              disabled={busy || !canMutateContent || !catalogItemId.trim() || !venueId.trim()}
              data-tour="master-catalog-bindings-preview"
            >
              {t('masterCatalog.bindings.prepare', { defaultValue: 'Preparar asignaciones' })}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.readOnly.title', { defaultValue: 'Modo de solo lectura' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.readOnly.bindingsDescription', { defaultValue: 'Solo OWNER y ADMIN pueden preparar asignaciones.' })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {canMutateContent && preview && (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.bindings.result', { defaultValue: 'Propuestas' })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <CatalogBindingDecisionTable lines={preview.lines} />
            {!preview.canConfirm && (
              <section className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2" aria-labelledby="binding-decision-title">
                <h2 id="binding-decision-title" className="col-span-full font-semibold">
                  {t('masterCatalog.bindings.decisionTitle', { defaultValue: 'Decisión final' })}
                </h2>
                <div className="space-y-2">
                  <Label htmlFor="binding-decision">{t('masterCatalog.bindings.decision', { defaultValue: 'Acción' })}</Label>
                  <select
                    id="binding-decision"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={decisionKind}
                    onChange={event => setDecisionKind(event.target.value as typeof decisionKind)}
                  >
                    <option value="LINK">
                      {t('masterCatalog.bindings.linkExisting', { defaultValue: 'Vincular producto existente' })}
                    </option>
                    <option value="CREATE">{t('masterCatalog.bindings.createLocal', { defaultValue: 'Crear producto local' })}</option>
                    <option value="SKIP">{t('masterCatalog.bindings.skip', { defaultValue: 'Omitir asignación' })}</option>
                  </select>
                </div>
                {decisionKind === 'LINK' && (
                  <div className="space-y-2">
                    <Label htmlFor="binding-product">
                      {t('masterCatalog.bindings.productId', { defaultValue: 'ID del producto local' })}
                    </Label>
                    <Input id="binding-product" value={linkedProductId} onChange={event => setLinkedProductId(event.target.value)} />
                  </div>
                )}
                {decisionKind === 'CREATE' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="binding-category">
                        {t('masterCatalog.bindings.categoryId', { defaultValue: 'ID de categoría local' })}
                      </Label>
                      <Input id="binding-category" value={categoryId} onChange={event => setCategoryId(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="binding-local-sku">{t('masterCatalog.bindings.localSku', { defaultValue: 'SKU local' })}</Label>
                      <Input id="binding-local-sku" value={localSku} onChange={event => setLocalSku(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="binding-price">{t('masterCatalog.bindings.initialPrice', { defaultValue: 'Precio inicial' })}</Label>
                      <Input
                        id="binding-price"
                        inputMode="decimal"
                        value={initialPrice}
                        onChange={event => setInitialPrice(event.target.value)}
                      />
                    </div>
                  </>
                )}
                <Button
                  className="md:col-span-2 md:w-fit"
                  variant="outline"
                  onClick={() => void prepare(true)}
                  disabled={busy || !selectedDecision()}
                >
                  {t('masterCatalog.bindings.applyDecision', { defaultValue: 'Revisar decisión' })}
                </Button>
              </section>
            )}
            {expired && (
              <p role="alert" className="text-sm text-destructive">
                {t('masterCatalog.bindings.expired', { defaultValue: 'La propuesta expiró.' })}
              </p>
            )}
            <Button onClick={confirm} disabled={!canConfirm || busy} data-tour="master-catalog-bindings-confirm">
              {t('masterCatalog.bindings.confirm', { defaultValue: 'Confirmar asignaciones' })}
            </Button>
          </CardContent>
        </Card>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )
}
