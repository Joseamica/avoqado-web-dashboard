/**
 * CategoryManagement - CRUD for serialized inventory categories
 *
 * Features:
 * - List categories with stats (available, sold, total)
 * - Create new categories
 * - Edit existing categories
 * - Delete categories (soft delete if has items)
 * - Color picker for visual identification
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
} from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  getItemCategories,
  createItemCategory,
  updateItemCategory,
  deleteItemCategory,
  type ItemCategory,
  type CreateItemCategoryDto,
  type UpdateItemCategoryDto,
} from '@/services/itemCategory.service'
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

interface CategoryManagementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategorySelect?: (category: ItemCategory) => void
}

export function CategoryManagement({ open, onOpenChange, onCategorySelect }: CategoryManagementProps) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<ItemCategory | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData)

  // Fetch categories
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['item-categories', venueId],
    queryFn: () => getItemCategories(venueId!, { includeStats: true }),
    enabled: !!venueId,
  })

  const categories = useMemo(() => categoriesData?.categories || [], [categoriesData])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateItemCategoryDto) => createItemCategory(venueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories', venueId] })
      queryClient.invalidateQueries({ queryKey: ['stock', venueId] })
      toast({ title: t('playtelecom:categories.createSuccess', { defaultValue: 'Categoría creada correctamente' }) })
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
      queryClient.invalidateQueries({ queryKey: ['item-categories', venueId] })
      queryClient.invalidateQueries({ queryKey: ['stock', venueId] })
      toast({ title: t('playtelecom:categories.updateSuccess', { defaultValue: 'Categoría actualizada correctamente' }) })
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
      queryClient.invalidateQueries({ queryKey: ['item-categories', venueId] })
      queryClient.invalidateQueries({ queryKey: ['stock', venueId] })
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

  // Loading content
  const loadingContent = (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )

  // Main content
  const mainContent = (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {t('playtelecom:categories.title', { defaultValue: 'Categorías de Inventario' })}
          </h3>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {t('playtelecom:categories.create', { defaultValue: 'Nueva Categoría' })}
        </Button>
      </div>

      {/* Categories Grid */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className={cn(
                'relative p-4 rounded-xl border border-border/50 bg-card/50',
                'hover:border-border hover:shadow-sm transition-all',
                onCategorySelect && 'cursor-pointer',
              )}
              onClick={() => onCategorySelect?.(category)}
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEdit(category)
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenDelete(category)
                    }}
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

              {/* Stats */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-bold">{category.availableItems || 0}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Disponible</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400">
                    <Package className="w-3.5 h-3.5" />
                    <span className="font-bold">{category.soldItems || 0}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Vendidos</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Box className="w-3.5 h-3.5" />
                    <span className="font-bold">{category.totalItems || 0}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </div>

              {/* Price badge */}
              {category.suggestedPrice && (
                <Badge variant="secondary" className="mt-3 text-xs">
                  ${category.suggestedPrice.toFixed(2)} MXN
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">
            {t('playtelecom:categories.empty', { defaultValue: 'No hay categorías configuradas' })}
          </p>
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t('playtelecom:categories.createFirst', { defaultValue: 'Crear primera categoría' })}
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Main Category Management Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>
              {t('playtelecom:categories.manageTitle', { defaultValue: 'Gestionar Categorías' })}
            </DialogTitle>
            <DialogDescription>
              {t('playtelecom:categories.manageDescription', {
                defaultValue: 'Crea y configura categorías para organizar tu inventario serializado.',
              })}
            </DialogDescription>
          </DialogHeader>
          {isLoading ? loadingContent : mainContent}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t('playtelecom:categories.edit', { defaultValue: 'Editar Categoría' })
                : t('playtelecom:categories.create', { defaultValue: 'Nueva Categoría' })}
            </DialogTitle>
            <DialogDescription>
              {t('playtelecom:categories.dialogDescription', {
                defaultValue: 'Configura los detalles de la categoría de inventario.',
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                {t('playtelecom:categories.name', { defaultValue: 'Nombre' })} *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Chip Negra, SIM Prepago"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">
                {t('playtelecom:categories.description', { defaultValue: 'Descripción' })}
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
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
              <Label htmlFor="suggestedPrice">
                {t('playtelecom:categories.suggestedPrice', { defaultValue: 'Precio Sugerido (MXN)' })}
              </Label>
              <Input
                id="suggestedPrice"
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
              <Label htmlFor="barcodePattern">
                {t('playtelecom:categories.barcodePattern', { defaultValue: 'Patrón de Código de Barras (Regex)' })}
              </Label>
              <Input
                id="barcodePattern"
                value={formData.barcodePattern}
                onChange={(e) => setFormData({ ...formData, barcodePattern: e.target.value })}
                placeholder="^89520[0-9]{14}$"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:categories.barcodePatternHelp', {
                  defaultValue: 'Expresión regular para auto-categorizar códigos de barras',
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
              {t('playtelecom:categories.deleteTitle', { defaultValue: '¿Eliminar categoría?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory?.totalItems && deletingCategory.totalItems > 0 ? (
                <>
                  {t('playtelecom:categories.deleteWithItems', {
                    defaultValue: `Esta categoría tiene ${deletingCategory.totalItems} items. Se desactivará pero los items se conservarán.`,
                    count: deletingCategory.totalItems,
                  })}
                </>
              ) : (
                t('playtelecom:categories.deleteEmpty', {
                  defaultValue: 'Esta categoría se eliminará permanentemente.',
                })
              )}
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
    </>
  )
}

export default CategoryManagement
