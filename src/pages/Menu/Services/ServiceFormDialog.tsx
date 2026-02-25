import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Users, Loader2, ImagePlus, Plus } from 'lucide-react'
import Cropper from 'react-easy-crop'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { createMenuCategory, getMenuCategories, getProduct, updateProduct } from '@/services/menu.service'
import { productWizardApi, type ProductType } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { ClassLayoutEditor, type LayoutConfig } from './ClassLayoutEditor'

interface ServiceFormData {
  name: string
  description: string
  price: number | string
  categoryId: string
  duration: number | string
  maxParticipants: number | string
  active: boolean
  imageUrl: string | null
  layoutConfig: LayoutConfig | null
}

interface ServiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (productId: string) => void
  mode: 'create' | 'edit'
  productId?: string
  serviceType?: ProductType | null
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  productId,
  serviceType,
}: ServiceFormDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Determine effective service type (from prop or from loaded product)
  const {
    data: existingProduct,
    isLoading: isLoadingProduct,
  } = useQuery({
    queryKey: ['product', venueId, productId],
    queryFn: () => getProduct(venueId!, productId!),
    enabled: !!venueId && !!productId && mode === 'edit' && open,
  })

  const effectiveType = mode === 'edit'
    ? (existingProduct?.type as ProductType | undefined)
    : serviceType

  const isAppointment = effectiveType === 'APPOINTMENTS_SERVICE'
  const isClass = effectiveType === 'CLASS'

  // Categories query
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId && open,
  })

  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: c.name })),
    [categories],
  )

  // Inline category creation
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const categoryInputRef = useRef<HTMLInputElement>(null)

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createMenuCategory(venueId!, { name }),
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories', venueId] })
      setValue('categoryId', newCat.id, { shouldValidate: true })
      setCreatingCategory(false)
      setNewCategoryName('')
      toast({ title: t('services.form.categoryCreated', { defaultValue: 'Categoria creada' }) })
    },
    onError: () => {
      toast({ title: tCommon('error'), variant: 'destructive' })
    },
  })

  const handleCreateCategory = useCallback(() => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    createCategoryMutation.mutate(trimmed)
  }, [newCategoryName, createCategoryMutation])

  // Image uploader
  const {
    uploading,
    imageUrl: uploadedImageUrl,
    imageForCrop,
    crop,
    zoom,
    onCropComplete,
    handleFileUpload,
    handleCropConfirm,
    handleFileRemove,
    setImageForCrop,
    setCrop,
    setZoom,
    setImageUrl: setUploaderImageUrl,
    initializeWithExistingUrl,
  } = useImageUploader(
    `venues/${venueId}/services`,
    'service',
  )

  // Form
  const form = useForm<ServiceFormData>({
    defaultValues: {
      name: '',
      description: '',
      price: '',
      categoryId: '',
      duration: '',
      maxParticipants: '',
      active: true,
      imageUrl: null,
      layoutConfig: null,
    },
  })

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = form

  // Initialize form with existing product data in edit mode
  useEffect(() => {
    if (mode === 'edit' && existingProduct && open) {
      reset({
        name: existingProduct.name,
        description: existingProduct.description || '',
        price: existingProduct.price,
        categoryId: existingProduct.categoryId,
        duration: existingProduct.duration ?? '',
        maxParticipants: existingProduct.maxParticipants ?? '',
        active: existingProduct.active,
        imageUrl: existingProduct.imageUrl,
        layoutConfig: (existingProduct as any).layoutConfig ?? null,
      })
      initializeWithExistingUrl(existingProduct.imageUrl)
    }
  }, [mode, existingProduct, open, reset, initializeWithExistingUrl])

  // Reset form when dialog opens in create mode
  useEffect(() => {
    if (mode === 'create' && open) {
      reset({
        name: '',
        description: '',
        price: '',
        categoryId: '',
        duration: isAppointment ? 60 : '',
        maxParticipants: isClass ? 15 : '',
        active: true,
        imageUrl: null,
        layoutConfig: null,
      })
      setUploaderImageUrl(null)
    }
  }, [mode, open, reset, isAppointment, isClass, setUploaderImageUrl])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const payload = {
        product: {
          name: data.name,
          description: data.description || undefined,
          price: Number(data.price),
          categoryId: data.categoryId,
          type: effectiveType,
          imageUrl: uploadedImageUrl || undefined,
          duration: isAppointment && data.duration ? Number(data.duration) : undefined,
          maxParticipants: isClass && data.maxParticipants ? Number(data.maxParticipants) : undefined,
          layoutConfig: isClass ? data.layoutConfig : undefined,
        },
        inventory: { useInventory: false },
      }
      return productWizardApi.createProductWithInventory(venueId!, payload)
    },
    onSuccess: (response) => {
      const resData = (response as any)?.data?.data ?? (response as any)?.data
      const productId = resData?.productId ?? resData?.id
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('services.toasts.created'),
        description: t('services.toasts.createdDesc'),
      })
      onOpenChange(false)
      onSuccess?.(productId)
    },
    onError: () => {
      toast({
        title: tCommon('error'),
        description: t('services.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || null,
        price: Number(data.price),
        categoryId: data.categoryId,
        active: data.active,
        imageUrl: uploadedImageUrl || null,
      }
      if (isAppointment) {
        payload.duration = data.duration ? Number(data.duration) : null
      }
      if (isClass) {
        payload.maxParticipants = data.maxParticipants ? Number(data.maxParticipants) : null
        payload.layoutConfig = data.layoutConfig
      }
      return updateProduct(venueId!, productId!, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      queryClient.invalidateQueries({ queryKey: ['product', venueId, productId] })
      toast({
        title: t('services.toasts.saved'),
        description: t('services.toasts.createdDesc'),
      })
      onOpenChange(false)
      onSuccess?.(productId!)
    },
    onError: () => {
      toast({
        title: tCommon('error'),
        description: t('services.toasts.errorDesc'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = handleSubmit((data) => {
    if (mode === 'create') {
      createMutation.mutate(data)
    } else {
      editMutation.mutate(data)
    }
  })

  const isSaving = createMutation.isPending || editMutation.isPending || isSubmitting
  const isLoading = mode === 'edit' && isLoadingProduct

  // File drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        handleFileUpload(file)
      }
    },
    [handleFileUpload],
  )

  // Watched values for preview
  const watchedName = watch('name')
  const watchedPrice = watch('price')
  const watchedDuration = watch('duration')
  const watchedMaxParticipants = watch('maxParticipants')

  const title = mode === 'create'
    ? t('services.form.createTitle')
    : t('services.form.editTitle')

  if (!open) return null

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      actions={
        <Button
          onClick={onSubmit}
          disabled={isSaving || isLoading || uploading || !!imageForCrop}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving
            ? t('services.form.saving')
            : mode === 'edit'
              ? tCommon('save')
              : tCommon('create')}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-12 gap-6">
            {/* ─── Main Column (col-span-8) ─── */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Type Badge (read-only) */}
              {effectiveType && (
                <Badge variant="secondary" className="gap-1.5 text-sm py-1 px-3">
                  {isAppointment ? (
                    <Calendar className="h-3.5 w-3.5" />
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )}
                  {isAppointment
                    ? t('services.types.service')
                    : t('services.types.class')}
                </Badge>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t('services.form.basicInfo')}
                </h3>

                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t('services.form.nameLabel')} *</Label>
                  <Input
                    id="name"
                    placeholder={isClass ? t('services.form.nameClassPlaceholder') : t('services.form.namePlaceholder')}
                    {...register('name', {
                      required: t('forms.validation.nameRequired'),
                      minLength: { value: 2, message: t('forms.validation.nameMinLength') },
                    })}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {/* Price */}
                <div className="space-y-1.5">
                  <Label htmlFor="price">{t('services.form.priceLabel')} *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t('services.form.pricePlaceholder')}
                      className="pl-7"
                      {...register('price', {
                        required: t('products.create.priceRequired'),
                        validate: (v) => Number(v) > 0 || t('products.create.pricePositive'),
                      })}
                    />
                  </div>
                  {errors.price && (
                    <p className="text-xs text-destructive">{errors.price.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description">{t('services.form.descriptionLabel')}</Label>
                  <Textarea
                    id="description"
                    placeholder={isClass ? t('services.form.descriptionClassPlaceholder') : t('services.form.descriptionPlaceholder')}
                    rows={3}
                    {...register('description')}
                  />
                </div>
              </div>

              {/* Service Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t('services.form.serviceConfig')}
                </h3>

                {isAppointment && (
                  <div className="space-y-1.5">
                    <Label htmlFor="duration">{t('services.form.durationLabel')}</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      placeholder={t('services.form.durationPlaceholder')}
                      {...register('duration', {
                        validate: (v) => !v || Number(v) > 0 || t('products.create.pricePositive'),
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('services.form.durationHelp')}
                    </p>
                  </div>
                )}

                {isClass && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="maxParticipants">{t('services.form.maxParticipantsLabel')}</Label>
                      <Input
                        id="maxParticipants"
                        type="number"
                        min="1"
                        placeholder={t('services.form.maxParticipantsPlaceholder')}
                        {...register('maxParticipants', {
                          validate: (v) => !v || Number(v) > 0 || t('products.create.pricePositive'),
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('services.form.maxParticipantsHelp')}
                      </p>
                    </div>

                    <Controller
                      name="layoutConfig"
                      control={control}
                      render={({ field }) => (
                        <ClassLayoutEditor
                          value={field.value}
                          onChange={(layout) => {
                            field.onChange(layout)
                            // Auto-sync maxParticipants from enabled spot count
                            if (layout) {
                              const enabledCount = layout.spots.filter(s => s.enabled).length
                              setValue('maxParticipants', enabledCount, { shouldDirty: true })
                            }
                          }}
                        />
                      )}
                    />
                  </>
                )}
              </div>

              {/* Image Upload */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t('services.form.serviceImage')}
                </h3>

                {imageForCrop ? (
                  <div className="space-y-4">
                    <div className="relative w-full h-64 bg-muted rounded-xl overflow-hidden">
                      <Cropper
                        image={imageForCrop}
                        crop={crop}
                        zoom={zoom}
                        maxZoom={2}
                        aspect={1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          handleCropConfirm()
                          setValue('imageUrl', uploadedImageUrl, { shouldDirty: true })
                        }}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {t('products.create.confirm')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setImageForCrop(null)}
                      >
                        {tCommon('cancel')}
                      </Button>
                    </div>
                  </div>
                ) : uploadedImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-40 h-40 rounded-xl overflow-hidden bg-muted">
                      <img
                        src={uploadedImageUrl}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = 'image/*'
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) handleFileUpload(file)
                          }
                          input.click()
                        }}
                      >
                        {t('products.create.replace')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleFileRemove()
                          setValue('imageUrl', null, { shouldDirty: true })
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        {t('products.create.delete')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:border-muted-foreground/50 transition-colors"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) handleFileUpload(file)
                      }
                      input.click()
                    }}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('products.create.dropImage')}
                    </p>
                    <p className="text-xs text-primary mt-1">
                      {t('products.create.browseFile')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Sidebar (col-span-4) ─── */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* Category */}
              <div className="space-y-1.5">
                <Label>{t('services.form.categoryLabel')} *</Label>
                <Controller
                  name="categoryId"
                  control={control}
                  rules={{ required: t('products.create.categoryRequired') }}
                  render={({ field }) => (
                    <SearchableSelect
                      options={categoryOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('products.create.categoryPlaceholder')}
                      searchPlaceholder={tCommon('search')}
                      emptyMessage={t('createMenu.fields.noCategoriesFound')}
                      footer={
                        creatingCategory ? (
                          <div className="flex items-center gap-1.5 px-1">
                            <Input
                              ref={categoryInputRef}
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              placeholder={t('services.form.newCategoryPlaceholder', { defaultValue: 'Nombre de la categoría' })}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleCreateCategory()
                                }
                                if (e.key === 'Escape') {
                                  setCreatingCategory(false)
                                  setNewCategoryName('')
                                }
                              }}
                              disabled={createCategoryMutation.isPending}
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 px-3 shrink-0"
                              onClick={handleCreateCategory}
                              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                            >
                              {createCategoryMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                tCommon('create')
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 text-primary font-medium"
                            onClick={() => {
                              setCreatingCategory(true)
                              setTimeout(() => categoryInputRef.current?.focus(), 50)
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t('services.form.createCategory', { defaultValue: 'Crear categoría' })}
                          </Button>
                        )
                      }
                    />
                  )}
                />
                {errors.categoryId && (
                  <p className="text-xs text-destructive">{errors.categoryId.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('services.form.categoryHelp')}
                </p>
              </div>

              {/* Active Switch */}
              <div className="space-y-1.5">
                <Label>{t('services.form.activeLabel')}</Label>
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className={
                          field.value
                            ? 'data-[state=checked]:bg-green-500'
                            : 'data-[state=unchecked]:bg-red-500'
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        {field.value ? t('services.filters.active') : t('services.filters.inactive')}
                      </span>
                    </div>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t('services.form.activeHelp')}
                </p>
              </div>

              {/* Preview Card */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">{t('services.form.preview')}</Label>
                <div className="border border-border rounded-xl p-4 space-y-3">
                  {uploadedImageUrl ? (
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={uploadedImageUrl}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-muted flex items-center justify-center">
                      {isAppointment ? (
                        <Calendar className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <Users className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm truncate">
                      {watchedName || (isClass ? t('services.form.nameClassPlaceholder') : t('services.form.namePlaceholder'))}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {watchedPrice ? (
                        <span>{Currency(Number(watchedPrice))}</span>
                      ) : (
                        <span>$0.00</span>
                      )}
                      {isAppointment && watchedDuration && (
                        <>
                          <span>&middot;</span>
                          <span>{t('services.detail.duration', { minutes: watchedDuration })}</span>
                        </>
                      )}
                      {isClass && watchedMaxParticipants && (
                        <>
                          <span>&middot;</span>
                          <span>{t('services.detail.participants', { count: Number(watchedMaxParticipants) })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </FullScreenModal>
  )
}
