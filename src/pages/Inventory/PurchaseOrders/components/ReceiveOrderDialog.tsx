import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { purchaseOrderService } from '@/services/purchaseOrder.service'
import type { PurchaseOrder } from '@/services/purchaseOrder.service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Info } from 'lucide-react'

interface ReceiveOrderDialogProps {
  purchaseOrder: PurchaseOrder
  open: boolean
  onClose: () => void
}

interface ReceiveItem {
  purchaseOrderItemId: string
  rawMaterialName: string
  rawMaterialUnit: string
  quantityOrdered: number
  quantityReceived: number
  quantityToReceive: number
  maxReceivable: number
}

export function ReceiveOrderDialog({ purchaseOrder, open, onClose }: ReceiveOrderDialogProps) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const { venue } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Initialize receive items with remaining quantities
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])

  useEffect(() => {
    if (open && purchaseOrder) {
      const items = purchaseOrder.items.map(item => {
        const alreadyReceived = item.quantityReceived || 0
        const remaining = item.quantityOrdered - alreadyReceived

        return {
          purchaseOrderItemId: item.id,
          rawMaterialName: item.rawMaterial.name,
          rawMaterialUnit: item.rawMaterial.unit,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: alreadyReceived,
          quantityToReceive: remaining, // Pre-fill with remaining
          maxReceivable: remaining,
        }
      })
      setReceiveItems(items)
    }
  }, [open, purchaseOrder])

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: (data: { items: Array<{ purchaseOrderItemId: string; quantityReceived: number }>; partial: boolean }) =>
      purchaseOrderService.receivePurchaseOrder(venue!.id, purchaseOrder.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venue?.id, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['inventory-summary', venue?.id] })
      toast({ description: t('actions.receiveSuccess') })
      onClose()
    },
    onError: (error: any) => {
      toast({ description: error.response?.data?.message || t('actions.receiveError'), variant: 'destructive' })
    },
  })

  const updateQuantity = (index: number, value: number) => {
    setReceiveItems(prev => {
      const updated = [...prev]
      // Validate: cannot exceed max receivable
      const validValue = Math.max(0, Math.min(value, updated[index].maxReceivable))
      updated[index] = { ...updated[index], quantityToReceive: validValue }
      return updated
    })
  }

  // Set all quantities to maximum (receive all)
  const handleReceiveAll = () => {
    setReceiveItems(prev =>
      prev.map(item => ({ ...item, quantityToReceive: item.maxReceivable }))
    )
  }

  // Set all quantities to zero (receive none)
  const handleReceiveNone = () => {
    setReceiveItems(prev =>
      prev.map(item => ({ ...item, quantityToReceive: 0 }))
    )
  }

  const handleSave = () => {
    // Check if any items have quantity to receive
    const itemsToReceive = receiveItems.filter(item => item.quantityToReceive > 0)

    if (itemsToReceive.length === 0) {
      toast({ description: t('actions.receiveNoQuantity'), variant: 'destructive' })
      return
    }

    // Determine if partial or complete
    const totalOrdered = receiveItems.reduce((sum, item) => sum + item.maxReceivable, 0)
    const totalToReceive = receiveItems.reduce((sum, item) => sum + item.quantityToReceive, 0)
    const isPartial = totalToReceive < totalOrdered

    // Prepare data for backend
    const data = {
      items: receiveItems
        .filter(item => item.quantityToReceive > 0)
        .map(item => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityReceived: item.quantityToReceive,
        })),
      partial: isPartial,
    }

    receiveMutation.mutate(data)
  }

  const handleClose = () => {
    if (!receiveMutation.isPending) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('actions.receiveOrder')}</DialogTitle>
          <DialogDescription>
            {t('actions.receiveOrderDescription', { orderNumber: purchaseOrder.orderNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{t('actions.receiveAutoUpdate')}</AlertDescription>
          </Alert>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReceiveAll}
              disabled={receiveMutation.isPending}
            >
              {t('actions.receiveAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReceiveNone}
              disabled={receiveMutation.isPending}
            >
              {t('actions.receiveNone')}
            </Button>
          </div>

          {/* Items table */}
          <div className="rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('items.rawMaterial')}</TableHead>
                  <TableHead className="text-right">{t('items.quantityOrdered')}</TableHead>
                  <TableHead className="text-right">{t('items.quantityReceived')}</TableHead>
                  <TableHead className="text-right">{t('actions.receiveNow')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiveItems.map((item, index) => (
                  <TableRow key={item.purchaseOrderItemId}>
                    <TableCell className="font-medium">
                      {item.rawMaterialName}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantityOrdered} {item.rawMaterialUnit}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantityReceived} {item.rawMaterialUnit}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max={item.maxReceivable}
                          value={item.quantityToReceive}
                          onChange={(e) => updateQuantity(index, parseFloat(e.target.value) || 0)}
                          className="w-24 text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          disabled={receiveMutation.isPending}
                        />
                        <span className="text-sm text-muted-foreground min-w-[40px]">
                          {item.rawMaterialUnit}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex justify-end text-sm text-muted-foreground">
            {t('actions.receivingSummary', {
              receiving: receiveItems.reduce((sum, item) => sum + item.quantityToReceive, 0).toFixed(3),
              total: receiveItems.reduce((sum, item) => sum + item.maxReceivable, 0).toFixed(3),
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={receiveMutation.isPending}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleSave} disabled={receiveMutation.isPending}>
            {receiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('actions.receive')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
