import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { supplierService, CreateSupplierDto } from '@/services/supplier.service'
import { purchaseOrderService, Unit, CreatePurchaseOrderDto, PurchaseOrderStatus } from '@/services/purchaseOrder.service'
import { rawMaterialsApi } from '@/services/inventory.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Handshake, Plus, Trash2, Search, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Validation schema
const orderItemSchema = z.object({
  rawMaterialId: z.string().min(1, 'Selecciona un material'),
  quantityOrdered: z.number().positive('Cantidad debe ser mayor a 0'),
  unit: z.nativeEnum(Unit),
  unitPrice: z.number().positive('Precio debe ser mayor a 0'),
})

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Selecciona un proveedor'),
  orderDate: z.string().min(1, 'Fecha de orden requerida'),
  expectedDeliveryDate: z.string().optional(),
  shippingAddress: z.object({
    type: z.enum(['venue', 'custom']),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
  tax: z.object({
    enabled: z.boolean(),
    type: z.enum(['percentage', 'fixed']).optional(),
    rate: z.number().min(0).max(1).optional(),
    amount: z.number().min(0).optional(),
  }).optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'Agrega al menos un artículo'),
})

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>

interface PurchaseOrderWizardProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  purchaseOrder?: any // For edit mode - will be populated with existing PO data
  duplicateFrom?: any // For duplicate mode - will be populated with PO data to duplicate
  mode?: 'create' | 'edit'
}

