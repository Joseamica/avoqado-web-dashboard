import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { LABEL_TYPES, LabelGenerationConfig, PurchaseOrder, purchaseOrderService } from '@/services/purchaseOrder.service'
import { useMutation } from '@tanstack/react-query'
import { Download, Loader2, Plus, Printer, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface LabelPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrder: PurchaseOrder
  venueId: string
}

type SelectionMode = 'order' | 'category'

export function LabelPrintDialog({ open, onOpenChange, purchaseOrder, venueId }: LabelPrintDialogProps) {
  const { t } = useTranslation('purchaseOrders')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()

  // Step state
  const [step, setStep] = useState<'config' | 'success'>('config')

  // Configuration state
  const [labelType, setLabelType] = useState('avery-5160')
  const [barcodeFormat, setBarcodeFormat] = useState<'SKU' | 'GTIN'>('SKU')
  const [details, setDetails] = useState({
    sku: true,
    gtin: false,
    variantName: false,
    price: true,
    itemName: true,
    unitAbbr: true,
  })

  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('order')
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(() => {
    // Pre-select all items with their ordered quantities
    const initial: Record<string, number> = {}
    purchaseOrder.items.forEach(item => {
      initial[item.id] = item.quantityOrdered
    })
    return initial
  })

  // Calculate total labels
  const totalLabels = useMemo(() => {
    return Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0)
  }, [selectedItems])

  // Generate labels mutation
  const generateLabelsMutation = useMutation({
    mutationFn: (config: LabelGenerationConfig) => purchaseOrderService.generateLabels(venueId, purchaseOrder.id, config),
    onSuccess: response => {
      // Download PDF
      const url = URL.createObjectURL(response.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `etiquetas-${purchaseOrder.orderNumber}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        description: t('labels.successMessage', { count: response.totalLabels }),
      })

      setStep('success')
    },
    onError: error => {
      console.error('Error generating labels:', error)
      toast({
        variant: 'destructive',
        description: t('labels.errorMessage'),
      })
    },
  })

  const handleCreateLabels = () => {
    const config: LabelGenerationConfig = {
      labelType,
      barcodeFormat,
      details,
      items: Object.entries(selectedItems)
        .filter(([_, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({
          itemId,
          quantity: Number(quantity),
        })),
    }

    generateLabelsMutation.mutate(config)
  }

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const item = purchaseOrder.items.find(i => i.id === itemId)
      if (!item) return prev

      if (prev[itemId]) {
        const { [itemId]: _, ...rest } = prev
        return rest
      } else {
        return {
          ...prev,
          [itemId]: item.quantityOrdered,
        }
      }
    })
  }

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: Math.max(0, quantity),
    }))
  }

  const handleReset = () => {
    setStep('config')
    setLabelType('avery-5160')
    setBarcodeFormat('SKU')
    setDetails({
      sku: true,
      gtin: false,
      variantName: false,
      price: true,
      itemName: true,
      unitAbbr: true,
    })
    const initial: Record<string, number> = {}
    purchaseOrder.items.forEach(item => {
      initial[item.id] = item.quantityOrdered
    })
    setSelectedItems(initial)
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('labels.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('labels.dialogDescription')}</DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <div className="space-y-6">
            {/* Label Configuration - Two Column Layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column: Label Type */}
              <div>
                <Label className="text-sm font-medium">{t('labels.labelType')}</Label>
                <ScrollArea className="h-[400px] pr-2 mt-2">
                  <div className="space-y-2">
                    {LABEL_TYPES.map(template => (
                      <div
                        key={template.value}
                        onClick={() => setLabelType(template.value)}
                        className={cn(
                          'relative p-3 rounded-lg border-2 cursor-pointer transition-all',
                          labelType === template.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                              labelType === template.value ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                            )}
                          >
                            {labelType === template.value && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                          </div>
                          <p className="text-sm flex-1 leading-tight">{template.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Right Column: Barcode Format & Details */}
              <div className="space-y-6">
                {/* Barcode Format */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">{t('labels.barcodeFormat')}</Label>
                  <div className="flex gap-2">
                    <div
                      onClick={() => setBarcodeFormat('SKU')}
                      className={cn(
                        'flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center',
                        barcodeFormat === 'SKU' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50',
                      )}
                    >
                      <span className="text-sm font-medium">SKU</span>
                    </div>
                    <div
                      onClick={() => setBarcodeFormat('GTIN')}
                      className={cn(
                        'flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center',
                        barcodeFormat === 'GTIN'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50',
                      )}
                    >
                      <span className="text-sm font-medium">GTIN</span>
                    </div>
                  </div>
                </div>

                {/* Label Details */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">{t('labels.labelDetails')}</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'sku', label: 'SKU' },
                      { key: 'gtin', label: 'GTIN' },
                      { key: 'itemName', label: t('labels.details.itemName') },
                      { key: 'variantName', label: t('labels.details.variantName') },
                      { key: 'price', label: t('labels.details.price') },
                      { key: 'unitAbbr', label: t('labels.details.unitAbbr') },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        onClick={() => setDetails({ ...details, [key]: !details[key as keyof typeof details] })}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={details[key as keyof typeof details]}
                          onClick={e => e.stopPropagation()}
                          className="cursor-pointer"
                        />
                        <span className="text-sm flex-1">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Item Selection with Tabs */}
            <div>
              <Label className="text-sm font-medium">{t('labels.selectItems')}</Label>
              <Tabs value={selectionMode} onValueChange={value => setSelectionMode(value as SelectionMode)} className="mt-2">
                <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
                  <TabsTrigger
                    value="category"
                    className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                  >
                    {t('labels.selectionMode.category')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="order"
                    className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                  >
                    {t('labels.selectionMode.order')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="order" className="mt-6 space-y-3">
                  <div className="rounded-lg border border-border overflow-hidden">
                    {purchaseOrder.items.map((item, index) => (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-4 p-3',
                          index !== purchaseOrder.items.length - 1 && 'border-b border-border',
                          'hover:bg-muted/30 transition-colors',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.rawMaterial?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.rawMaterial?.sku || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantityOrdered}
                            value={selectedItems[item.id] || 0}
                            onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleToggleItem(item.id)} className="h-8 w-8 cursor-pointer">
                            {selectedItems[item.id] ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-muted-foreground">
                      {t('labels.totalLabels')}: <span className="font-medium text-foreground">{totalLabels}</span>
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="category" className="mt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">{t('labels.categorySelectionNotImplemented')}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={generateLabelsMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleCreateLabels} disabled={totalLabels === 0 || generateLabelsMutation.isPending}>
                {generateLabelsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('labels.createLabels')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Download className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('labels.successTitle')}</h3>
              <p className="text-muted-foreground">{t('labels.successDescription', { count: totalLabels })}</p>
            </div>

            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleClose}>
                {tCommon('close')}
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                {t('labels.printNow')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
