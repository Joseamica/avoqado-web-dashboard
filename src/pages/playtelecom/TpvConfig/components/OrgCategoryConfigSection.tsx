/**
 * OrgCategoryConfigSection - Organization-level item category management
 *
 * Shows org-level categories with CRUD. Gated behind inventory:org-manage permission.
 * Available to OWNER, ADMIN roles (and any role granted inventory:org-manage).
 * Follows the same pattern as OrgGoalConfigSection.
 */

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Trash2, Building2, Loader2, Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useAccess } from '@/hooks/use-access'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  getOrgCategories,
  createOrgCategory,
  updateOrgCategory,
  deleteOrgCategory,
} from '@/services/orgItemCategory.service'
import type { ItemCategory, CreateItemCategoryDto, UpdateItemCategoryDto } from '@/services/itemCategory.service'
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

export default function OrgCategoryConfigSection() {
  const { can } = useAccess()
  const { activeVenue } = useAuth()
  const venueId = activeVenue?.id
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<ItemCategory | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData)

  const { data: orgCategories, isLoading } = useQuery({
    queryKey: ['org-item-categories', venueId],
    queryFn: () => getOrgCategories(venueId!),
    enabled: !!venueId && can('inventory:org-manage'),
    staleTime: 60000,
  })

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['org-item-categories', venueId] })
    queryClient.invalidateQueries({ queryKey: ['venue', venueId, 'item-categories'] })
    queryClient.invalidateQueries({ queryKey: ['item-categories', venueId] })
  }, [queryClient, venueId])

  const createMutation = useMutation({
    mutationFn: (data: CreateItemCategoryDto) => createOrgCategory(venueId!, data),
    onSuccess: () => {
      invalidateAll()
      toast({ title: 'Categoría de organización creada correctamente' })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.message || 'Error al crear categoría', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateItemCategoryDto }) =>
      updateOrgCategory(venueId!, categoryId, data),
    onSuccess: () => {
      invalidateAll()
      toast({ title: 'Categoría actualizada correctamente' })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.message || 'Error al actualizar', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => deleteOrgCategory(venueId!, categoryId),
    onSuccess: (result) => {
      invalidateAll()
      toast({ title: result.message })
      setDeleteDialogOpen(false)
      setDeletingCategory(null)
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.message || 'Error al eliminar', variant: 'destructive' })
    },
  })

  const handleOpenCreate = useCallback(() => {
    setEditingCategory(null)
    setFormData(defaultFormData)
    setDialogOpen(true)
  }, [])

  const handleOpenEdit = useCallback((category: ItemCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#1a1a1a',
      suggestedPrice: category.suggestedPrice?.toString() || '',
      barcodePattern: category.barcodePattern || '',
      requiresPreRegistration: category.requiresPreRegistration,
    })
    setDialogOpen(true)
  }, [])

  const handleOpenDelete = useCallback((category: ItemCategory) => {
    setDeletingCategory(category)
    setDeleteDialogOpen(true)
  }, [])

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: 'El nombre es requerido', variant: 'destructive' })
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

  const activeCategories = useMemo(() => (orgCategories ?? []).filter(c => c.active), [orgCategories])

  if (!can('inventory:org-manage')) return null

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold text-muted-foreground uppercase">
              Categorías de Organización
            </h4>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 hover:bg-primary/10"
            onClick={handleOpenCreate}
          >
            <Plus className="w-3 h-3 mr-1" />
            Nueva Categoría
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Categorías compartidas en todas las tiendas de la organización. Los venues pueden crear categorías locales con el mismo nombre para sobreescribirlas.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activeCategories.length > 0 ? (
          <div className="space-y-2">
            {activeCategories.map(category => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2.5 border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border border-border/50 shrink-0"
                    style={{ backgroundColor: category.color || '#888' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{category.name}</span>
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        ORG
                      </Badge>
                      {category.suggestedPrice != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          ${category.suggestedPrice.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(category.totalItems != null && category.totalItems > 0) && (
                    <span className="text-xs text-muted-foreground">
                      {category.availableItems} disp / {category.totalItems} total
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenEdit(category)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      data-testid="delete-org-category"
                      onClick={() => handleOpenDelete(category)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay categorías a nivel organización</p>
            <p className="text-xs mt-1">Crea categorías que se compartirán en todas las tiendas</p>
          </div>
        )}
      </GlassCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría de Organización' : 'Nueva Categoría de Organización'}
            </DialogTitle>
            <DialogDescription>
              Esta categoría estará disponible en todas las tiendas de la organización.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="org-cat-name">Nombre *</Label>
              <Input
                id="org-cat-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Chip Negra, SIM Prepago"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="org-cat-description">Descripción</Label>
              <Input
                id="org-cat-description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>

            {/* Color */}
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(preset => (
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
              <Label htmlFor="org-cat-price">Precio Sugerido (MXN)</Label>
              <Input
                id="org-cat-price"
                type="number"
                step="0.01"
                min="0"
                value={formData.suggestedPrice}
                onChange={e => setFormData({ ...formData, suggestedPrice: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Barcode Pattern */}
            <div className="grid gap-2">
              <Label htmlFor="org-cat-barcode">Patrón de Código de Barras (Regex)</Label>
              <Input
                id="org-cat-barcode"
                value={formData.barcodePattern}
                onChange={e => setFormData({ ...formData, barcodePattern: e.target.value })}
                placeholder="^89520[0-9]{14}$"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Expresión regular para auto-categorizar códigos de barras
              </p>
            </div>

            {/* Requires Pre-Registration */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Requiere Pre-Registro</Label>
                <p className="text-xs text-muted-foreground">
                  Los items deben registrarse antes de venderse
                </p>
              </div>
              <Switch
                checked={formData.requiresPreRegistration}
                onCheckedChange={checked => setFormData({ ...formData, requiresPreRegistration: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingCategory ? (
                'Guardar'
              ) : (
                'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría de organización?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory?.totalItems && deletingCategory.totalItems > 0
                ? `Esta categoría tiene ${deletingCategory.totalItems} items. Se desactivará pero los items se conservarán.`
                : 'Esta categoría se eliminará permanentemente de todas las tiendas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
