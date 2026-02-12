/**
 * CategoryEditor - Inline CRUD for serialized inventory categories
 *
 * Self-contained GlassCard with:
 * - Category cards grid with stats (available, sold, total)
 * - Create/Edit dialog with color picker
 * - Delete confirmation dialog
 * - Callbacks to keep PhonePreview in sync
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Tag,
  Loader2,
  CheckCircle2,
  Box,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { useVenueDateTime } from '@/utils/datetime'
import {
  createItemCategory,
  updateItemCategory,
  deleteItemCategory,
  getCategoryItems,
  type ItemCategory,
  type SerializedItem,
  type CreateItemCategoryDto,
  type UpdateItemCategoryDto,
} from '@/services/itemCategory.service'
import { getItemCategories } from '@/services/stockDashboard.service'
import { cn } from '@/lib/utils'

// Color presets for categories
const COLOR_PRESETS = [
  { name: 'Negro', value: '#1a1a1a' },
  { name: 'Blanco', value: '#f5f5f5' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Morado', value: '#9333ea' },
  { name: 'Naranja', value: '#ea580c' },
]

interface CategoryFormData {
  name: string
  description: string
  color: string
  suggestedPrice: string
  barcodePattern: string
  requiresPreRegistration: boolean
}

const defaultFormData: CategoryFormData = {
  name: '',
  description: '',
  color: '#1a1a1a',
  suggestedPrice: '',
  barcodePattern: '',
  requiresPreRegistration: true,
}

interface CategoryEditorProps {
  onCategoriesChange?: (categories: ItemCategory[]) => void
}

export function CategoryEditor({ onCategoriesChange }: CategoryEditorProps) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueId = activeVenue?.id
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<ItemCategory | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData)

  // Fetch categories
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['venue', venueId, 'item-categories'],
    queryFn: () => getItemCategories(venueId!, { includeStats: true }),
    enabled: !!venueId,
    staleTime: 60000,
  })

  const categories = useMemo(() => categoriesData?.categories || [], [categoriesData])

  // Notify parent when categories change
  useEffect(() => {
    onCategoriesChange?.(categories)
  }, [categories, onCategoriesChange])

  // Invalidate both query key patterns used across the app
  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['venue', venueId, 'item-categories'] })
    queryClient.invalidateQueries({ queryKey: ['item-categories', venueId] })
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateItemCategoryDto) => createItemCategory(venueId!, data),
    onSuccess: () => {
      invalidateCategories()
      toast({ title: t('playtelecom:categories.createSuccess', { defaultValue: 'Categoria creada correctamente' }) })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.message || t('common:error'), variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateItemCategoryDto }) =>
      updateItemCategory(venueId!, categoryId, data),
    onSuccess: () => {
      invalidateCategories()
      toast({ title: t('playtelecom:categories.updateSuccess', { defaultValue: 'Categoria actualizada correctamente' }) })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.message || t('common:error'), variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => deleteItemCategory(venueId!, categoryId),
    onSuccess: (result) => {
      invalidateCategories()
      toast({ title: result.message })
      setIsDeleteDialogOpen(false)
      setDeletingCategory(null)
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.message || t('common:error'), variant: 'destructive' })
    },
  })

  // Handlers
  const handleOpenCreate = () => {
    setEditingCategory(null)
    setFormData(defaultFormData)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (category: ItemCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#1a1a1a',
      suggestedPrice: category.suggestedPrice?.toString() || '',
      barcodePattern: category.barcodePattern || '',
      requiresPreRegistration: category.requiresPreRegistration,
    })
    setIsDialogOpen(true)
  }

  const handleOpenDelete = (category: ItemCategory) => {
    setDeletingCategory(category)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: t('playtelecom:categories.nameRequired', { defaultValue: 'El nombre es requerido' }), variant: 'destructive' })
      return
    }

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color,
      suggestedPrice: formData.suggestedPrice ? parseFloat(formData.suggestedPrice) : undefined,
      barcodePattern: formData.barcodePattern.trim() || undefined,
      requiresPreRegistration: formData.requiresPreRegistration,
    }

    if (editingCategory) {
      updateMutation.mutate({ categoryId: editingCategory.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = () => {
    if (deletingCategory) {
      deleteMutation.mutate(deletingCategory.id)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <>
      <GlassCard className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Tag className="w-4 h-4" />
            {t('playtelecom:categories.title', { defaultValue: 'Categorias de Inventario' })}
          </h3>
          <Button variant="ghost" size="sm" onClick={handleOpenCreate} className="text-primary gap-1">
            <Plus className="w-4 h-4" />
            {t('playtelecom:categories.create', { defaultValue: 'Nueva Categoria' })}
          </Button>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
                <Skeleton className="h-1.5 w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <div className="flex gap-4 pt-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : categories.length > 0 ? (
          /* Categories Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  'relative p-4 rounded-xl border border-border/50 bg-card/50 cursor-pointer',
                  'hover:border-border hover:shadow-sm transition-all group',
                )}
                onClick={() => setSelectedCategory(category)}
              >
                {/* Color indicator */}
                <div
                  className="absolute top-0 left-0 w-full h-1 rounded-t-xl"
                  style={{ backgroundColor: category.color || '#888' }}
                />

                {/* Header */}
                <div className="flex items-start justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-border/50"
                      style={{ backgroundColor: category.color || '#888' }}
                    />
                    <h4 className="font-semibold">{category.name}</h4>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(category) }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleOpenDelete(category) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {category.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {category.description}
                  </p>
                )}

                {/* Price badge */}
                {category.suggestedPrice != null && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    ${category.suggestedPrice.toFixed(2)} MXN
                  </Badge>
                )}

                {/* Stats */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="font-bold">{category.availableItems || 0}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t('playtelecom:categories.available', { defaultValue: 'Disponible' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400">
                      <Package className="w-3.5 h-3.5" />
                      <span className="font-bold">{category.soldItems || 0}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t('playtelecom:categories.sold', { defaultValue: 'Vendidos' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Box className="w-3.5 h-3.5" />
                      <span className="font-bold">{category.totalItems || 0}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t('playtelecom:categories.total', { defaultValue: 'Total' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {t('playtelecom:categories.empty', { defaultValue: 'No hay categorias configuradas' })}
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1" />
              {t('playtelecom:categories.createFirst', { defaultValue: 'Crear primera categoria' })}
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t('playtelecom:categories.edit', { defaultValue: 'Editar Categoria' })
                : t('playtelecom:categories.create', { defaultValue: 'Nueva Categoria' })}
            </DialogTitle>
            <DialogDescription>
              {t('playtelecom:categories.dialogDescription', {
                defaultValue: 'Configura los detalles de la categoria de inventario.',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="cat-name">
                {t('playtelecom:categories.name', { defaultValue: 'Nombre' })} *
              </Label>
              <Input
                id="cat-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Chip Negra, SIM Prepago"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="cat-description">
                {t('playtelecom:categories.description', { defaultValue: 'Descripcion' })}
              </Label>
              <Input
                id="cat-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('playtelecom:categories.descriptionPlaceholder', { defaultValue: 'Descripcion opcional' })}
              />
            </div>

            {/* Color */}
            <div className="grid gap-2">
              <Label>{t('playtelecom:categories.color', { defaultValue: 'Color' })}</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      formData.color === preset.value
                        ? 'border-primary scale-110'
                        : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: preset.value }}
                    onClick={() => setFormData({ ...formData, color: preset.value })}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Suggested Price */}
            <div className="grid gap-2">
              <Label htmlFor="cat-price">
                {t('playtelecom:categories.suggestedPrice', { defaultValue: 'Precio Sugerido (MXN)' })}
              </Label>
              <Input
                id="cat-price"
                type="number"
                step="0.01"
                min="0"
                value={formData.suggestedPrice}
                onChange={(e) => setFormData({ ...formData, suggestedPrice: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Barcode Pattern */}
            <div className="grid gap-2">
              <Label htmlFor="cat-barcode">
                {t('playtelecom:categories.barcodePattern', { defaultValue: 'Patron de Codigo de Barras (Regex)' })}
              </Label>
              <Input
                id="cat-barcode"
                value={formData.barcodePattern}
                onChange={(e) => setFormData({ ...formData, barcodePattern: e.target.value })}
                placeholder="^89520[0-9]{14}$"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:categories.barcodePatternHelp', {
                  defaultValue: 'Expresion regular para auto-categorizar codigos de barras',
                })}
              </p>
            </div>

            {/* Requires Pre-Registration */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>
                  {t('playtelecom:categories.requiresPreRegistration', {
                    defaultValue: 'Requiere Pre-Registro',
                  })}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('playtelecom:categories.requiresPreRegistrationHelp', {
                    defaultValue: 'Los items deben registrarse antes de venderse',
                  })}
                </p>
              </div>
              <Switch
                checked={formData.requiresPreRegistration}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requiresPreRegistration: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
              {t('common:cancel', { defaultValue: 'Cancelar' })}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common:saving', { defaultValue: 'Guardando...' })}
                </>
              ) : editingCategory ? (
                t('common:save', { defaultValue: 'Guardar' })
              ) : (
                t('common:create', { defaultValue: 'Crear' })
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('playtelecom:categories.deleteTitle', { defaultValue: 'Eliminar categoria?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory?.totalItems && deletingCategory.totalItems > 0
                ? t('playtelecom:categories.deleteWithItems', {
                    defaultValue: `Esta categoria tiene ${deletingCategory.totalItems} items. Se desactivara pero los items se conservaran.`,
                    count: deletingCategory.totalItems,
                  })
                : t('playtelecom:categories.deleteEmpty', {
                    defaultValue: 'Esta categoria se eliminara permanentemente.',
                  })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('common:cancel', { defaultValue: 'Cancelar' })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common:deleting', { defaultValue: 'Eliminando...' })}
                </>
              ) : (
                t('common:delete', { defaultValue: 'Eliminar' })
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Items Modal */}
      {selectedCategory && (
        <CategoryItemsModal
          category={selectedCategory}
          venueId={venueId!}
          open={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </>
  )
}

// ===========================================
// CategoryItemsModal — Internal component
// ===========================================

const STATUS_COLORS: Record<SerializedItem['status'], string> = {
  AVAILABLE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SOLD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RETURNED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DAMAGED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const PAGE_SIZE = 20

interface CategoryItemsModalProps {
  category: ItemCategory
  venueId: string
  open: boolean
  onClose: () => void
}

function CategoryItemsModal({ category, venueId, open, onClose }: CategoryItemsModalProps) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { formatDate, formatDateTime } = useVenueDateTime()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, debouncedSearch])

  const { data, isLoading } = useQuery({
    queryKey: ['category-items', venueId, category.id, { status: statusFilter.join(','), page, search: debouncedSearch }],
    queryFn: () =>
      getCategoryItems(venueId, category.id, {
        status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
    enabled: open && !!venueId,
  })

  const items = data?.items ?? []
  const pagination = data?.pagination

  const statusOptions = useMemo(
    () => [
      { value: 'AVAILABLE', label: t('playtelecom:categoryItems.statuses.AVAILABLE') },
      { value: 'SOLD', label: t('playtelecom:categoryItems.statuses.SOLD') },
      { value: 'RETURNED', label: t('playtelecom:categoryItems.statuses.RETURNED') },
      { value: 'DAMAGED', label: t('playtelecom:categoryItems.statuses.DAMAGED') },
    ],
    [t],
  )

  const statusFilterLabel = useMemo(() => {
    if (statusFilter.length === 0) return null
    if (statusFilter.length === 1) {
      return statusOptions.find((o) => o.value === statusFilter[0])?.label ?? null
    }
    return `${statusFilter.length}`
  }, [statusFilter, statusOptions])

  const handleStatusApply = useCallback((values: string[]) => {
    setStatusFilter(values)
  }, [])

  const handleStatusClear = useCallback(() => {
    setStatusFilter([])
  }, [])

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={category.name}
      contentClassName="bg-muted/30"
    >
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Title with color dot (visible in content area since FullScreenModal title is plain text) */}
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full border border-border/50"
            style={{ backgroundColor: category.color || '#888' }}
          />
          <h2 className="text-xl font-bold">{category.name}</h2>
          {category.description && (
            <span className="text-sm text-muted-foreground">— {category.description}</span>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-2xl font-bold">{category.availableItems || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('playtelecom:categories.available', { defaultValue: 'Disponible' })}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Package className="w-4 h-4" />
              <span className="text-2xl font-bold">{category.soldItems || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('playtelecom:categories.sold', { defaultValue: 'Vendidos' })}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Box className="w-4 h-4" />
              <span className="text-2xl font-bold">{category.totalItems || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('playtelecom:categories.total', { defaultValue: 'Total' })}
            </p>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill
            label={t('playtelecom:categoryItems.status')}
            activeValue={statusFilterLabel}
            onClear={handleStatusClear}
          >
            <CheckboxFilterContent
              title={t('playtelecom:categoryItems.statusFilter')}
              options={statusOptions}
              selectedValues={statusFilter}
              onApply={handleStatusApply}
            />
          </FilterPill>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('playtelecom:categoryItems.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-9 text-sm rounded-full"
            />
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card p-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex gap-4 mt-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {statusFilter.length > 0 || debouncedSearch
                  ? t('playtelecom:categoryItems.noItemsFiltered')
                  : t('playtelecom:categoryItems.noItems')}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/50 bg-card p-3 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{item.serialNumber}</span>
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', STATUS_COLORS[item.status])}
                  >
                    {t(`playtelecom:categoryItems.statuses.${item.status}`)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span>
                    {t('playtelecom:categoryItems.createdAt')}: {formatDate(item.createdAt)}
                  </span>
                  {item.soldAt && (
                    <span>
                      {t('playtelecom:categoryItems.soldAt')}: {formatDateTime(item.soldAt)}
                    </span>
                  )}
                  {item.registeredBy && (
                    <span>
                      {t('playtelecom:categoryItems.registeredBy')}: {item.registeredBy}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {t('playtelecom:categoryItems.showing', {
                from: (pagination.page - 1) * pagination.pageSize + 1,
                to: Math.min(pagination.page * pagination.pageSize, pagination.total),
                total: pagination.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('playtelecom:categoryItems.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('playtelecom:categoryItems.next')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </FullScreenModal>
  )
}
