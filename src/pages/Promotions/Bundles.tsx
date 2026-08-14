import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Rocket, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/data-table'
import { PermissionGate } from '@/components/PermissionGate'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CheckboxFilterContent, FilterPill } from '@/components/filters' // 🔴 regla ui-patterns: filtros Stripe, no Select — espejar props exactas de src/pages/Order/Orders.tsx
import { TourDiscoveryBanner } from '@/components/onboarding/TourDiscoveryBanner'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePromotionCreationTour } from '@/hooks/usePromotionCreationTour'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import promotionService from '@/services/promotion.service'
import type { Promotion, PromotionStatus } from '@/types/promotion'
import { BundleEditor } from './components/BundleEditor'
import { PanelSettingsCard } from './components/PanelSettingsCard'

const STATUS_BADGE: Record<PromotionStatus, 'default' | 'secondary' | 'outline'> = {
  PUBLISHED: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
}

export default function Bundles() {
  const { t } = useTranslation('promotions')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = useAccess()
  // 🔴 FeatureGate monta los children aunque no haya acceso (solo los blurea):
  // sin este enabled, un venue FREE dispararía queries que terminan en 403
  // escondidos bajo el paywall.
  const { hasAccess } = useTierFeatureAccess('PROMOTIONS')
  const { start: startPromotionTour } = usePromotionCreationTour()

  const [statusFilter, setStatusFilter] = useState<string[]>([]) // multi-select estilo Stripe; vacío = todas
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null)
  const [toDelete, setToDelete] = useState<Promotion | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', venueId, statusFilter],
    queryFn: () =>
      promotionService.getPromotions(venueId!, {
        status: statusFilter.length === 1 ? (statusFilter[0] as PromotionStatus) : undefined,
        pageSize: 100,
      }),
    enabled: !!venueId && hasAccess,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['promotions', venueId] })

  const publishMutation = useMutation({
    mutationFn: (id: string) => promotionService.publishPromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.published') })
      invalidate()
    },
    onError: (error: any) => {
      const errors: string[] | undefined = error?.response?.data?.errors
      if (errors?.length) setPublishErrors(errors) // TODOS los motivos, juntos
      else toast({ title: t('bundles.toasts.publishFailed'), variant: 'destructive' })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => promotionService.archivePromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.archived') })
      invalidate()
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => promotionService.unarchivePromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.unarchived') })
      invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionService.deletePromotion(venueId!, id),
    onSuccess: () => {
      toast({ title: t('bundles.toasts.deleted') })
      setToDelete(null)
      invalidate()
    },
    onError: (error: any) => {
      toast({ title: error?.response?.data?.message ?? t('bundles.toasts.deleteFailed'), variant: 'destructive' })
      setToDelete(null)
    },
  })

  const rows = useMemo(() => {
    const all = data?.data ?? []
    // Filtro multi-select en cliente (la lista cabe completa: pageSize 100)
    return statusFilter.length > 0 ? all.filter(p => statusFilter.includes(p.status)) : all
  }, [data, statusFilter])

  const columns = useMemo<ColumnDef<Promotion>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('bundles.list.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.imageUrl ? (
              <img src={row.original.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-muted" />
            )}
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'pricingMode',
        header: t('bundles.list.mode'),
        cell: ({ row }) =>
          row.original.pricingMode === 'PER_UNIT' ? t('bundles.list.modePerUnit') : t('bundles.list.modeFixed'),
      },
      {
        accessorKey: 'price',
        header: t('bundles.list.price'),
        cell: ({ row }) =>
          row.original.pricingMode === 'PER_UNIT' ? '—' : `$${row.original.price.toFixed(2)}`,
      },
      {
        accessorKey: 'status',
        header: t('bundles.list.status'),
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE[row.original.status]}>{t(`bundles.status.${row.original.status}`)}</Badge>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const promo = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="cursor-pointer" data-tour="bundle-row-actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Cada acción gateada por su permiso: un VIEWER con discounts:read
                    no debe ver botones que terminan en 403 */}
                {can('discounts:update') && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(promo)
                      setEditorOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> {t('bundles.actions.edit')}
                  </DropdownMenuItem>
                )}
                {can('discounts:update') && promo.status === 'DRAFT' && (
                  <DropdownMenuItem onClick={() => publishMutation.mutate(promo.id)}>
                    <Rocket className="mr-2 h-4 w-4" /> {t('bundles.actions.publish')}
                  </DropdownMenuItem>
                )}
                {can('discounts:update') && promo.status === 'PUBLISHED' && (
                  <DropdownMenuItem onClick={() => archiveMutation.mutate(promo.id)}>
                    <Archive className="mr-2 h-4 w-4" /> {t('bundles.actions.archive')}
                  </DropdownMenuItem>
                )}
                {can('discounts:update') && promo.status === 'ARCHIVED' && (
                  <DropdownMenuItem onClick={() => unarchiveMutation.mutate(promo.id)}>
                    <ArchiveRestore className="mr-2 h-4 w-4" /> {t('bundles.actions.unarchive')}
                  </DropdownMenuItem>
                )}
                {can('discounts:delete') && promo.status === 'DRAFT' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(promo)}>
                      <Trash2 className="mr-2 h-4 w-4" /> {t('bundles.actions.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    // 🔴 Deps ESTABLES: el objeto de useMutation cambia cada render (rompería la
    // memoización de columnas); .mutate sí es estable. `can` va en deps.
    [t, can, publishMutation.mutate, archiveMutation.mutate, unarchiveMutation.mutate],
  )

  return (
    <FeatureGate feature="PROMOTIONS">
      <div className="p-4 bg-background text-foreground" data-tour="bundles-page">
        <div className="flex items-start justify-between gap-4">
          <PageTitleWithInfo title={t('bundles.title')} tooltip={t('bundles.subtitle')} />
          <div className="flex items-center gap-2">
            {/* Filtro estilo Stripe — props REALES: CheckboxFilterContent exige
                title/options/selectedValues/onApply (CheckboxFilterContent.tsx:13-24)
                y FilterPill NO acepta data-tour (sin rest spread) → va en el div. */}
            <div data-tour="bundle-status-filter">
              <FilterPill label={t('bundles.list.status')} activeCount={statusFilter.length}>
                <CheckboxFilterContent
                  title={t('bundles.list.status')}
                  options={[
                    { value: 'DRAFT', label: t('bundles.status.DRAFT') },
                    { value: 'PUBLISHED', label: t('bundles.status.PUBLISHED') },
                    { value: 'ARCHIVED', label: t('bundles.status.ARCHIVED') },
                  ]}
                  selectedValues={statusFilter}
                  onApply={setStatusFilter}
                />
              </FilterPill>
            </div>
            <PermissionGate permission="discounts:create">
              <Button
                onClick={() => {
                  setEditing(null)
                  setEditorOpen(true)
                }}
                data-tour="bundle-create"
              >
                <Plus className="mr-2 h-4 w-4" /> {t('bundles.create')}
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* storageKey es prop OBLIGATORIA (TourDiscoveryBanner.tsx:7) y ctaLabel se
            traduce — el fallback interno está hardcodeado en español (:66) */}
        <TourDiscoveryBanner
          className="mt-4"
          storageKey="bundles-activation"
          title={t('bundles.activation.bannerTitle')}
          description={t('bundles.activation.bannerDesc')}
          ctaLabel={t('bundles.activation.startGuide')}
          onStart={startPromotionTour}
        />

        <div className="mt-6">
          {!isLoading && rows.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-input bg-card p-8 text-center space-y-3">
              <p className="text-lg font-medium">{t('bundles.activation.emptyTitle')}</p>
              <ol className="mx-auto max-w-md list-decimal space-y-1 pl-5 text-left text-sm text-muted-foreground">
                <li>{t('bundles.activation.step1')}</li>
                <li>{t('bundles.activation.step2')}</li>
                <li>{t('bundles.activation.step3')}</li>
              </ol>
              <Button className="mt-2" onClick={startPromotionTour} data-tour="bundle-guide-start">
                {t('bundles.activation.startGuide')}
              </Button>
            </div>
          ) : (
            // rowCount es prop OBLIGATORIA (data-table.tsx:28). enableSearch sin
            // onSearch pinta una caja MUERTA (data-table.tsx:187): el filtrado
            // client-side lo hace onSearch.
            <DataTable
              data={rows}
              columns={columns}
              rowCount={rows.length}
              isLoading={isLoading}
              enableSearch
              searchPlaceholder={t('bundles.list.searchPlaceholder')}
              onSearch={(term, items) => items.filter(p => p.name.toLowerCase().includes(term.toLowerCase()))}
              showColumnCustomizer={false}
            />
          )}
        </div>

        <PermissionGate permission="venues:update">
          <PanelSettingsCard venueId={venueId!} />
        </PermissionGate>

        <BundleEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          venueId={venueId!}
          editPromotion={editing}
          onSaved={() => {
            setEditorOpen(false)
            invalidate()
          }}
        />

        {/* Los errores de publicar, TODOS juntos — el dueño los corrige de una vez */}
        <AlertDialog open={!!publishErrors} onOpenChange={open => !open && setPublishErrors(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('bundles.publishErrors.title')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <ul className="list-disc pl-5 space-y-1">
                  {(publishErrors ?? []).map(error => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setPublishErrors(null)}>{t('bundles.publishErrors.ok')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('bundles.delete.title', { name: toDelete?.name })}</AlertDialogTitle>
              <AlertDialogDescription>{t('bundles.delete.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('bundles.delete.cancel')}</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}>
                {t('bundles.delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FeatureGate>
  )
}
