import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  catalogImportErrorsUrl,
  catalogImportTemplateUrl,
  confirmCatalogImport,
  newCatalogIdempotencyKey,
  previewCatalogImport,
} from '@/features/master-catalog/api'
import type { CatalogImportPreview } from '@/features/master-catalog/types'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'

export default function CatalogImportPage() {
  const { orgId = '' } = useParams<{ orgId: string }>()
  const { t } = useTranslation('organization')
  const { canMutateContent } = useMasterCatalogAccess({ orgId })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const expired = Boolean(preview?.expiresAt && new Date(preview.expiresAt).getTime() <= Date.now())
  const canConfirm = canMutateContent && preview?.canConfirm === true && Boolean(preview.previewToken) && !expired

  async function review() {
    if (!file) return
    setBusy(true)
    setMessage(null)
    setPreview(null)
    try {
      setPreview(await previewCatalogImport(orgId, file))
    } catch {
      setMessage(t('masterCatalog.import.previewError', { defaultValue: 'No se pudo revisar el archivo.' }))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!preview?.previewToken || !canConfirm) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await confirmCatalogImport(orgId, {
        importBatchId: preview.importBatchId,
        previewToken: preview.previewToken,
        confirm: true,
        idempotencyKey: newCatalogIdempotencyKey('catalog-import'),
      })
      setMessage(
        t('masterCatalog.import.applied', {
          defaultValue: 'Importación aplicada: {{count}} artículos.',
          count: result.appliedItemIds.length,
        }),
      )
      setPreview(null)
    } catch {
      setMessage(
        t('masterCatalog.import.confirmError', { defaultValue: 'No se pudo confirmar la importación. Vuelve a revisar el archivo.' }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('masterCatalog.import.title', { defaultValue: 'Importación del catálogo maestro' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('masterCatalog.import.description', {
            defaultValue: 'Crea o actualiza artículos corporativos. Este proceso no reemplaza el menú local de ninguna sucursal.',
          })}
        </p>
      </header>
      {canMutateContent ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.import.fileTitle', { defaultValue: 'Archivo de catálogo' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.import.fileDescription', {
                defaultValue: 'Primero revisamos el XLSX. Nada se escribe hasta tu confirmación final.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button variant="outline" asChild>
              <a href={catalogImportTemplateUrl(orgId)}>
                <Download aria-hidden="true" />
                {t('masterCatalog.import.template', { defaultValue: 'Descargar plantilla' })}
              </a>
            </Button>
            <div className="space-y-2">
              <Label htmlFor="catalog-import-file">{t('masterCatalog.import.file', { defaultValue: 'Archivo XLSX' })}</Label>
              <Input
                id="catalog-import-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={event => {
                  setFile(event.target.files?.[0] ?? null)
                  setPreview(null)
                }}
                disabled={!canMutateContent}
                data-tour="master-catalog-import-file"
              />
            </div>
            <Button type="button" onClick={review} disabled={!file || busy || !canMutateContent} data-tour="master-catalog-import-review">
              <Upload aria-hidden="true" />
              {busy
                ? t('masterCatalog.import.reviewing', { defaultValue: 'Revisando…' })
                : t('masterCatalog.import.review', { defaultValue: 'Revisar archivo' })}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.readOnly.title', { defaultValue: 'Modo de solo lectura' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.readOnly.importDescription', { defaultValue: 'Solo OWNER y ADMIN pueden importar un catálogo.' })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canMutateContent && preview && (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.import.result', { defaultValue: 'Resultado de la revisión' })}</CardTitle>
            <CardDescription>
              {preview.errorCount === 0
                ? t('masterCatalog.import.noErrors', { defaultValue: 'El archivo está listo.' })
                : t('masterCatalog.import.errorCount', { defaultValue: '{{count}} errores encontrados.', count: preview.errorCount })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {preview.errors.length > 0 && (
              <div className="space-y-3">
                {preview.errors.map((error, index) => (
                  <Alert variant="destructive" key={`${error.code}-${index}`}>
                    <FileSpreadsheet aria-hidden="true" />
                    <AlertTitle>{error.code}</AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
            {(preview.errorCount > 0 || preview.errorsTruncated) && (
              <Button asChild variant="outline">
                <a href={catalogImportErrorsUrl(orgId, preview.importBatchId)}>
                  <Download aria-hidden="true" />
                  {t('masterCatalog.import.downloadErrors', { defaultValue: 'Descargar errores' })}
                </a>
              </Button>
            )}
            {expired && (
              <p role="alert" className="text-sm text-destructive">
                {t('masterCatalog.import.expired', { defaultValue: 'La revisión expiró. Revisa nuevamente el archivo.' })}
              </p>
            )}
            <Button onClick={confirm} disabled={!canConfirm || busy} data-tour="master-catalog-import-confirm">
              {t('masterCatalog.import.confirm', { defaultValue: 'Confirmar importación' })}
            </Button>
          </CardContent>
        </Card>
      )}
      {message && (
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
