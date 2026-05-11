import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, type ControllerRenderProps } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { LoadingButton } from '@/components/loading-button'
import { LoadingScreen } from '@/components/spinner'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import creditPackService from '@/services/creditPack.service'
import type { CreateCreditPackRequest } from '@/types/creditPack'
import api from '@/api'

interface ProductOption {
  id: string
  name: string
  price?: number | string | null
}

interface ProductPickerProps {
  products: ProductOption[]
  field: ControllerRenderProps<FormValues, `items.${number}.productId`>
  placeholder: string
  changeLabel: string
}

/**
 * Searchable product picker for the credit-pack items field array.
 *
 * Two states:
 *  1. Empty (no productId) → SearchCombobox with live filter
 *  2. Selected (productId set) → frozen pill with name + "cambiar" button
 *     that clears the field and re-opens the search.
 *
 * Local `search` state is scoped to this row so adding/removing rows in the
 * field array doesn't leak search terms between rows.
 */
function ProductPicker({ products, field, placeholder, changeLabel }: ProductPickerProps) {
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => (field.value ? products.find(p => p.id === field.value) ?? null : null),
    [products, field.value],
  )

  const items = useMemo<SearchComboboxItem[]>(() => {
    return products
      .filter(p => !search || includesNormalized(p.name ?? '', search))
      .map(p => ({
        id: p.id,
        label: p.name,
        endLabel:
          p.price != null && Number(p.price) > 0 ? `$${Number(p.price).toFixed(2)}` : undefined,
      }))
  }, [products, search])

  if (selected) {
    return (
      <div className="flex items-center gap-2 h-12 px-3 rounded-lg border border-input bg-transparent">
        <span className="text-sm flex-1 truncate">{selected.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground cursor-pointer"
          onClick={() => {
            field.onChange('')
            setSearch('')
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          {changeLabel}
        </Button>
      </div>
    )
  }

  return (
    <SearchCombobox
      placeholder={placeholder}
      items={items}
      value={search}
      onChange={setSearch}
      onSelect={item => {
        field.onChange(item.id)
        setSearch('')
      }}
    />
  )
}

interface CreditPackFormModalProps {
  open: boolean
  onClose: () => void
  packId?: string
  onSuccess: () => void
}

interface FormValues extends CreateCreditPackRequest {
  active: boolean
}

export default function CreditPackFormModal({ open, onClose, packId, onSuccess }: CreditPackFormModalProps) {
  const { t } = useTranslation('creditPacks')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isEditing = !!packId

  // Fetch existing pack if editing
  const { data: existingPack, isLoading: isLoadingPack } = useQuery({
    queryKey: ['credit-pack', venueId, packId],
    queryFn: () => creditPackService.getCreditPack(venueId, packId!),
    enabled: isEditing && open,
  })

  // Fetch venue products for selector
  const { data: productsData } = useQuery({
    queryKey: ['products', venueId, 'for-credit-packs'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/products?pageSize=200`)
      return res.data?.data || res.data || []
    },
    enabled: !!venueId && open,
  })

  const products = productsData || []

  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      currency: 'MXN',
      validityDays: undefined,
      maxPerCustomer: undefined,
      displayOrder: 0,
      items: [{ productId: '', quantity: 1 }],
      active: true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // Reset form when modal opens/closes or pack changes
  useEffect(() => {
    if (!open) return
    if (existingPack) {
      form.reset({
        name: existingPack.name,
        description: existingPack.description || '',
        price: existingPack.price,
        currency: existingPack.currency,
        validityDays: existingPack.validityDays || undefined,
        maxPerCustomer: existingPack.maxPerCustomer || undefined,
        displayOrder: existingPack.displayOrder,
        items: existingPack.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        active: existingPack.active,
      })
    } else if (!isEditing) {
      form.reset({
        name: '',
        description: '',
        price: 0,
        currency: 'MXN',
        validityDays: undefined,
        maxPerCustomer: undefined,
        displayOrder: 0,
        items: [{ productId: '', quantity: 1 }],
        active: true,
      })
    }
  }, [existingPack, form, open, isEditing])

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { active, ...packData } = data
      const cleaned = {
        ...packData,
        description: packData.description || undefined,
        validityDays: packData.validityDays || undefined,
        maxPerCustomer: packData.maxPerCustomer || undefined,
      }
      if (isEditing) {
        return creditPackService.updateCreditPack(venueId, packId!, cleaned)
      }
      return creditPackService.createCreditPack(venueId, cleaned)
    },
    onSuccess: () => {
      toast({
        title: isEditing ? t('toasts.updateSuccess') : t('toasts.createSuccess'),
      })
      queryClient.invalidateQueries({ queryKey: ['credit-packs', venueId] })
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data)
  }

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={form.watch('name') || (isEditing ? t('edit.title') : t('create.title'))}
      contentClassName="bg-muted/30"
      actions={
        <LoadingButton
          loading={mutation.isPending}
          onClick={form.handleSubmit(onSubmit)}
          variant="default"
        >
          {mutation.isPending ? tCommon('saving') : t('actions.save')}
        </LoadingButton>
      }
    >
      {isLoadingPack ? (
        <LoadingScreen message="Cargando paquete..." />
      ) : (
        <div className="max-w-2xl mx-auto px-6 py-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info Card */}
              <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                    <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-medium text-sm">
                    {isEditing ? t('edit.title') : t('create.title')}
                  </h3>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: { value: true, message: t('form.validation.nameRequired') } }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.fields.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('form.placeholders.name')} className="h-12 text-base" {...field} />
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
                      <FormLabel>{t('form.fields.description')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('form.placeholders.description')} className="text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    rules={{
                      required: { value: true, message: t('form.validation.priceRequired') },
                      min: { value: 0.01, message: t('form.validation.pricePositive') },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.fields.price')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={t('form.placeholders.price')}
                            className="h-12 text-base"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => {
                              const raw = e.target.value
                              // Allow clearing the input. `required` + `min` rules will reject
                              // empty/zero values on submit, so we don't need to backfill here.
                              field.onChange(raw === '' ? (undefined as unknown as number) : parseFloat(raw))
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.fields.currency')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'MXN'}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MXN">MXN</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="validityDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.fields.validityDays')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder={t('form.placeholders.validityDays')}
                            className="h-12 text-base"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxPerCustomer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.fields.maxPerCustomer')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder={t('form.placeholders.maxPerCustomer')}
                            className="h-12 text-base"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Items Card */}
              <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                      <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-medium text-sm">{t('form.fields.items')}</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ productId: '', quantity: 1 })}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('form.fields.addItem')}
                  </Button>
                </div>

                {fields.map((field, index) => (
                  // Grid with explicit column tracks — guarantees product +
                  // quantity sit side-by-side regardless of modal width. The
                  // previous flex layout was wrapping in narrower viewports.
                  <div
                    key={field.id}
                    className="grid items-end gap-3"
                    style={{ gridTemplateColumns: `1fr 96px ${fields.length > 1 ? 'auto' : ''}`.trim() }}
                  >
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      rules={{ required: { value: true, message: t('form.validation.productRequired') } }}
                      render={({ field: f }) => (
                        <FormItem className="min-w-0">
                          <FormLabel>{t('form.fields.product')}</FormLabel>
                          <FormControl>
                            <ProductPicker
                              products={products as ProductOption[]}
                              field={f}
                              placeholder={t('form.fields.product')}
                              changeLabel={tCommon('change', { defaultValue: 'Cambiar' })}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      rules={{
                        required: { value: true, message: t('form.validation.quantityRequired') },
                        min: { value: 1, message: t('form.validation.quantityPositive') },
                      }}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>{t('form.fields.quantity')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              className="h-12 text-base"
                              {...f}
                              value={f.value ?? ''}
                              onChange={e => {
                                const raw = e.target.value
                                // Allow clearing — `required` + `min:1` rules block submit if empty.
                                f.onChange(raw === '' ? (undefined as unknown as number) : parseInt(raw))
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mb-0.5 cursor-pointer">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </form>
          </Form>
        </div>
      )}
    </FullScreenModal>
  )
}
