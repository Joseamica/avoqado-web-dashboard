import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { purchaseOrderService, PurchaseOrderStatus } from '@/services/purchaseOrder.service'
import type { PurchaseOrder } from '@/services/purchaseOrder.service'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, MoreHorizontal, Copy, FileText, FileSpreadsheet, Mail, Tag } from 'lucide-react'
import { LabelPrintDialog } from './LabelPrintDialog'
import { PurchaseOrderWizard } from './PurchaseOrderWizard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface POActionsProps {
  purchaseOrder: PurchaseOrder
  hasUnsavedChanges?: boolean
  onSave?: () => void
  isSaving?: boolean
}

export function POActions({ purchaseOrder, hasUnsavedChanges = false, onSave, isSaving = false }: POActionsProps) {
  const { t } = useTranslation(['purchaseOrders', 'common'])
  const navigate = useNavigate()
  const { venueId, fullBasePath } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Dialog states
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUndoReceiveDialog, setShowUndoReceiveDialog] = useState(false)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const [editWizardOpen, setEditWizardOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => purchaseOrderService.approvePurchaseOrder(venueId!, purchaseOrder.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.approveSuccess') })
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.approveError'),
        variant: 'destructive'
      })
    },
  })

  // Send mutation (APPROVED → SENT)
  const sendMutation = useMutation({
    mutationFn: () => purchaseOrderService.updatePurchaseOrder(venueId!, purchaseOrder.id, {
      status: PurchaseOrderStatus.SENT,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.sendSuccess') })
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.sendError'),
        variant: 'destructive'
      })
    },
  })

  // Confirm mutation (SENT → CONFIRMED)
  const confirmMutation = useMutation({
    mutationFn: () => purchaseOrderService.updatePurchaseOrder(venueId!, purchaseOrder.id, {
      status: PurchaseOrderStatus.CONFIRMED,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.confirmSuccess') })
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.confirmError'),
        variant: 'destructive'
      })
    },
  })

  // Ship mutation (CONFIRMED → SHIPPED)
  const shipMutation = useMutation({
    mutationFn: () => purchaseOrderService.updatePurchaseOrder(venueId!, purchaseOrder.id, {
      status: PurchaseOrderStatus.SHIPPED,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.shipSuccess') })
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.shipError'),
        variant: 'destructive'
      })
    },
  })

  // Undo Receive mutation (RECEIVED/PARTIAL → SHIPPED)
  const undoReceiveMutation = useMutation({
    mutationFn: () => purchaseOrderService.updatePurchaseOrder(venueId!, purchaseOrder.id, {
      status: PurchaseOrderStatus.SHIPPED,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({ description: t('actions.undoReceiveSuccess') })
      setShowUndoReceiveDialog(false)
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.undoReceiveError'),
        variant: 'destructive'
      })
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      purchaseOrderService.cancelPurchaseOrder(venueId!, purchaseOrder.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.cancelSuccess') })
      setShowCancelDialog(false)
      setCancelReason('')
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.cancelError'),
        variant: 'destructive'
      })
    },
  })

  // Reject mutation (PENDING_APPROVAL → CANCELLED)
  const rejectMutation = useMutation({
    mutationFn: (reason: string) =>
      purchaseOrderService.cancelPurchaseOrder(venueId!, purchaseOrder.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.rejectSuccess') })
      setShowRejectDialog(false)
      setRejectReason('')
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.rejectError'),
        variant: 'destructive'
      })
    },
  })

  // Delete mutation (only for DRAFT)
  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrderService.deletePurchaseOrder(venueId!, purchaseOrder.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.deleteSuccess') })
      navigate(`${fullBasePath}/inventory/purchase-orders`)
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.deleteError'),
        variant: 'destructive'
      })
    },
  })

  // Submit for approval (DRAFT → PENDING_APPROVAL)
  const submitApprovalMutation = useMutation({
    mutationFn: () => purchaseOrderService.updatePurchaseOrder(venueId!, purchaseOrder.id, {
      status: PurchaseOrderStatus.PENDING_APPROVAL,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
      toast({ description: t('actions.submitApprovalSuccess') })
    },
    onError: (error: any) => {
      toast({
        description: error.response?.data?.message || t('actions.submitApprovalError'),
        variant: 'destructive'
      })
    },
  })

  const handleEdit = () => {
    setEditWizardOpen(true)
  }

  // Duplicate PO - navigate back to list with data in sessionStorage
  const handleDuplicate = () => {
    // console.log('🔄 Duplicating order from detail:', purchaseOrder)
    const duplicateData = {
      supplierId: purchaseOrder.supplierId,
      supplier: purchaseOrder.supplier,
      items: purchaseOrder.items.map(item => ({
        rawMaterialId: item.rawMaterial.id,
        rawMaterial: item.rawMaterial,
        quantityOrdered: item.quantityOrdered,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
      taxRate: purchaseOrder.taxRate,
      commissionRate: purchaseOrder.commissionRate,
      notes: purchaseOrder.notes,
      shippingAddressType: purchaseOrder.shippingAddressType,
      shippingAddress: purchaseOrder.shippingAddress,
      shippingCity: purchaseOrder.shippingCity,
      shippingState: purchaseOrder.shippingState,
      shippingZipCode: purchaseOrder.shippingZipCode,
    }
    // console.log('💾 Saving to sessionStorage:', duplicateData)
    sessionStorage.setItem('duplicatePOData', JSON.stringify(duplicateData))
    // console.log('🔙 Navigating back to list')
    navigate(`${fullBasePath}/inventory/purchase-orders`)
  }

  // Save as PDF - generate PDF from backend
  const handleSaveAsPDF = async () => {
    try {
      const blob = await purchaseOrderService.generatePDF(venueId!, purchaseOrder.id)

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `orden-compra-${purchaseOrder.orderNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      toast({ description: 'PDF descargado exitosamente' })
    } catch (_error) {
      toast({
        description: 'Error al generar PDF',
        variant: 'destructive',
      })
    }
  }

  // Save as CSV - generate and download
  const handleSaveAsCSV = () => {
    const headers = ['Item', 'SKU', 'Quantity', 'Unit Price', 'Total']
    const rows = purchaseOrder.items.map(item => [
      item.rawMaterial.name,
      item.rawMaterial.sku || 'N/A',
      item.quantityOrdered,
      item.unitPrice,
      (Number(item.quantityOrdered) * Number(item.unitPrice)).toFixed(2),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Subtotal,,,${purchaseOrder.subtotal}`,
      `Tax,,,${purchaseOrder.taxAmount}`,
      `Total,,,${purchaseOrder.total}`,
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `PO-${purchaseOrder.orderNumber}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast({ description: t('actions.csvDownloaded', { defaultValue: 'CSV descargado' }) })
  }

  // Send email - open mailto
  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Purchase Order ${purchaseOrder.orderNumber}`)
    const body = encodeURIComponent(
      `Purchase Order Details:\n\n` +
      `Order Number: ${purchaseOrder.orderNumber}\n` +
      `Supplier: ${purchaseOrder.supplier.name}\n` +
      `Total: ${purchaseOrder.total}\n` +
      `Status: ${purchaseOrder.status}\n\n` +
      `View full details at: ${window.location.href}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  // Print labels - open dialog
  const handlePrintLabels = () => {
    setLabelDialogOpen(true)
  }

  const handleCancelConfirm = () => {
    if (!cancelReason.trim()) {
      toast({
        description: t('actions.cancelReasonRequired'),
        variant: 'destructive'
      })
      return
    }
    cancelMutation.mutate(cancelReason)
  }

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      toast({
        description: t('actions.rejectReasonRequired'),
        variant: 'destructive'
      })
      return
    }
    rejectMutation.mutate(rejectReason)
  }

  const isLoading =
    approveMutation.isPending ||
    sendMutation.isPending ||
    confirmMutation.isPending ||
    shipMutation.isPending ||
    undoReceiveMutation.isPending ||
    cancelMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending ||
    submitApprovalMutation.isPending

  // More Actions Dropdown (shared across all status except RECEIVED/CANCELLED)
  const MoreActionsDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDuplicate} disabled={isLoading}>
          <Copy className="mr-2 h-4 w-4" />
          {t('actions.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSaveAsPDF} disabled={isLoading}>
          <FileText className="mr-2 h-4 w-4" />
          {t('actions.saveAsPDF')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSaveAsCSV} disabled={isLoading}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t('actions.saveAsCSV')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSendEmail} disabled={isLoading}>
          <Mail className="mr-2 h-4 w-4" />
          {t('actions.sendEmail')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePrintLabels} disabled={isLoading}>
          <Tag className="mr-2 h-4 w-4" />
          {t('actions.printLabels')}
        </DropdownMenuItem>
        {/* Only show delete/cancel for non-final statuses */}
        {purchaseOrder.status !== PurchaseOrderStatus.RECEIVED &&
          purchaseOrder.status !== PurchaseOrderStatus.CANCELLED && (
            <>
              <DropdownMenuSeparator />
              {purchaseOrder.status === PurchaseOrderStatus.DRAFT ? (
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isLoading}
                  className="text-destructive"
                >
                  {t('actions.delete')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isLoading}
                  className="text-destructive"
                >
                  {t('actions.cancelOrder')}
                </DropdownMenuItem>
              )}
            </>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Render actions based on status
  let actionButtons: React.ReactNode = null

  switch (purchaseOrder.status) {
    case PurchaseOrderStatus.DRAFT:
      actionButtons = (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleEdit} disabled={isLoading}>
            {t('actions.edit')}
          </Button>
          {/* Guardar button - Square flow (same as SHIPPED/PARTIAL) */}
          {onSave && (
            <Button
              onClick={onSave}
              disabled={!hasUnsavedChanges || isSaving || isLoading}
              size="lg"
              variant={hasUnsavedChanges ? 'default' : 'outline'}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.save')}
            </Button>
          )}
          <MoreActionsDropdown />
        </div>
      )
      break

    case PurchaseOrderStatus.PENDING_APPROVAL:
      actionButtons = (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => approveMutation.mutate()} disabled={isLoading}>
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.approve')}
            </Button>
            <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={isLoading}>
              {t('actions.reject')}
            </Button>
            <MoreActionsDropdown />
          </div>

          {/* Reject Dialog */}
          <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('actions.rejectTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('actions.rejectDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="reject-reason">{t('actions.rejectReason')}</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('actions.rejectReasonPlaceholder')}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRejectConfirm}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('actions.reject')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )
      break

    case PurchaseOrderStatus.APPROVED:
      actionButtons = (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => sendMutation.mutate()} disabled={isLoading}>
            {sendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('actions.sendToSupplier')}
          </Button>
          <Button variant="outline" onClick={() => setShowCancelDialog(true)} disabled={isLoading}>
            {t('actions.cancel')}
          </Button>
          <MoreActionsDropdown />
        </div>
      )
      break

    case PurchaseOrderStatus.SENT:
      actionButtons = (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => confirmMutation.mutate()} disabled={isLoading}>
            {confirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('actions.markConfirmed')}
          </Button>
          <Button variant="outline" onClick={() => setShowCancelDialog(true)} disabled={isLoading}>
            {t('actions.cancel')}
          </Button>
          <MoreActionsDropdown />
        </div>
      )
      break

    case PurchaseOrderStatus.CONFIRMED:
    case PurchaseOrderStatus.SHIPPED:
    case PurchaseOrderStatus.PARTIAL:
      actionButtons = (
        <div className="flex flex-wrap items-center gap-2">
          {/* Guardar button - Square flow */}
          {onSave && (
            <Button
              onClick={onSave}
              disabled={!hasUnsavedChanges || isSaving || isLoading}
              size="lg"
              variant={hasUnsavedChanges ? 'default' : 'outline'}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.save')}
            </Button>
          )}
          <MoreActionsDropdown />
        </div>
      )
      break

    case PurchaseOrderStatus.RECEIVED:
    case PurchaseOrderStatus.CANCELLED:
      // Final statuses - only allow viewing/duplicating (via dropdown)
      actionButtons = (
        <div className="flex flex-wrap items-center gap-2">
          <MoreActionsDropdown />
        </div>
      )
      break

    default:
      actionButtons = null
      break
  }

  return (
    <>
      {/* Render action buttons based on status */}
      {actionButtons}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('actions.cancelDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason">{t('actions.cancelReason')}</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('actions.cancelReasonPlaceholder')}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.cancelOrder')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Receive Dialog */}
      <AlertDialog open={showUndoReceiveDialog} onOpenChange={setShowUndoReceiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.undoReceive')}</AlertDialogTitle>
            <AlertDialogDescription>{t('actions.undoReceiveDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => undoReceiveMutation.mutate()}>
              {undoReceiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.undo')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog (for DRAFT status via dropdown) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirm.description', { orderNumber: purchaseOrder.orderNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete.confirm.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LabelPrintDialog
        purchaseOrder={purchaseOrder}
        venueId={venueId!}
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
      />

      {/* Edit Purchase Order Wizard */}
      <PurchaseOrderWizard
        open={editWizardOpen}
        onClose={() => setEditWizardOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['purchase-order', venueId, purchaseOrder.id] })
          queryClient.invalidateQueries({ queryKey: ['purchase-orders', venueId] })
        }}
        purchaseOrder={purchaseOrder}
        mode="edit"
      />
    </>
  )
}
