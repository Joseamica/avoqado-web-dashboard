import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Product } from '@/types'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onConfirm: (adjustment: number, reason: string, notes: string) => void
  isLoading?: boolean
}

export function AdjustStockDialog({ open, onOpenChange, product, onConfirm, isLoading = false }: AdjustStockDialogProps) {
  const { t } = useTranslation('menu')
  const [adjustment, setAdjustment] = useState<string>('')
  const [reason, setReason] = useState<string>('recount')
  const [notes, setNotes] = useState<string>('')

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setAdjustment('')
      setReason('recount')
      setNotes('')
    }
  }, [open])

  if (!product) return null

  // ✅ Convert to number (backend returns Decimal as string)
  const currentStock = Number(product.inventory?.currentStock ?? 0)
  const adjustmentNum = parseFloat(adjustment) || 0
  const newStock = Math.max(0, currentStock + adjustmentNum)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (adjustmentNum !== 0) {
      onConfirm(adjustmentNum, reason, notes)
    }
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment">{t('products.actions.adjustStockDialog.adjustment')} *</Label>
            <Input
              id="adjustment"
              type="number"
              step="0.01"
              placeholder={t('products.actions.adjustStockDialog.adjustmentPlaceholder')}
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              autoFocus
            />
            {adjustmentNum !== 0 && (
              <p className="text-sm text-muted-foreground">
                {t('products.actions.adjustStockDialog.newStock')}: <strong className={adjustmentNum > 0 ? 'text-green-600' : 'text-red-600'}>{newStock.toFixed(2)}</strong> {product.unit || 'units'}
              </p>
            )}
          </div>

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
            <Button type="submit" disabled={isLoading || adjustmentNum === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? t('products.actions.adjustStockDialog.saving') : t('products.actions.adjustStockDialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
