import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createCatalogItem, getCatalogItem, listCatalogReferences, updateCatalogItem } from '@/features/master-catalog/api'
import { catalogLeafFamilies, prepareCatalogItemUpdate } from '@/features/master-catalog/catalog-item-command'
import type { CatalogItemCommand } from '@/features/master-catalog/types'
import { useMasterCatalogAccess } from '@/features/master-catalog/use-master-catalog-access'
import CatalogItemForm from './components/CatalogItemForm'

export default function CatalogItemPage() {
  const { orgId = '', catalogItemId = 'new' } = useParams<{ orgId: string; catalogItemId: string }>()
  const isCreate = catalogItemId === 'new'
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canMutateContent } = useMasterCatalogAccess({ orgId })

  const references = useQuery({
    queryKey: ['master-catalog-references', orgId],
    queryFn: async () => {
      const [brands, manufacturers, families] = await Promise.all([
        listCatalogReferences(orgId, 'brands', { pageSize: 100, status: 'ACTIVE' }),
        listCatalogReferences(orgId, 'manufacturers', { pageSize: 100, status: 'ACTIVE' }),
        listCatalogReferences(orgId, 'families', { pageSize: 100, status: 'ACTIVE' }),
      ])
      return { brands: brands.items, manufacturers: manufacturers.items, families: catalogLeafFamilies(families.items) }
    },
    retry: false,
  })
  const item = useQuery({
    queryKey: ['master-catalog-item', orgId, catalogItemId],
    queryFn: () => getCatalogItem(orgId, catalogItemId),
    enabled: !isCreate,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: (input: CatalogItemCommand) =>
      isCreate
        ? createCatalogItem(orgId, input)
        : item.data
          ? updateCatalogItem(orgId, catalogItemId, prepareCatalogItemUpdate(item.data, input))
          : Promise.reject(new Error('CATALOG_ITEM_AUTHORITY_MISSING')),
    onSuccess: result => {
      void queryClient.invalidateQueries({ queryKey: ['master-catalog-items', orgId] })
      navigate(`/organizations/${orgId}/master-catalog/items/${result.id}`, { replace: isCreate })
    },
  })

  if (references.isPending || (!isCreate && item.isPending))
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  if (references.isError || item.isError || !references.data)
    return (
      <p role="alert" className="text-destructive">
        {t('masterCatalog.item.loadError', { defaultValue: 'No se pudo cargar el artículo o sus catálogos de referencia.' })}
      </p>
    )

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isCreate ? t('masterCatalog.item.createTitle', { defaultValue: 'Crear artículo corporativo' }) : item.data?.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCreate
              ? t('masterCatalog.item.createDescription', { defaultValue: 'Completa la información que compartirán todas las sucursales.' })
              : t('masterCatalog.item.editDescription', {
                  defaultValue: 'Edición con control de revisión para evitar sobrescribir cambios recientes.',
                })}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/organizations/${orgId}/master-catalog/items`}>
            {t('masterCatalog.item.back', { defaultValue: 'Volver a artículos' })}
          </Link>
        </Button>
      </header>
      {!canMutateContent && (
        <Card>
          <CardHeader>
            <CardTitle>{t('masterCatalog.readOnly.title', { defaultValue: 'Modo de solo lectura' })}</CardTitle>
            <CardDescription>
              {t('masterCatalog.readOnly.description', { defaultValue: 'Puedes consultar este artículo, pero no modificarlo.' })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <fieldset disabled={!canMutateContent}>
            <CatalogItemForm
              references={references.data}
              initialItem={item.data}
              onSubmit={async input => {
                await mutation.mutateAsync(input)
              }}
              isSubmitting={mutation.isPending}
              showSubmit={canMutateContent}
            />
          </fieldset>
          {mutation.isError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {t('masterCatalog.item.saveError', { defaultValue: 'No se pudo guardar. Recarga para conservar la revisión más reciente.' })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
