import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Plus, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCatalogItems } from '@/features/master-catalog/use-catalog-items'
import { catalogExportUrl } from '@/features/master-catalog/api'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'

export default function CatalogItemsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { t } = useTranslation('organization')

  /**
   * The table used to print the raw Prisma enum — `RETAIL_PRODUCT`, `ACTIVE` —
   * straight into cells a client reads. Unknown values fall through to the code
   * itself so a new enum member degrades to something legible instead of blank.
   */
  const kindLabel = (kind: string) =>
    ({
      RETAIL_PRODUCT: t('masterCatalog.kind.retailProduct', { defaultValue: 'Producto de retail' }),
      PREPARED_DISH: t('masterCatalog.kind.preparedDish', { defaultValue: 'Platillo preparado' }),
    })[kind] ?? kind

  const statusLabel = (status: string) =>
    ({
      ACTIVE: t('masterCatalog.status.active', { defaultValue: 'Activo' }),
      RETIRED: t('masterCatalog.status.retired', { defaultValue: 'Retirado' }),
    })[status] ?? status

  const access = useMasterCatalogAccess({ orgId })
  const catalog = useCatalogItems(orgId)

  if (catalog.isLoading) {
    return (
      <div className="space-y-4" aria-label={t('masterCatalog.loading', { defaultValue: 'Cargando catálogo' })}>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('masterCatalog.items.title', { defaultValue: 'Artículos corporativos' })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('masterCatalog.items.description', {
              defaultValue: 'La fuente central de nombres, impuestos, costos y presentación para todas las sucursales.',
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={catalogExportUrl(orgId ?? '')}>
              <Download aria-hidden="true" />
              {t('masterCatalog.items.export', { defaultValue: 'Exportar catálogo' })}
            </a>
          </Button>
          {access.canMutateContent && (
            <Button asChild data-tour="master-catalog-create-item">
              <Link to={`/organizations/${orgId}/master-catalog/items/new`}>
                <Plus aria-hidden="true" />
                {t('masterCatalog.items.create', { defaultValue: 'Crear artículo' })}
              </Link>
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('masterCatalog.items.listTitle', { defaultValue: 'Artículos corporativos' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.items.listDescription', { defaultValue: 'Los SKU se muestran como texto para conservar ceros iniciales.' })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="catalog-status" className="text-sm font-medium">
              {t('masterCatalog.items.status', { defaultValue: 'Estado' })}
            </label>
            <select
              id="catalog-status"
              value={catalog.status}
              onChange={event => catalog.setStatus(event.target.value as 'ACTIVE' | 'RETIRED')}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ACTIVE">{t('masterCatalog.status.active', { defaultValue: 'Activos' })}</option>
              <option value="RETIRED">{t('masterCatalog.status.retired', { defaultValue: 'Retirados' })}</option>
            </select>
            <Button
              variant="outline"
              size="icon"
              onClick={catalog.refresh}
              aria-label={t('masterCatalog.items.refresh', { defaultValue: 'Recargar artículos' })}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {catalog.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t('masterCatalog.items.loadError', { defaultValue: 'No se pudieron cargar los artículos.' })}
            </p>
          ) : (
            <Table aria-label={t('masterCatalog.items.tableLabel', { defaultValue: 'Artículos corporativos' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('masterCatalog.columns.sku', { defaultValue: 'SKU' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.name', { defaultValue: 'Nombre' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.kind', { defaultValue: 'Tipo' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.status', { defaultValue: 'Estado' })}</TableHead>
                  <TableHead>{t('masterCatalog.columns.bindings', { defaultValue: 'Asignaciones' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        to={`/organizations/${orgId}/master-catalog/items/${item.id}`}
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>{kindLabel(item.kind)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell>{item.bindingSummary.total}</TableCell>
                  </TableRow>
                ))}
                {catalog.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {t('masterCatalog.items.empty', { defaultValue: 'No hay artículos con este estado.' })}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              className="min-h-11 sm:min-h-9 sm:justify-self-start"
              variant="outline"
              onClick={catalog.loadPrevious}
              disabled={!catalog.canGoBack || catalog.isFetching}
            >
              {t('masterCatalog.items.previous', { defaultValue: 'Página anterior' })}
            </Button>
            <Button
              className="min-h-11 sm:min-h-9 sm:justify-self-end"
              variant="outline"
              onClick={catalog.loadNext}
              disabled={!catalog.nextCursor || catalog.isFetching}
            >
              {t('masterCatalog.items.next', { defaultValue: 'Siguiente página' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
