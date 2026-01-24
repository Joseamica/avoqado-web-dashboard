import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { purchaseOrderService, formatPrice, PurchaseOrderItemStatus, PurchaseOrderStatus } from '@/services/purchaseOrder.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Package, Edit, Loader2, MoreHorizontal } from 'lucide-react'
import { POActions } from './components/POActions'
import { getStatusBadgeColor } from '@/services/purchaseOrder.service'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'

const formatDateMx = (value?: string | Date | null) => {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const day = new Intl.DateTimeFormat('es-MX', { day: '2-digit' }).format(date)
  const month = new Intl.DateTimeFormat('es-MX', { month: '2-digit' }).format(date)
  const year = new Intl.DateTimeFormat('es-MX', { year: 'numeric' }).format(date)
  return `${day}/${month}/${year}`
}

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { formatUnitWithQuantity } = useUnitTranslation()
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()
  const { venue, fullBasePath } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editFeesOpen, setEditFeesOpen] = useState(false)
  const [editingFees, setEditingFees] = useState({ taxRate: 0, commissionRate: 0 })

  // Local state for received quantities (Square flow - changes stay in frontend until "Save")
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Local state for item statuses (damaged, not_processed, etc.)
  const [localItemStatuses, setLocalItemStatuses] = useState<Record<string, 'damaged' | 'not_processed' | null>>({})

  // Dialog state for receiving individual items
  const [receiveItemDialog, setReceiveItemDialog] = useState<{
    open: boolean
    item: any | null
    quantity: number
  }>({ open: false, item: null, quantity: 0 })

  // Fetch purchase order
  const { data: response, isLoading } = useQuery({
    queryKey: ['purchase-order', venue?.id, poId],
    queryFn: () => purchaseOrderService.getPurchaseOrder(venue!.id, poId!),
    enabled: !!venue && !!poId,
  })

  const purchaseOrder = response?.data

  // Split items for display: show partial receives as two separate rows
  const displayItems = useMemo(() => {
    if (!purchaseOrder?.items) return []

    const items: Array<any & { isSplitRemaining?: boolean; originalItemId?: string }> = []

    purchaseOrder.items.forEach(item => {
      const localReceivedQty = localQuantities[item.id] ?? Number(item.quantityReceived || 0)
      const quantityOrdered = Number(item.quantityOrdered)

      // Item is partially received (0 < received < ordered)
      if (localReceivedQty > 0 && localReceivedQty < quantityOrdered) {
        // First row: Received portion
        items.push({
          ...item,
          id: `${item.id}-received`,
          quantityOrdered: localReceivedQty,
          isSplitRemaining: false,
          originalItemId: item.id,
        })

        // Second row: Remaining portion (editable)
        items.push({
          ...item,
          id: `${item.id}-remaining`,
          quantityOrdered: quantityOrdered - localReceivedQty,
          isSplitRemaining: true,
          originalItemId: item.id,
        })
      } else {
        // Not split: show as single row
        items.push(item)
      }
    })

    return items
  }, [purchaseOrder?.items, localQuantities])

  // Initialize local quantities and statuses when purchase order loads
  useEffect(() => {
    if (purchaseOrder?.items) {
      const initialQuantities: Record<string, number> = {}
      const initialStatuses: Record<string, 'damaged' | 'not_processed' | null> = {}

      purchaseOrder.items.forEach(item => {
        initialQuantities[item.id] = Number(item.quantityReceived || 0)
        // Initialize status based on backend receiveStatus
        if (item.receiveStatus === PurchaseOrderItemStatus.DAMAGED) {
          initialStatuses[item.id] = 'damaged'
        } else if (item.receiveStatus === PurchaseOrderItemStatus.NOT_PROCESSED) {
          initialStatuses[item.id] = 'not_processed'
        } else {
          initialStatuses[item.id] = null
        }
      })

      setLocalQuantities(initialQuantities)
      setLocalItemStatuses(initialStatuses)
      setHasUnsavedChanges(false)
    }
  }, [purchaseOrder])

  // Mutation to update fees
  const updateFeesMutation = useMutation({
    mutationFn: (fees: { taxRate?: number; commissionRate?: number }) =>
      purchaseOrderService.updatePurchaseOrderFees(venue!.id, poId!, fees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venue?.id, poId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venue?.id] })
      toast({ description: t('actions.updateFeesSuccess') })
      setEditFeesOpen(false)
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.updateFeesError'),
        variant: 'destructive',
      })
    },
  })

  // Open receive dialog for an item (Square flow - dialog updates local state only)
  const openReceiveDialog = (item: any) => {
    // For split remaining items, default to the remaining quantity
    // For regular items, default to full ordered quantity
    const itemId = item.originalItemId || item.id
    const currentReceived = localQuantities[itemId] || Number(item.quantityReceived || 0)
    const fullQuantityOrdered = purchaseOrder?.items.find(i => i.id === itemId)?.quantityOrdered || item.quantityOrdered
    const remainingQuantity = Number(fullQuantityOrdered) - currentReceived

    setReceiveItemDialog({
      open: true,
      item: {
        ...item,
        id: itemId, // Use original item ID
        quantityOrdered: item.isSplitRemaining ? remainingQuantity : Number(item.quantityOrdered),
      },
      quantity: item.isSplitRemaining ? remainingQuantity : Number(item.quantityOrdered),
    })
  }

  // Save from receive dialog (updates local state only, NOT backend)
  const handleSaveReceiveDialog = () => {
    if (!receiveItemDialog.item) return

    const itemId = receiveItemDialog.item.id
    const quantityOrdered = Number(receiveItemDialog.item.quantityOrdered)
    const quantityReceiving = receiveItemDialog.quantity

    // Validation: Cannot receive more than the amount shown in the dialog
    if (quantityReceiving > quantityOrdered) {
      toast({
        variant: 'destructive',
        description: t('actions.cannotExceedOrdered'),
      })
      return
    }

    // For split remaining items, ADD to existing received quantity
    // For regular items, SET the received quantity
    const currentReceived = localQuantities[itemId] || 0
    const isSplitItem = receiveItemDialog.item.isSplitRemaining === true
    const newReceivedQuantity = isSplitItem ? currentReceived + quantityReceiving : quantityReceiving

    // Update local state
    setLocalQuantities(prev => ({
      ...prev,
      [itemId]: newReceivedQuantity,
    }))
    // Clear damaged/not_processed status when receiving
    setLocalItemStatuses(prev => ({
      ...prev,
      [itemId]: null,
    }))
    setHasUnsavedChanges(true)

    // Close dialog
    setReceiveItemDialog({ open: false, item: null, quantity: 0 })

    // Close dialog
    setReceiveItemDialog({ open: false, item: null, quantity: 0 })
  }

  // Mark item as damaged (local state only) - reserved for future use
  const _markItemDamaged = (itemId: string) => {
    setLocalItemStatuses(prev => ({
      ...prev,
      [itemId]: 'damaged',
    }))
    // Set quantity to 0 when marking as damaged
    setLocalQuantities(prev => ({
      ...prev,
      [itemId]: 0,
    }))
    setHasUnsavedChanges(true)
  }

  // Mark item as not processed (local state only) - reserved for future use
  const _markItemNotProcessed = (itemId: string) => {
    setLocalItemStatuses(prev => ({
      ...prev,
      [itemId]: 'not_processed',
    }))
    // Set quantity to 0 when marking as not processed
    setLocalQuantities(prev => ({
      ...prev,
      [itemId]: 0,
    }))
    setHasUnsavedChanges(true)
  }

  // Receive all items (set all quantities to ordered amount)
  // BUT keep items that are already saved as damaged or not_processed
  const handleReceiveAll = () => {
    if (!purchaseOrder?.items) return
    const newQuantities: Record<string, number> = {}
    const newStatuses: Record<string, 'damaged' | 'not_processed' | null> = {}

    purchaseOrder.items.forEach(item => {
      // Check if item has a saved status in backend
      const hasSavedDamagedStatus = item.receiveStatus === PurchaseOrderItemStatus.DAMAGED
      const hasSavedNotProcessedStatus = item.receiveStatus === PurchaseOrderItemStatus.NOT_PROCESSED
      const hasSavedReceivedStatus = Number(item.quantityReceived || 0) > 0

      // Keep saved statuses, only update items without a saved status
      if (hasSavedDamagedStatus) {
        newQuantities[item.id] = 0
        newStatuses[item.id] = 'damaged'
      } else if (hasSavedNotProcessedStatus) {
        newQuantities[item.id] = 0
        newStatuses[item.id] = 'not_processed'
      } else if (hasSavedReceivedStatus) {
        // Keep the saved received quantity
        newQuantities[item.id] = Number(item.quantityReceived)
        newStatuses[item.id] = null
      } else {
        // Item has no saved status, mark as received
        newQuantities[item.id] = Number(item.quantityOrdered)
        newStatuses[item.id] = null
      }
    })

    setLocalQuantities(newQuantities)
    setLocalItemStatuses(newStatuses)
    setHasUnsavedChanges(true)
  }

  // Receive none (revert unsaved changes to backend values)
  const handleReceiveNone = () => {
    if (!purchaseOrder?.items) return
    const newQuantities: Record<string, number> = {}
    const newStatuses: Record<string, 'damaged' | 'not_processed' | null> = {}

    purchaseOrder.items.forEach(item => {
      // Keep saved values from backend, only reset unsaved local changes
      const savedQuantity = Number(item.quantityReceived || 0)
      newQuantities[item.id] = savedQuantity

      // Keep saved status from backend
      if (item.receiveStatus === PurchaseOrderItemStatus.DAMAGED) {
        newStatuses[item.id] = 'damaged'
      } else if (item.receiveStatus === PurchaseOrderItemStatus.NOT_PROCESSED) {
        newStatuses[item.id] = 'not_processed'
      } else {
        newStatuses[item.id] = null
      }
    })

    setLocalQuantities(newQuantities)
    setLocalItemStatuses(newStatuses)
    setHasUnsavedChanges(false) // No unsaved changes after reverting to backend state
  }

  // Save all changes to backend (Square flow)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseOrder?.items) return

      // Process all items and collect changes
      const promises: Promise<any>[] = []

      purchaseOrder.items.forEach(item => {
        const itemId = item.id
        const quantity = localQuantities[itemId] || 0
        const status = localItemStatuses[itemId]

        // If item is marked as damaged
        if (status === 'damaged') {
          promises.push(
            purchaseOrderService.updatePurchaseOrderItemStatus(venue!.id, poId!, itemId, {
              receiveStatus: PurchaseOrderItemStatus.DAMAGED,
              quantityReceived: 0,
            })
          )
        }
        // If item is marked as not processed
        else if (status === 'not_processed') {
          promises.push(
            purchaseOrderService.updatePurchaseOrderItemStatus(venue!.id, poId!, itemId, {
              receiveStatus: PurchaseOrderItemStatus.NOT_PROCESSED,
              quantityReceived: 0,
            })
          )
        }
        // If item has quantity to receive
        else if (quantity > 0) {
          promises.push(
            purchaseOrderService.updatePurchaseOrderItemStatus(venue!.id, poId!, itemId, {
              receiveStatus: PurchaseOrderItemStatus.RECEIVED,
              quantityReceived: quantity,
            })
          )
        }
      })

      // Execute all updates in parallel
      await Promise.all(promises)

      // After all items are updated, recalculate order status
      await purchaseOrderService.recalculateStatus(venue!.id, poId!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venue?.id, poId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['inventory-summary', venue?.id] })
      toast({ description: t('actions.receiveSuccess') })
      setHasUnsavedChanges(false)
    },
    onError: (error: any) => {
      toast({ description: error.response?.data?.message || t('actions.receiveError'), variant: 'destructive' })
    },
  })


  // Status badge
  const statusBadge = useMemo(() => {
    if (!purchaseOrder) return null
    const { variant, className } = getStatusBadgeColor(purchaseOrder.status)
    return (
      <Badge variant={variant} className={className}>
        {t(`statuses.${purchaseOrder.status}`)}
      </Badge>
    )
  }, [purchaseOrder, t])


  // Open edit fees dialog
  const openEditFees = () => {
    if (purchaseOrder) {
      setEditingFees({
        taxRate: purchaseOrder.taxRate * 100,
        commissionRate: purchaseOrder.commissionRate * 100,
      })
      setEditFeesOpen(true)
    }
  }

  // Save fees
  const handleSaveFees = () => {
    updateFeesMutation.mutate({
      taxRate: editingFees.taxRate / 100,
      commissionRate: editingFees.commissionRate / 100,
    })
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (!purchaseOrder) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('common:notFound')}</p>
          <Button
            variant="outline"
            onClick={() => navigate(`${fullBasePath}/inventory/purchase-orders`)}
            className="mt-4"
          >
            {t('common:goBack')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`${fullBasePath}/inventory/purchase-orders`)}
              className="mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {purchaseOrder.orderNumber}
              </h1>
              {statusBadge}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <POActions
              purchaseOrder={purchaseOrder}
              hasUnsavedChanges={hasUnsavedChanges}
              onSave={() => saveMutation.mutate()}
              isSaving={saveMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Order Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 border-y">
        {/* Left Column: Supplier & Account */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            {t('details.supplier')}
          </h3>
          <div className="space-y-1">
            <p className="font-medium text-lg">{purchaseOrder.supplier.name}</p>
            {purchaseOrder.supplier.contactName && (
              <p className="text-sm text-muted-foreground">{purchaseOrder.supplier.contactName}</p>
            )}
            {purchaseOrder.supplier.email && (
              <p className="text-sm text-muted-foreground">{purchaseOrder.supplier.email}</p>
            )}
            {purchaseOrder.supplier.phone && (
              <p className="text-sm text-muted-foreground">{purchaseOrder.supplier.phone}</p>
            )}
          </div>
        </div>

        {/* Right Column: Order Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            {t('details.orderInfo')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground block mb-1">{t('details.orderDate')}</span>
              <span className="font-medium">
                {formatDateMx(purchaseOrder.orderDate)}
              </span>
            </div>
            {purchaseOrder.expectedDeliveryDate && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">{t('details.expectedDelivery')}</span>
                <span className="font-medium">
                  {formatDateMx(purchaseOrder.expectedDeliveryDate)}
                </span>
              </div>
            )}
            <div>
              <span className="text-sm text-muted-foreground block mb-1">{t('details.createdBy')}</span>
              <span className="font-medium">
                {purchaseOrder.createdBy?.name || purchaseOrder.createdBy?.email || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block mb-1">{t('details.createdAt')}</span>
              <span className="font-medium">
                {formatDateMx(purchaseOrder.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('details.items')}</h3>
          {purchaseOrder.status !== 'RECEIVED' && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReceiveAll}
                disabled={saveMutation.isPending}
              >
                {t('actions.receiveAll')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReceiveNone}
                disabled={saveMutation.isPending}
              >
                {t('actions.receiveNone')}
              </Button>
            </div>
          )}
        </div>

        <Card className="overflow-hidden border-none shadow-sm bg-muted/30">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="pl-8 py-5">{t('details.item')}</TableHead>
                  <TableHead className="text-right py-5">{t('details.quantity')}</TableHead>
                  <TableHead className="text-right py-5">{t('details.unitPrice')}</TableHead>
                  <TableHead className="text-right py-5">{t('details.subtotal')}</TableHead>
                  <TableHead className="text-right w-[180px] py-5 pr-8">{t('details.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map((item) => {
                  const itemId = item.originalItemId || item.id
                  const receivedQuantity = localQuantities[itemId] || 0
                  const isReceived = receivedQuantity > 0
                  const localStatus = localItemStatuses[itemId]

                  // Check if there are unsaved local changes (different from backend)
                  const hasLocalChanges = localQuantities[itemId] !== Number(item.quantityReceived || 0)
                  const hasLocalStatusChanges = localStatus !== null &&
                    (item.receiveStatus === PurchaseOrderItemStatus.DAMAGED ? 'damaged' :
                     item.receiveStatus === PurchaseOrderItemStatus.NOT_PROCESSED ? 'not_processed' : null) !== localStatus

                  // Determine what to show
                  const showDamagedStatus = localStatus === 'damaged'
                  const showNotProcessedStatus = localStatus === 'not_processed'

                  // For split items
                  const isSplitReceived = item.isSplitRemaining === false
                  const isSplitRemaining = item.isSplitRemaining === true

                  return (
                    <TableRow key={item.id} className="hover:bg-background/50 border-border/50">
                      <TableCell className="pl-8 py-6 font-medium">
                        {item.rawMaterial.name}
                      </TableCell>
                      <TableCell className="text-right py-6">
                        {item.quantityOrdered} {formatUnitWithQuantity(item.quantityOrdered, item.rawMaterial.unit, true)}
                      </TableCell>
                      <TableCell className="text-right py-6">
                        {formatPrice(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right py-6 font-medium">
                        {formatPrice(item.total)}
                      </TableCell>
                      <TableCell className="text-right py-6 pr-8">
                        {/* Split item: received portion - show received with undo option */}
                        {isSplitReceived && purchaseOrder.status !== PurchaseOrderStatus.RECEIVED ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-sm text-green-600 dark:text-green-500">
                              {t('details.received')}
                            </span>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-sm underline"
                              onClick={() => {
                                setLocalQuantities(prev => ({ ...prev, [itemId]: 0 }))
                                setHasUnsavedChanges(true)
                              }}
                            >
                              {t('actions.undo')}
                            </Button>
                          </div>
                        ) : isSplitReceived ? (
                          <span className="text-sm text-green-600 dark:text-green-500">
                            {t('details.received')}
                          </span>
                        ) : /* Split item: remaining portion - show receive button */
                        isSplitRemaining ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="underline"
                            onClick={() => {
                              // Create a temporary item object for the remaining quantity
                              const remainingItem = {
                                ...item,
                                quantityOrdered: item.quantityOrdered,
                                id: item.originalItemId,
                              }
                              openReceiveDialog(remainingItem)
                            }}
                          >
                            {t('actions.receive')}
                          </Button>
                        ) : /* Always show status, even when order is RECEIVED */
                        showDamagedStatus ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className={`text-sm ${hasLocalStatusChanges ? 'text-muted-foreground' : 'text-red-600 dark:text-red-500'}`}>
                              {t('details.damaged')}
                            </span>
                            {/* Only show Undo button if order is not RECEIVED (not finalized) */}
                            {purchaseOrder.status !== PurchaseOrderStatus.RECEIVED && hasLocalStatusChanges && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-sm underline"
                                onClick={() => {
                                  setLocalItemStatuses(prev => {
                                    const newStatuses = { ...prev }
                                    delete newStatuses[item.id]
                                    return newStatuses
                                  })
                                  setHasUnsavedChanges(true)
                                }}
                              >
                                {t('actions.undo')}
                              </Button>
                            )}
                          </div>
                        ) : showNotProcessedStatus ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className={`text-sm ${hasLocalStatusChanges ? 'text-muted-foreground' : 'text-red-600 dark:text-red-500'}`}>
                              {t('details.notProcessed')}
                            </span>
                            {/* Only show Undo button if order is not RECEIVED (not finalized) */}
                            {purchaseOrder.status !== PurchaseOrderStatus.RECEIVED && hasLocalStatusChanges && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-sm underline"
                                onClick={() => {
                                  setLocalItemStatuses(prev => {
                                    const newStatuses = { ...prev }
                                    delete newStatuses[item.id]
                                    return newStatuses
                                  })
                                  setHasUnsavedChanges(true)
                                }}
                              >
                                {t('actions.undo')}
                              </Button>
                            )}
                          </div>
                        ) : isReceived && hasLocalChanges && purchaseOrder.status !== PurchaseOrderStatus.RECEIVED ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-sm text-muted-foreground">
                              {t('details.received')}
                            </span>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-sm underline"
                              onClick={() => {
                                setLocalQuantities(prev => ({ ...prev, [item.id]: 0 }))
                                setHasUnsavedChanges(true)
                              }}
                            >
                              {t('actions.undo')}
                            </Button>
                          </div>
                        ) : isReceived ? (
                          <span className="text-sm text-green-600 dark:text-green-500">
                            {t('details.received')}
                          </span>
                        ) : purchaseOrder.status !== 'RECEIVED' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="underline"
                              onClick={() => openReceiveDialog(item)}
                            >
                              {t('actions.receive')}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setLocalItemStatuses(prev => ({
                                      ...prev,
                                      [item.id]: 'damaged'
                                    }))
                                    setHasUnsavedChanges(true)
                                  }}
                                >
                                  {t('actions.markAsDamaged')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setLocalItemStatuses(prev => ({
                                      ...prev,
                                      [item.id]: 'not_processed'
                                    }))
                                    setHasUnsavedChanges(true)
                                  }}
                                >
                                  {t('actions.markAsNotProcessed')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Totals & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <div className="md:col-span-2">
            {purchaseOrder.notes && (
              <div className="bg-muted/30 p-5 rounded-lg">
                <h4 className="font-medium text-sm mb-3">{t('details.notes')}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {purchaseOrder.notes}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {(() => {
              // Calculate adjusted totals based on item statuses
              const damagedItems = purchaseOrder.items.filter(item =>
                localItemStatuses[item.id] === 'damaged'
              )
              const notProcessedItems = purchaseOrder.items.filter(item =>
                localItemStatuses[item.id] === 'not_processed'
              )

              const damagedTotal = damagedItems.reduce((sum, item) =>
                sum + parseFloat(item.total), 0
              )
              const notProcessedTotal = notProcessedItems.reduce((sum, item) =>
                sum + parseFloat(item.total), 0
              )

              const removedTotal = damagedTotal + notProcessedTotal
              const adjustedSubtotal = parseFloat(purchaseOrder.subtotal) - removedTotal
              const adjustedTaxAmount = adjustedSubtotal * purchaseOrder.taxRate
              const adjustedCommission = adjustedSubtotal * purchaseOrder.commissionRate
              const adjustedTotal = adjustedSubtotal + adjustedTaxAmount + adjustedCommission

              const hasRemovedItems = removedTotal > 0

              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('details.subtotal')}</span>
                    <span className="font-medium">{formatPrice(purchaseOrder.subtotal)}</span>
                  </div>

                  {/* Show removed items in red */}
                  {hasRemovedItems && (
                    <>
                      {damagedItems.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600 dark:text-red-500">
                            {t('details.damaged')} ({damagedItems.length})
                          </span>
                          <span className="text-red-600 dark:text-red-500">
                            -{formatPrice(damagedTotal)}
                          </span>
                        </div>
                      )}
                      {notProcessedItems.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600 dark:text-red-500">
                            {t('details.notProcessed')} ({notProcessedItems.length})
                          </span>
                          <span className="text-red-600 dark:text-red-500">
                            -{formatPrice(notProcessedTotal)}
                          </span>
                        </div>
                      )}
                      <div className="h-px bg-border my-2" />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('details.adjustedSubtotal')}</span>
                        <span className="font-medium">{formatPrice(adjustedSubtotal)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">
                      {t('details.tax')} ({(purchaseOrder.taxRate * 100).toFixed(0)}%)
                    </span>
                    <span className="font-medium">
                      {formatPrice(hasRemovedItems ? adjustedTaxAmount : purchaseOrder.taxAmount)}
                    </span>
                  </div>

                  {purchaseOrder.commission && parseFloat(purchaseOrder.commission) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Comisión ({(purchaseOrder.commissionRate * 100).toFixed(2)}%)
                      </span>
                      <span className="font-medium">
                        {formatPrice(hasRemovedItems ? adjustedCommission : purchaseOrder.commission)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={openEditFees}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      {t('actions.editFees')}
                    </Button>
                  </div>

                  <div className="border-t pt-4 mt-4 flex justify-between items-end">
                    <span className="font-bold text-lg">{t('details.grandTotal')}</span>
                    <span className="font-bold text-xl">
                      {formatPrice(hasRemovedItems ? adjustedTotal : purchaseOrder.total)}
                    </span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Edit Fees Dialog */}
      <Dialog open={editFeesOpen} onOpenChange={setEditFeesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('actions.editFeesTitle')}</DialogTitle>
            <DialogDescription>
              {t('actions.editFeesDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taxRate">{t('actions.taxRate')}</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editingFees.taxRate}
                onChange={(e) => setEditingFees({ ...editingFees, taxRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionRate">{t('actions.commissionRate')}</Label>
              <Input
                id="commissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editingFees.commissionRate}
                onChange={(e) => setEditingFees({ ...editingFees, commissionRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFeesOpen(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleSaveFees} disabled={updateFeesMutation.isPending}>
              {updateFeesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Item Dialog - Square flow (updates local state only) */}
      <Dialog open={receiveItemDialog.open} onOpenChange={(open) => setReceiveItemDialog({ ...receiveItemDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('actions.receiveItemTitle')}</DialogTitle>
            <DialogDescription>
              {t('actions.receiveItemDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('actions.itemLabel')}</Label>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{receiveItemDialog.item?.rawMaterial?.name || ''}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">{t('actions.quantityReceivedLabel')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  value={receiveItemDialog.quantity}
                  onChange={(e) => setReceiveItemDialog({ ...receiveItemDialog, quantity: parseFloat(e.target.value) || 0 })}
                  className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-sm text-muted-foreground min-w-[80px] uppercase">
                  {receiveItemDialog.item?.rawMaterial?.unit ? formatUnitWithQuantity(receiveItemDialog.quantity, receiveItemDialog.item.rawMaterial.unit, true) : ''}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('actions.quantityOrderedLabel')} {receiveItemDialog.item?.quantityOrdered || 0} {receiveItemDialog.item?.rawMaterial?.unit ? formatUnitWithQuantity(receiveItemDialog.item.quantityOrdered, receiveItemDialog.item.rawMaterial.unit, true) : ''}
              </p>
              {receiveItemDialog.quantity > (receiveItemDialog.item?.quantityOrdered || 0) && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <svg className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-destructive">
                    {t('actions.cannotExceedOrdered')}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveItemDialog({ open: false, item: null, quantity: 0 })}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handleSaveReceiveDialog}
              disabled={receiveItemDialog.quantity > (receiveItemDialog.item?.quantityOrdered || 0)}
            >
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