export function PurchaseOrderWizard({ open, onClose, onSuccess, purchaseOrder, duplicateFrom, mode = 'create' }: PurchaseOrderWizardProps) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { venue } = useCurrentVenue()
  const isEditMode = mode === 'edit' && !!purchaseOrder
  const isDuplicateMode = mode === 'create' && !!duplicateFrom
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Debug logs (can be removed after testing)
  // console.log('🎨 PurchaseOrderWizard opened:', { open, mode, isEditMode, isDuplicateMode, duplicateFrom, purchaseOrder })

  // Supplier combobox state
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false)
  const [supplierSearchValue, setSupplierSearchValue] = useState('')

  // Expanded supplier form state
  const [isCreatingNewSupplier, setIsCreatingNewSupplier] = useState(false)
  const [newSupplierData, setNewSupplierData] = useState<Partial<CreateSupplierDto>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    contactName: '',
    notes: '',
  })

  // Tax state
  const [_taxEnabled, setTaxEnabled] = useState(false)
  const [taxDialogOpen, setTaxDialogOpen] = useState(false)
  const [taxType, setTaxType] = useState<'percentage' | 'fixed'>('percentage')

  // Shipping address state
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false)
  const [shippingType, setShippingType] = useState<'venue' | 'custom'>('venue')

  // Form setup - determine source data (edit, duplicate, or empty)
  const sourceData = isEditMode ? purchaseOrder : isDuplicateMode ? duplicateFrom : null
  // console.log('📝 Form sourceData:', { isEditMode, isDuplicateMode, sourceData })

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: sourceData ? {
      supplierId: sourceData.supplierId || '',
      orderDate: new Date().toISOString().split('T')[0], // Always use today's date for new/duplicate orders
      expectedDeliveryDate: sourceData.expectedDeliveryDate ? new Date(sourceData.expectedDeliveryDate).toISOString().split('T')[0] : '',
      shippingAddress: {
        type: sourceData.shippingAddressType === 'CUSTOM' ? 'custom' : 'venue',
        address: sourceData.shippingAddress || '',
        city: sourceData.shippingCity || '',
        state: sourceData.shippingState || '',
        zipCode: sourceData.shippingZipCode || '',
      },
      tax: {
        enabled: (Number(sourceData.taxRate) || 0) > 0,
        type: 'percentage',
        rate: Number(sourceData.taxRate) || 0,
        amount: 0,
      },
      notes: sourceData.notes || '',
      items: sourceData.items?.map((item: any) => ({
        rawMaterialId: item.rawMaterial?.id || item.rawMaterialId,
        quantityOrdered: Number(item.quantityOrdered),
        unit: item.rawMaterial?.unit || item.unit,
        unitPrice: Number(item.unitPrice),
      })) || [],
    } : {
      supplierId: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      shippingAddress: {
        type: 'venue',
        address: '',
        city: '',
        state: '',
        zipCode: '',
      },
      tax: {
        enabled: false,
        type: 'percentage',
        rate: 0,
        amount: 0,
      },
      notes: '',
      items: [
        {
          rawMaterialId: '',
          quantityOrdered: 0,
          unit: Unit.KILOGRAM,
          unitPrice: 0,
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // Reset form when duplicateFrom or purchaseOrder changes (for edit/duplicate mode)
  useEffect(() => {
    // console.log('🔄 useEffect triggered:', { open, hasSourceData: !!sourceData, isEditMode, isDuplicateMode })

    if (open && sourceData) {
      // console.log('🔄 Resetting form with sourceData:', sourceData)
      const formValues: PurchaseOrderFormValues = {
        supplierId: sourceData.supplierId || '',
        orderDate: isEditMode
          ? (sourceData.orderDate ? new Date(sourceData.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
          : new Date().toISOString().split('T')[0], // Always use today's date for duplicate
        expectedDeliveryDate: sourceData.expectedDeliveryDate ? new Date(sourceData.expectedDeliveryDate).toISOString().split('T')[0] : '',
        shippingAddress: {
          type: (sourceData.shippingAddressType === 'CUSTOM' ? 'custom' : 'venue') as 'venue' | 'custom',
          address: sourceData.shippingAddress || '',
          city: sourceData.shippingCity || '',
          state: sourceData.shippingState || '',
          zipCode: sourceData.shippingZipCode || '',
        },
        tax: {
          enabled: (Number(sourceData.taxRate) || 0) > 0,
          type: 'percentage',
          rate: Number(sourceData.taxRate) || 0,
          amount: 0,
        },
        notes: sourceData.notes || '',
        items: sourceData.items?.map((item: any) => ({
          rawMaterialId: item.rawMaterial?.id || item.rawMaterialId,
          quantityOrdered: Number(item.quantityOrdered),
          unit: item.rawMaterial?.unit || item.unit,
          unitPrice: Number(item.unitPrice),
        })) || [],
      }
      // console.log('📋 Form values to reset:', formValues)
      form.reset(formValues)
      // console.log('✅ Form reset complete')
    } else if (open && !sourceData) {
      // console.log('🆕 Resetting form to empty defaults')
      form.reset({
        supplierId: '',
        orderDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: '',
        shippingAddress: {
          type: 'venue',
          address: '',
          city: '',
          state: '',
          zipCode: '',
        },
        tax: {
          enabled: false,
          type: 'percentage',
          rate: 0,
          amount: 0,
        },
        notes: '',
        items: [
          {
            rawMaterialId: '',
            quantityOrdered: 0,
            unit: Unit.KILOGRAM,
            unitPrice: 0,
          },
        ],
      })
    }
  }, [open, sourceData, isEditMode, isDuplicateMode])

  // Queries
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', venue?.id, { active: true }],
    queryFn: () => supplierService.getSuppliers(venue!.id, { active: true }),
    enabled: !!venue,
  })

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials', venue?.id, { active: true }],
    queryFn: async () => {
      const response = await rawMaterialsApi.getAll(venue!.id, { active: true })
      return response.data
    },
    enabled: !!venue,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderDto) =>
      purchaseOrderService.createPurchaseOrder(venue!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast({ description: t('messages.createSuccess') })
      handleClose()
      onSuccess?.()
    },
    onError: () => {
      toast({ description: t('messages.createError'), variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderDto) =>
      purchaseOrderService.updatePurchaseOrder(venue!.id, purchaseOrder.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venue?.id, purchaseOrder.id] })
      toast({ description: t('messages.updateSuccess') })
      handleClose()
      onSuccess?.()
    },
    onError: () => {
      toast({ description: t('messages.updateError'), variant: 'destructive' })
    },
  })

  const createSupplierMutation = useMutation({
    mutationFn: (data: CreateSupplierDto) =>
      supplierService.createSupplier(venue!.id, data),
    onSuccess: (newSupplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ description: t('wizard.supplierCreated') })
      form.setValue('supplierId', newSupplier.data.id)
      form.clearErrors('supplierId')
      setIsCreatingNewSupplier(false)
      setSupplierSearchValue('')
    },
    onError: () => {
      toast({ description: t('wizard.supplierCreateError'), variant: 'destructive' })
    },
  })

  // Calculate totals - using useWatch for better reactivity
  const formItems = useWatch({ control: form.control, name: 'items' }) || []
  const formTax = useWatch({ control: form.control, name: 'tax' })

  const { subtotal, taxAmount, total } = useMemo(() => {
    const subtotal = formItems.reduce((sum, item) => {
      const qty = Number(item.quantityOrdered) || 0
      const price = Number(item.unitPrice) || 0
      return sum + (qty * price)
    }, 0)

    let taxAmount = 0
    if (formTax?.enabled) {
      if (formTax.type === 'percentage' && formTax.rate) {
        taxAmount = subtotal * Number(formTax.rate)
      } else if (formTax.type === 'fixed' && formTax.amount) {
        taxAmount = Number(formTax.amount)
      }
    }

    const total = subtotal + taxAmount

    return { subtotal, taxAmount, total }
  }, [formItems, formTax])

  // Handlers
  const handleClose = useCallback(() => {
    form.reset()
    setIsCreatingNewSupplier(false)
    setSupplierSearchValue('')
    onClose()
  }, [form, onClose])

  const handleSubmit = useCallback(
    async (saveAsDraft: boolean) => {
      const values = form.getValues()

      // Validate before submitting
      if (!values.supplierId) {
        toast({ description: t('validation.supplierRequired'), variant: 'destructive' })
        return
      }

      // Filter out empty/incomplete items before validation
      // An item is considered valid if it has: rawMaterialId, quantity > 0, and price > 0
      const validItems = values.items.filter(
        (item) => item.rawMaterialId && Number(item.quantityOrdered) > 0 && Number(item.unitPrice) > 0
      )

      if (validItems.length === 0) {
        toast({ description: t('validation.noItems'), variant: 'destructive' })
        return
      }

      // Calculate taxRate for backend (using only valid items)
      let taxRate = 0
      if (values.tax?.enabled) {
        if (values.tax.type === 'percentage' && values.tax.rate) {
          taxRate = Number(values.tax.rate)
        } else if (values.tax.type === 'fixed' && values.tax.amount) {
          // For fixed amount, calculate the equivalent percentage
          const subtotal = validItems.reduce((sum, item) => sum + Number(item.quantityOrdered) * Number(item.unitPrice), 0)
          taxRate = subtotal > 0 ? Number(values.tax.amount) / subtotal : 0
        }
      }

      const dto: CreatePurchaseOrderDto = {
        supplierId: values.supplierId,
        orderDate: new Date(values.orderDate).toISOString(),
        expectedDeliveryDate: values.expectedDeliveryDate ? new Date(values.expectedDeliveryDate).toISOString() : undefined,
        taxRate,
        notes: values.notes || undefined,
        // Shipping address
        shippingAddressType: values.shippingAddress?.type === 'custom' ? 'CUSTOM' : 'VENUE',
        shippingAddress: values.shippingAddress?.type === 'custom' ? values.shippingAddress.address : undefined,
        shippingCity: values.shippingAddress?.type === 'custom' ? values.shippingAddress.city : undefined,
        shippingState: values.shippingAddress?.type === 'custom' ? values.shippingAddress.state : undefined,
        shippingZipCode: values.shippingAddress?.type === 'custom' ? values.shippingAddress.zipCode : undefined,
        // Only send valid items (filtered above)
        items: validItems.map((item) => ({
          rawMaterialId: item.rawMaterialId,
          quantityOrdered: Number(item.quantityOrdered),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
        })),
      }

      try {
        if (isEditMode) {
          await updateMutation.mutateAsync(dto as any)
        } else {
          // Create the purchase order
          const response = await createMutation.mutateAsync(dto)
          const createdOrder = response?.data

          // If not saving as draft, move to CONFIRMED (ready to receive)
          // This skips APPROVED → SENT steps for quick workflow
          if (!saveAsDraft && createdOrder?.id) {
            await purchaseOrderService.updatePurchaseOrder(venue!.id, createdOrder.id, {
              status: PurchaseOrderStatus.CONFIRMED
            })
            queryClient.invalidateQueries({ queryKey: ['purchase-orders', venue!.id] })
            queryClient.invalidateQueries({ queryKey: ['purchase-order', venue!.id, createdOrder.id] })
            toast({ description: t('messages.createSuccess') })
          }
        }
      } catch (_error) {
        // Error handling is already done in mutation's onError
        if (!saveAsDraft) {
          toast({
            description: t('actions.submitApprovalError'),
            variant: 'destructive'
          })
        }
      }
    },
    [form, createMutation, updateMutation, isEditMode, toast, t, venue, queryClient]
  )

  const handleAddItem = useCallback(() => {
    append({
      rawMaterialId: '',
      quantityOrdered: 0,
      unit: Unit.KILOGRAM,
      unitPrice: 0,
    })
  }, [append])

  const formSupplierId = form.watch('supplierId')

  const selectedSupplier = useMemo(() => {
    return suppliers?.data?.find((s) => s.id === formSupplierId)
  }, [formSupplierId, suppliers])

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchValue) return suppliers?.data || []
    return (
      suppliers?.data?.filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierSearchValue.toLowerCase())
      ) || []
    )
  }, [suppliers, supplierSearchValue])

  // Handle create new supplier inline
  const handleStartCreatingSupplier = useCallback(() => {
    setIsCreatingNewSupplier(true)
    setNewSupplierData((prev) => ({ ...prev, name: supplierSearchValue }))
    setSupplierComboboxOpen(false)
  }, [supplierSearchValue])

  const handleCancelNewSupplier = useCallback(() => {
    setIsCreatingNewSupplier(false)
    setNewSupplierData({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      contactName: '',
      notes: '',
    })
    form.setValue('supplierId', '')
  }, [form])

  const handleSaveNewSupplier = useCallback(() => {
    if (!newSupplierData.name?.trim()) {
      toast({
        description: t('validation.supplierNameRequired'),
        variant: 'destructive',
      })
      return
    }

    const dto: CreateSupplierDto = {
      name: newSupplierData.name.trim(),
      email: newSupplierData.email || undefined,
      phone: newSupplierData.phone || undefined,
      address: newSupplierData.address || undefined,
      city: newSupplierData.city || undefined,
      state: newSupplierData.state || undefined,
      zipCode: newSupplierData.zipCode || undefined,
      contactName: newSupplierData.contactName || undefined,
      notes: newSupplierData.notes || undefined,
      active: true,
    }

    createSupplierMutation.mutate(dto)
  }, [newSupplierData, createSupplierMutation, toast, t])

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={isEditMode ? t('edit') : t('wizard.title')}
      actions={
        <div className="flex gap-2">
          {!isEditMode && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={createMutation.isPending}
              className="rounded-full"
            >
              {t('wizard.saveDraft')}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-full"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditMode ? t('actions.save') : t('wizard.submit')}
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Form {...form}>
          <form className="space-y-6">

            {/* Expanded New Supplier Form */}
            {isCreatingNewSupplier && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Handshake className="h-5 w-5 text-primary" />
                      <p className="font-medium">{t('wizard.newSupplierDetails')}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelNewSupplier}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {t('wizard.undoChanges')}
                    </Button>
                  </div>

                  <Separator />

                  {/* Supplier Name */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier-name">{t('wizard.supplierName')}</Label>
                    <Input
                      id="supplier-name"
                      value={newSupplierData.name}
                      onChange={(e) =>
                        setNewSupplierData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder={t('wizard.supplierNamePlaceholder')}
                    />
                  </div>

                  {/* Contact Name */}
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">{t('wizard.contactName')}</Label>
                    <Input
                      id="contact-name"
                      value={newSupplierData.contactName}
                      onChange={(e) =>
                        setNewSupplierData((prev) => ({ ...prev, contactName: e.target.value }))
                      }
                      placeholder={t('wizard.contactNamePlaceholder')}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier-email">{t('common:email')}</Label>
                    <Input
                      id="supplier-email"
                      type="email"
                      value={newSupplierData.email}
                      onChange={(e) =>
                        setNewSupplierData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder={t('wizard.emailPlaceholder')}
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier-phone">{t('common:phone')}</Label>
                    <Input
                      id="supplier-phone"
                      type="tel"
                      value={newSupplierData.phone}
                      onChange={(e) =>
                        setNewSupplierData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder={t('wizard.phonePlaceholder')}
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier-address">{t('wizard.address')}</Label>
                    <Input
                      id="supplier-address"
                      value={newSupplierData.address}
                      onChange={(e) =>
                        setNewSupplierData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder={t('wizard.addressPlaceholder')}
                    />
                  </div>

                  {/* City, State, Zip */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplier-city">{t('wizard.city')}</Label>
                      <Input
                        id="supplier-city"
                        value={newSupplierData.city}
                        onChange={(e) =>
                          setNewSupplierData((prev) => ({ ...prev, city: e.target.value }))
                        }
                        placeholder={t('wizard.cityPlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier-state">{t('wizard.state')}</Label>
                      <Input
                        id="supplier-state"
                        value={newSupplierData.state}
                        onChange={(e) =>
                          setNewSupplierData((prev) => ({ ...prev, state: e.target.value }))
                        }
                        placeholder={t('wizard.statePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier-zip">{t('wizard.zipCode')}</Label>
                      <Input
                        id="supplier-zip"
                        value={newSupplierData.zipCode}
                        onChange={(e) =>
                          setNewSupplierData((prev) => ({ ...prev, zipCode: e.target.value }))
                        }
                        placeholder={t('wizard.zipCodePlaceholder')}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="supplier-notes">{t('wizard.supplierNotes')}</Label>
                    <Textarea
                      id="supplier-notes"
                      value={newSupplierData.notes}
                      onChange={(e) =>
                        setNewSupplierData((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder={t('wizard.supplierNotesPlaceholder')}
                      rows={2}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleSaveNewSupplier}
                    disabled={!newSupplierData.name?.trim() || createSupplierMutation.isPending}
                    className="w-full"
                  >
                    {createSupplierMutation.isPending
                      ? t('common:saving')
                      : t('wizard.saveSupplier')}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Square-style Information Table */}
            <div className="overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 mb-px">
                <h3 className="font-semibold">Información del pedido</h3>
              </div>

              <div className="divide-y divide-border/50">
                {/* Nombre de proveedor */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="bg-muted/30 px-4 py-3 font-medium text-sm">
                    Nombre de proveedor
                  </div>
                  <div className="px-4 py-3 bg-background">
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen} modal={true}>
                            <PopoverTrigger asChild>
                              {!selectedSupplier ? (
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground text-sm text-left"
                                >
                                  Seleccionar proveedor
                                </button>
                              ) : (
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-sm">{selectedSupplier.name}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      form.setValue('supplierId', '')
                                    }}
                                    className="text-muted-foreground hover:text-foreground h-auto px-2 py-1 text-xs"
                                  >
                                    Cambiar
                                  </Button>
                                </div>
                              )}
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder={t('wizard.searchSupplierPlaceholder')}
                                  value={supplierSearchValue}
                                  onValueChange={setSupplierSearchValue}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    <div className="py-6 text-center text-sm">
                                      <p className="text-muted-foreground mb-3">
                                        {t('wizard.noSuppliersFound')}
                                      </p>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleStartCreatingSupplier}
                                        className="gap-2"
                                      >
                                        <Plus className="h-4 w-4" />
                                        {t('wizard.createSupplier', { name: supplierSearchValue || '...' })}
                                      </Button>
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {filteredSuppliers.map((supplier) => (
                                      <CommandItem
                                        key={supplier.id}
                                        value={supplier.id}
                                        onSelect={() => {
                                          form.setValue('supplierId', supplier.id)
                                          form.clearErrors('supplierId')
                                          setSupplierComboboxOpen(false)
                                          setSupplierSearchValue('')
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4',
                                            supplier.id === field.value ? 'opacity-100' : 'opacity-0'
                                          )}
                                        />
                                        <div className="flex-1">
                                          <p className="font-medium">{supplier.name}</p>
                                          {(supplier.email || supplier.phone) && (
                                            <div className="flex gap-3 text-xs text-muted-foreground">
                                              {supplier.email && <span>{supplier.email}</span>}
                                              {supplier.phone && <span>{supplier.phone}</span>}
                                            </div>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Enviar a */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="bg-muted/30 px-4 py-3 font-medium text-sm">
                    Enviar a
                  </div>
                  <div className="px-4 py-3 bg-background">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        {form.watch('shippingAddress.type') === 'custom' && form.watch('shippingAddress.address') ? (
                          <div>
                            <div className="font-medium text-foreground">{form.watch('shippingAddress.address')}</div>
                            <div className="text-muted-foreground">
                              {[
                                form.watch('shippingAddress.city'),
                                form.watch('shippingAddress.state'),
                                form.watch('shippingAddress.zipCode')
                              ].filter(Boolean).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-foreground">{venue?.name || 'Seleccionar dirección'}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const currentType = form.getValues('shippingAddress.type')
                          if (currentType) {
                            setShippingType(currentType)
                          }
                          setShippingDialogOpen(true)
                        }}
                        className="text-muted-foreground hover:text-foreground h-auto px-2 py-1 text-xs"
                      >
                        Cambiar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Fecha prevista */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="bg-muted/30 px-4 py-3 font-medium text-sm">
                    Fecha prevista
                  </div>
                  <div className="px-4 py-3 bg-background">
                    <FormField
                      control={form.control}
                      name="expectedDeliveryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById('expected-delivery-date') as HTMLInputElement
                                input?.showPicker()
                              }}
                              className={cn(
                                'text-sm text-left',
                                field.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {field.value 
                                ? field.value.split('-').reverse().join('/') 
                                : 'Establecer fecha prevista'}
                            </button>
                          </FormControl>
                          <input
                            id="expected-delivery-date"
                            type="date"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="sr-only"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="bg-muted/30 px-4 py-3 font-medium text-sm">
                    Notas
                  </div>
                  <div className="px-4 py-3 bg-background">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Añadir nota"
                              {...field}
                              rows={3}
                              className="resize-none text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden orderDate field - maintains current date as default */}
            <FormField
              control={form.control}
              name="orderDate"
              render={({ field }) => (
                <input type="hidden" {...field} />
              )}
            />

            {/* Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">{t('wizard.addItems')}</Label>
                  {selectedSupplier && (
                    <p className="text-sm text-muted-foreground">
                      {t('wizard.supplier')}: <span className="font-medium">{selectedSupplier.name}</span>
                    </p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('wizard.addItem')}
                </Button>
              </div>

              <div className="rounded-lg overflow-hidden bg-muted/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('wizard.columns.material')}</TableHead>
                      <TableHead>{t('wizard.columns.quantity')}</TableHead>
                      <TableHead>{t('wizard.columns.unitPrice')}</TableHead>
                      <TableHead>{t('wizard.columns.subtotal')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const item = form.watch(`items.${index}`)
                      const qty = Number(item?.quantityOrdered) || 0
                      const price = Number(item?.unitPrice) || 0
                      const itemSubtotal = qty * price

                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.rawMaterialId`}
                              render={({ field }) => (
                                <FormItem>
                                  <MaterialCombobox
                                    materials={rawMaterials?.data || []}
                                    value={field.value}
                                    onChange={(value) => field.onChange(value)}
                                  />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantityOrdered`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0"
                                      value={field.value || ''}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === '') {
                                          field.onChange(0)
                                        } else {
                                          const parsed = parseFloat(value)
                                          if (!isNaN(parsed)) {
                                            field.onChange(parsed)
                                          }
                                        }
                                      }}
                                      onBlur={field.onBlur}
                                      name={field.name}
                                      ref={field.ref}
                                      className="w-24"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                      value={field.value || ''}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === '') {
                                          field.onChange(0)
                                        } else {
                                          const parsed = parseFloat(value)
                                          if (!isNaN(parsed)) {
                                            field.onChange(parsed)
                                          }
                                        }
                                      }}
                                      onBlur={field.onBlur}
                                      name={field.name}
                                      ref={field.ref}
                                      className="w-24"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              ${itemSubtotal.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end space-y-2">
                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('wizard.subtotal')}</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>

                  {/* Tax Section */}
                  {!form.watch('tax.enabled') ? (
                    <div className="border-t pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Sync taxType with current form value
                          const currentType = form.getValues('tax.type')
                          if (currentType) {
                            setTaxType(currentType)
                          }
                          setTaxDialogOpen(true)
                        }}
                        className="text-sm font-medium underline hover:no-underline cursor-pointer"
                      >
                        Añadir impuesto
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 border-t pt-2">
                      <div className="flex justify-between text-sm items-center">
                        <button
                          type="button"
                          onClick={() => {
                            const currentType = form.getValues('tax.type')
                            if (currentType) {
                              setTaxType(currentType)
                            }
                            setTaxDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {formTax?.type === 'percentage'
                            ? `IVA (${(formTax?.rate || 0) * 100}%)`
                            : 'Impuesto'}
                        </button>
                        <span className="font-medium">${taxAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">{t('wizard.total')}</span>
                    <span className="font-semibold text-lg">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Form>

        {/* Tax Dialog */}
        <Dialog open={taxDialogOpen} onOpenChange={setTaxDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Añadir impuesto</DialogTitle>
              <DialogDescription>
                Configura el impuesto para este pedido
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {/* Square-style table */}
              <div className="overflow-hidden border rounded-lg">
                <div className="divide-y divide-border/50">
                  {/* Nombre row */}
                  <div className="grid grid-cols-[200px_1fr]">
                    <div className="bg-muted/30 px-4 py-3 font-medium text-sm">
                      Nombre
                    </div>
                    <div className="px-4 py-3 bg-background text-sm">
                      Impuesto
                    </div>
                  </div>

                  {/* Importe row */}
                  <div className="grid grid-cols-[200px_1fr]">
                    <div className="bg-muted/30 px-4 py-3 font-medium text-sm">
                      Importe
                    </div>
                    <div className="px-4 py-3 bg-background">
                      <div className="flex gap-2 items-center">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={
                            taxType === 'percentage'
                              ? form.watch('tax.rate') ? (form.watch('tax.rate')! * 100).toString() : ''
                              : form.watch('tax.amount')?.toString() || ''
                          }
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === '') {
                              if (taxType === 'percentage') {
                                form.setValue('tax.rate', 0)
                              } else {
                                form.setValue('tax.amount', 0)
                              }
                            } else {
                              const parsed = parseFloat(value)
                              if (!isNaN(parsed)) {
                                if (taxType === 'percentage') {
                                  if (parsed >= 0 && parsed <= 100) {
                                    form.setValue('tax.rate', parsed / 100)
                                  }
                                } else {
                                  form.setValue('tax.amount', parsed)
                                }
                              }
                            }
                          }}
                          className="w-32 h-9 text-sm"
                        />
                        <div className="flex rounded-md overflow-hidden border">
                          <button
                            type="button"
                            onClick={() => {
                              setTaxType('percentage')
                              form.setValue('tax.type', 'percentage')
                              form.setValue('tax.amount', 0)
                            }}
                            className={cn(
                              'px-3 py-1.5 text-sm font-medium transition-colors',
                              taxType === 'percentage'
                                ? 'bg-foreground text-background'
                                : 'bg-background hover:bg-muted'
                            )}
                          >
                            %
                          </button>
                          <div className="w-px bg-border" />
                          <button
                            type="button"
                            onClick={() => {
                              setTaxType('fixed')
                              form.setValue('tax.type', 'fixed')
                              form.setValue('tax.rate', 0)
                            }}
                            className={cn(
                              'px-3 py-1.5 text-sm font-medium transition-colors',
                              taxType === 'fixed'
                                ? 'bg-foreground text-background'
                                : 'bg-background hover:bg-muted'
                            )}
                          >
                            $
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  form.setValue('tax.enabled', true)
                  setTaxEnabled(true)
                  setTaxDialogOpen(false)
                }}
                className="rounded-full px-6"
              >
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shipping Address Dialog */}
        <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Dirección de envío</DialogTitle>
              <DialogDescription>
                Selecciona dónde deseas recibir este pedido
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Radio buttons para tipo de dirección */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setShippingType('venue')
                    form.setValue('shippingAddress.type', 'venue')
                  }}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border-2 transition-all',
                    shippingType === 'venue'
                      ? 'border-foreground bg-muted/50'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      shippingType === 'venue' ? 'border-foreground' : 'border-border'
                    )}>
                      {shippingType === 'venue' && (
                        <div className="w-2 h-2 rounded-full bg-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Enviar a {venue?.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {venue?.address && (
                          <>
                            {venue.address}
                            {venue.city && `, ${venue.city}`}
                            {venue.state && `, ${venue.state}`}
                            {venue.zipCode && ` ${venue.zipCode}`}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShippingType('custom')
                    form.setValue('shippingAddress.type', 'custom')
                  }}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border-2 transition-all',
                    shippingType === 'custom'
                      ? 'border-foreground bg-muted/50'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      shippingType === 'custom' ? 'border-foreground' : 'border-border'
                    )}>
                      {shippingType === 'custom' && (
                        <div className="w-2 h-2 rounded-full bg-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Otra dirección</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enviar a una dirección diferente
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Campos de dirección personalizada */}
              {shippingType === 'custom' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label htmlFor="custom-address" className="text-sm">Dirección</Label>
                    <Input
                      id="custom-address"
                      placeholder="Calle y número"
                      value={form.watch('shippingAddress.address') || ''}
                      onChange={(e) => form.setValue('shippingAddress.address', e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="custom-city" className="text-sm">Ciudad</Label>
                      <Input
                        id="custom-city"
                        placeholder="Ciudad"
                        value={form.watch('shippingAddress.city') || ''}
                        onChange={(e) => form.setValue('shippingAddress.city', e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="custom-state" className="text-sm">Estado</Label>
                      <Input
                        id="custom-state"
                        placeholder="Estado"
                        value={form.watch('shippingAddress.state') || ''}
                        onChange={(e) => form.setValue('shippingAddress.state', e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="custom-zip" className="text-sm">Código Postal</Label>
                    <Input
                      id="custom-zip"
                      placeholder="00000"
                      value={form.watch('shippingAddress.zipCode') || ''}
                      onChange={(e) => form.setValue('shippingAddress.zipCode', e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShippingDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => setShippingDialogOpen(false)}
                className="rounded-full px-6"
              >
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </FullScreenModal>
  )
}

// Material Combobox Component
interface MaterialComboboxProps {
  materials: Array<{ id: string; name: string; unit: string }>
  value: string
  onChange: (value: string) => void
}

function MaterialCombobox({ materials, value, onChange }: MaterialComboboxProps) {
  const { t } = useTranslation('purchaseOrders')
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const filteredMaterials = useMemo(() => {
    if (!searchValue) return materials
    return materials.filter((m) =>
      m.name.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [materials, searchValue])

  const selectedMaterial = materials.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground'
          )}
        >
          {selectedMaterial ? selectedMaterial.name : t('wizard.selectMaterial')}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('wizard.searchMaterialPlaceholder')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{t('wizard.noMaterialsFound')}</CommandEmpty>
            <ScrollArea className="h-[300px]">
              <CommandGroup>
                {filteredMaterials.map((material) => (
                  <CommandItem
                    key={material.id}
                    value={material.id}
                    onSelect={() => {
                      onChange(material.id)
                      setOpen(false)
                      setSearchValue('')
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        material.id === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{material.name}</p>
                      <p className="text-xs text-muted-foreground">{material.unit}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
