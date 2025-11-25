import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, AlertCircle } from 'lucide-react'
import type { Product } from '@/types'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useRecentMovements } from '@/hooks/useRecentMovements'
import { RecentMovementsSection } from '@/components/inventory/RecentMovementsSection'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onConfirm: (adjustment: number, reason: string, notes: string) => void
  isLoading?: boolean
}

export function AdjustStockDialog({ open, onOpenChange, product, onConfirm, isLoading = false }: AdjustStockDialogProps) {
  const { t } = useTranslation('menu')
  const { venueId } = useCurrentVenue()
  const [adjustment, setAdjustment] = useState<string>('')
  const [reason, setReason] = useState<string>('recount')
  const [notes, setNotes] = useState<string>('')
  const [showLargeAdjustmentConfirm, setShowLargeAdjustmentConfirm] = useState(false)

  // Fetch recent movements
  const { movements, isLoading: isLoadingMovements, hasRecentMovements } = useRecentMovements({
    venueId,
    productId: product?.id ?? null,
    enabled: open,
    limit: 5,
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setAdjustment('')
      setReason('recount')
      setNotes('')
      setShowLargeAdjustmentConfirm(false)
    }
  }, [open])

  if (!product) return null

  // ✅ Convert to number (backend returns Decimal as string)
  const currentStock = Number(product.inventory?.currentStock ?? 0)
  const adjustmentNum = parseFloat(adjustment) || 0
  const calculatedNewStock = currentStock + adjustmentNum
  const newStock = Math.max(0, calculatedNewStock)

  // Detect issues
  const wouldBeNegative = calculatedNewStock < 0
  const isLargeAdjustment = currentStock > 0 && Math.abs(adjustmentNum) > (currentStock * 0.5)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (adjustmentNum === 0) return

    // Prevent negative stock
    if (wouldBeNegative) return

    // Ask for confirmation on large adjustments
    if (isLargeAdjustment && !showLargeAdjustmentConfirm) {
      setShowLargeAdjustmentConfirm(true)
      return
    }

    onConfirm(adjustmentNum, reason, notes)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('products.actions.adjustStockDialog.title', { productName: product.name })}</DialogTitle>
          <DialogDescription>
            {t('products.actions.adjustStockDialog.currentStock')}: <strong>{currentStock.toFixed(2)}</strong> {product.unit || 'units'}
          </DialogDescription>
        </DialogHeader>

        {/* Recent Stock Movements */}
        <RecentMovementsSection
          movements={movements}
          isLoading={isLoadingMovements}
          hasRecentMovements={hasRecentMovements}
          unit={product.unit || 'units'}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment">{t('products.actions.adjustStockDialog.adjustment')} *</Label>
            <Input
              id="adjustment"
              type="number"
              step="0.01"
              placeholder={t('products.actions.adjustStockDialog.adjustmentPlaceholder')}
              value={adjustment}
              onChange={(e) => {
                setAdjustment(e.target.value)
                setShowLargeAdjustmentConfirm(false) // Reset confirmation if user changes value
              }}
              autoFocus
              className={wouldBeNegative ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {adjustmentNum !== 0 && !wouldBeNegative && (
              <p className="text-sm text-muted-foreground">
                {t('products.actions.adjustStockDialog.newStock')}: <strong className={adjustmentNum > 0 ? 'text-green-600' : 'text-orange-600'}>{newStock.toFixed(2)}</strong> {product.unit || 'units'}
              </p>
            )}
          </div>

          {/* Negative Stock Warning */}
          {wouldBeNegative && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('products.actions.adjustStockDialog.cannotReduceBelowZero', {
                  amount: currentStock.toFixed(2),
                  unit: product.unit || 'units',
                  minimum: (-currentStock).toFixed(2)
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Large Adjustment Warning */}
          {isLargeAdjustment && !wouldBeNegative && (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                {showLargeAdjustmentConfirm ? (
                  <>
                    <strong>{t('products.actions.adjustStockDialog.confirmLargeAdjustment')}</strong> {t('products.actions.adjustStockDialog.confirmLargeAdjustmentMessage', {
                      amount: Math.abs(adjustmentNum).toFixed(2),
                      unit: product.unit || 'units',
                      percentage: (Math.abs(adjustmentNum) / currentStock * 100).toFixed(0)
                    })}
                  </>
                ) : (
                  <>
                    <strong>{t('products.actions.adjustStockDialog.warning')}</strong> {t('products.actions.adjustStockDialog.largeAdjustmentWarning', {
                      percentage: (Math.abs(adjustmentNum) / currentStock * 100).toFixed(0)
                    })}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">{t('products.actions.adjustStockDialog.reason')} *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t('products.actions.adjustStockDialog.reasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recount">{t('products.actions.adjustStockDialog.reasons.recount')}</SelectItem>
                <SelectItem value="damage">{t('products.actions.adjustStockDialog.reasons.damage')}</SelectItem>
                <SelectItem value="theft">{t('products.actions.adjustStockDialog.reasons.theft')}</SelectItem>
                <SelectItem value="correction">{t('products.actions.adjustStockDialog.reasons.correction')}</SelectItem>
                <SelectItem value="receiving">{t('products.actions.adjustStockDialog.reasons.receiving')}</SelectItem>
                <SelectItem value="other">{t('products.actions.adjustStockDialog.reasons.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('products.actions.adjustStockDialog.notes')}</Label>
            <Textarea
              id="notes"
              placeholder={t('products.actions.adjustStockDialog.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              {t('products.actions.adjustStockDialog.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || adjustmentNum === 0 || wouldBeNegative}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {showLargeAdjustmentConfirm && isLargeAdjustment && !wouldBeNegative
                ? t('products.actions.adjustStockDialog.confirmAndSave')
                : isLoading
                ? t('products.actions.adjustStockDialog.saving')
                : t('products.actions.adjustStockDialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
