import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Info, ListChecks, Package, Pencil, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import DnDMultipleSelector, { type Option } from '@/components/draggable-multi-select'
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
import { useToast } from '@/hooks/use-toast'
import {
  getModifierGroup,
  getProducts,
  updateModifierGroup,
  deleteModifier,
  assignModifierGroupToProduct,
  removeModifierGroupFromProduct,
} from '@/services/menu.service'
import { Currency } from '@/utils/currency'
import { PermissionGate } from '@/components/PermissionGate'
import type { Modifier } from '@/types'
import CreateModifier from '../createModifier'
import EditModifier from '../EditModifier'

interface ModifiersManagerDialogProps {
  venueId: string
  /** Group being managed, or null when closed. */
  modifierGroupId: string | null
  onClose: () => void
}

type SubView = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; modifier: Modifier }

type GroupFormValues = {
  name: string
  description: string
  required: boolean
  minSelections: number | undefined
  maxSelections: number | undefined
  products: Option[]
}

/**
 * Single consolidated editor for a modifier group: group settings, the
 * modifiers inside it (edit / delete / add, by id), and the products that use
 * it — no wizard. Reuses the standalone EditModifier and CreateModifier forms
 * (inventory tracking included).
 */
export function ModifiersManagerDialog({ venueId, modifierGroupId, onClose }: ModifiersManagerDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [subView, setSubView] = useState<SubView>({ kind: 'list' })
  const [modifierToDelete, setModifierToDelete] = useState<Modifier | null>(null)

  const open = !!modifierGroupId

  const { data: group, isLoading } = useQuery({
    queryKey: ['modifier-group', modifierGroupId, venueId],
    queryFn: () => getModifierGroup(venueId, modifierGroupId!),
    enabled: open && !!venueId,
  })

  const { data: allProducts } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId, { orderBy: 'name' }),
    enabled: open && !!venueId,
  })

  const form = useForm<GroupFormValues>({
    defaultValues: { name: '', description: '', required: false, minSelections: 0, maxSelections: 1, products: [] },
  })
  const watchRequired = form.watch('required')

  // Sync form when the group (or its product assignments) load
  useEffect(() => {
    if (!group || !allProducts) return
    form.reset({
      name: group.name ?? '',
      description: group.description ?? '',
      required: group.required ?? false,
      minSelections: typeof group.minSelections === 'number' ? group.minSelections : 0,
      maxSelections: typeof group.maxSelections === 'number' ? group.maxSelections : 1,
      products: allProducts
        .filter(p => p.modifierGroups?.some(mg => mg.groupId === group.id))
        .map(p => ({ label: p.name, value: p.id })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, allProducts])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['modifier-groups', venueId] })
    queryClient.invalidateQueries({ queryKey: ['modifier-group', modifierGroupId, venueId] })
    queryClient.invalidateQueries({ queryKey: ['products', venueId] })
  }

  const saveGroupMutation = useMutation({
    mutationFn: async (values: GroupFormValues) => {
      if (!modifierGroupId) return

      const tasks: Promise<unknown>[] = []

      const groupFieldsDirty =
        form.formState.dirtyFields.name ||
        form.formState.dirtyFields.description ||
        form.formState.dirtyFields.required ||
        form.formState.dirtyFields.minSelections ||
        form.formState.dirtyFields.maxSelections

      if (groupFieldsDirty) {
        const maxSelections = values.maxSelections ?? 1
        tasks.push(
          updateModifierGroup(venueId, modifierGroupId, {
            name: values.name.trim(),
            description: values.description.trim(),
            required: values.required,
            minSelections: values.minSelections ?? 0,
            maxSelections,
            allowMultiple: maxSelections > 1,
          }),
        )
      }

      if (form.formState.dirtyFields.products) {
        const desiredIds = values.products.map(p => p.value)
        const currentIds = (allProducts ?? [])
          .filter(p => p.modifierGroups?.some(mg => mg.groupId === modifierGroupId))
          .map(p => p.id)

        for (const [index, productId] of desiredIds.entries()) {
          if (!currentIds.includes(productId)) {
            tasks.push(assignModifierGroupToProduct(venueId, productId, { modifierGroupId, displayOrder: index }))
          }
        }
        for (const productId of currentIds) {
          if (!desiredIds.includes(productId)) {
            tasks.push(removeModifierGroupFromProduct(venueId, productId, modifierGroupId))
          }
        }
      }

      await Promise.all(tasks)
    },
    onSuccess: () => {
      toast({ title: t('modifiers.toasts.updated'), description: t('modifiers.toasts.saved') })
      invalidate()
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.updateError'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const deleteModifierMutation = useMutation({
    mutationFn: (modifierId: string) => deleteModifier(venueId, modifierGroupId!, modifierId),
    onSuccess: () => {
      toast({ title: t('modifiers.editor.deleted'), description: t('modifiers.editor.deletedDesc') })
      invalidate()
      setModifierToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: t('modifiers.toasts.deleteError'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const handleClose = () => {
    setSubView({ kind: 'list' })
    onClose()
  }

  const modifiers = group?.modifiers ?? []

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={subView.kind === 'edit' ? t('modifiers.editModifier.title') : group?.name ?? ''}
      subtitle={subView.kind === 'list' ? t('modifiers.editor.subtitle') : group?.name}
      contentClassName="bg-muted/30"
      actions={
        subView.kind === 'list' ? (
          <PermissionGate permission="menu:update">
            <Button
              type="button"
              data-tour="modifier-editor-save"
              disabled={!form.formState.isDirty || saveGroupMutation.isPending}
              onClick={form.handleSubmit(values => saveGroupMutation.mutate(values))}
            >
              {saveGroupMutation.isPending ? t('modifiers.toasts.saving') : t('modifiers.forms.save')}
            </Button>
          </PermissionGate>
        ) : null
      }
    >
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        {subView.kind === 'create' && modifierGroupId && (
          <div className="rounded-2xl border border-input bg-card p-6">
            <CreateModifier
              venueId={venueId}
              modifierGroupId={modifierGroupId}
              onBack={() => setSubView({ kind: 'list' })}
              onSuccess={() => {
                invalidate()
                setSubView({ kind: 'list' })
              }}
            />
          </div>
        )}

        {subView.kind === 'edit' && modifierGroupId && (
          <div className="rounded-2xl border border-input bg-card p-6">
            <EditModifier
              venueId={venueId}
              modifierId={subView.modifier.id}
              modifierGroupId={modifierGroupId}
              onBack={() => setSubView({ kind: 'list' })}
              onSuccess={() => {
                invalidate()
                setSubView({ kind: 'list' })
              }}
              initialValues={{
                name: subView.modifier.name,
                price: Number(subView.modifier.price ?? 0),
                durationMin: (subView.modifier as any).durationMin ?? null,
                active: subView.modifier.active ?? true,
                rawMaterialId: subView.modifier.rawMaterialId ?? null,
                rawMaterial: (subView.modifier.rawMaterial as any) ?? null,
                quantityPerUnit: subView.modifier.quantityPerUnit ?? null,
                unit: (subView.modifier.unit as string | null) ?? null,
                inventoryMode: subView.modifier.inventoryMode ?? null,
              }}
            />
          </div>
        )}

        {subView.kind === 'list' && (
          <>
            {isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t('forms.messages.loading')}</div>
            ) : (
              <Form {...form}>
                {/* ── Group settings ─────────────────────────────────── */}
                <section className="space-y-4 rounded-2xl border border-input bg-card p-6" data-tour="modifier-editor-group">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{t('modifiers.editor.groupSection')}</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    rules={{
                      required: { value: true, message: t('modifiers.detail.nameRequired') },
                      validate: value => value.trim() !== '' || t('modifiers.detail.nameRequired'),
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('modifiers.detail.groupName')}</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" placeholder={t('modifiers.detail.groupNamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('forms.description')}</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" placeholder={t('modifiers.detail.descriptionPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-input p-3">
                        <div className="space-y-0.5">
                          <FormLabel>{t('modifiers.createGroup.requiredSelection')}</FormLabel>
                          <p className="text-sm text-muted-foreground">{t('modifiers.createGroup.requiredSelectionDesc')}</p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={checked => {
                              field.onChange(checked)
                              if (checked && (form.getValues('minSelections') ?? 0) < 1) {
                                form.setValue('minSelections', 1, { shouldDirty: true })
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="minSelections"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('modifiers.createGroup.minSelections')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={watchRequired ? 1 : 0}
                              className="h-12 text-base"
                              value={field.value ?? ''}
                              onChange={e => {
                                const raw = e.target.value
                                field.onChange(raw === '' ? undefined : parseInt(raw))
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxSelections"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('modifiers.createGroup.maxSelections')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              className="h-12 text-base"
                              value={field.value ?? ''}
                              onChange={e => {
                                const raw = e.target.value
                                field.onChange(raw === '' ? undefined : parseInt(raw))
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {/* ── Modifiers in this group ────────────────────────── */}
                <section className="space-y-3 rounded-2xl border border-input bg-card p-6" data-tour="modifier-editor-list">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">{t('modifiers.editor.subtitle')}</h3>
                    </div>
                    <PermissionGate permission="menu:create">
                      <Button type="button" variant="outline" size="sm" data-tour="modifier-editor-add" onClick={() => setSubView({ kind: 'create' })}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('modifiers.editor.addModifier')}
                      </Button>
                    </PermissionGate>
                  </div>

                  {modifiers.length === 0 && (
                    <div className="rounded-xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
                      {t('modifiers.editor.empty')}
                    </div>
                  )}

                  {modifiers.map(modifier => (
                    <div
                      key={modifier.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSubView({ kind: 'edit', modifier })}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSubView({ kind: 'edit', modifier })
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-input p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{modifier.name}</span>
                          {!modifier.active && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                              {t('modifiers.editor.inactive')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {Number(modifier.price ?? 0) > 0 ? `+ ${Currency(Number(modifier.price))}` : t('modifiers.editor.free')}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                        <PermissionGate permission="menu:update">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={t('modifiers.editModifier.title')}
                            onClick={() => setSubView({ kind: 'edit', modifier })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="menu:delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer text-destructive hover:text-destructive"
                            aria-label={t('modifiers.actions.delete')}
                            onClick={() => setModifierToDelete(modifier)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </div>
                  ))}
                </section>

                {/* ── Products using this group ──────────────────────── */}
                <section className="space-y-3 rounded-2xl border border-input bg-card p-6" data-tour="modifier-editor-products">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{t('modifiers.forms.productsUsingGroup')}</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="products"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <DnDMultipleSelector
                            placeholder={t('modifiers.forms.selectProducts')}
                            options={(allProducts ?? []).map(p => ({ label: p.name, value: p.id }))}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>
              </Form>
            )}
          </>
        )}
      </div>

      <AlertDialog open={!!modifierToDelete} onOpenChange={isOpen => !isOpen && setModifierToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modifiers.editor.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modifiers.editor.deleteDescription', { name: modifierToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteModifierMutation.isPending}
              onClick={() => modifierToDelete && deleteModifierMutation.mutate(modifierToDelete.id)}
            >
              {deleteModifierMutation.isPending ? t('modifiers.dialogs.delete.deleting') : t('modifiers.dialogs.delete.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FullScreenModal>
  )
}
