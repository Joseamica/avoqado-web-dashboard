import React, { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Loader2, Banknote, Building2, Vault, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getExpectedCash, createCashCloseout, DepositMethod } from '@/services/cashCloseout.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'

interface CashCloseoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  onSuccess?: () => void
}

const DEPOSIT_METHOD_ICONS: Record<DepositMethod, React.ReactNode> = {
  BANK_DEPOSIT: <Building2 className="w-4 h-4" />,
  SAFE: <Vault className="w-4 h-4" />,
  OWNER_WITHDRAWAL: <Banknote className="w-4 h-4" />,
  NEXT_SHIFT: <ArrowRight className="w-4 h-4" />,
}

export function CashCloseoutDialog({ open, onOpenChange, venueId, onSuccess }: CashCloseoutDialogProps) {
  const { t, i18n } = useTranslation('cashCloseout')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()
  const localeCode = getIntlLocale(i18n.language)

  const [actualAmount, setActualAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<DepositMethod>('BANK_DEPOSIT')
  const [bankReference, setBankReference] = useState('')
  const [notes, setNotes] = useState('')

  // Fetch expected cash amount
  const {
    data: expectedData,
    isLoading: isLoadingExpected,
    refetch,
  } = useQuery({
    queryKey: ['cash-closeout', 'expected', venueId],
    queryFn: () => getExpectedCash(venueId),
    enabled: open && !!venueId,
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setActualAmount('')
      setDepositMethod('BANK_DEPOSIT')
      setBankReference('')
      setNotes('')
      refetch()
    }
  }, [open, refetch])

  const expectedAmount = expectedData?.expectedAmount || 0

  // Calculate variance
  const variance = useMemo(() => {
    const actual = parseFloat(actualAmount) || 0
    return actual - expectedAmount
  }, [actualAmount, expectedAmount])

  const variancePercent = useMemo(() => {
    if (expectedAmount === 0) return 0
    return (variance / expectedAmount) * 100
  }, [variance, expectedAmount])

  const isVarianceHigh = Math.abs(variancePercent) > 5

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)

  // Create closeout mutation
  const createMutation = useMutation({
    mutationFn: () =>
      createCashCloseout(venueId, {
        actualAmount: parseFloat(actualAmount),
        depositMethod,
        bankReference: bankReference || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-closeout'] })
      queryClient.invalidateQueries({ queryKey: ['available-balance'] })

      toast({
        title: t('dialog.success'),
        description: t('dialog.successDescription'),
      })

      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: t('dialog.error'),
        description: error.response?.data?.message || error.message || tCommon('error.unexpected'),
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!actualAmount || parseFloat(actualAmount) < 0) {
      toast({
        title: tCommon('error.prefix'),
        description: t('dialog.actualAmountPlaceholder'),
        variant: 'destructive',
      })
      return
    }

    await createMutation.mutateAsync()
  }

  const isSubmitDisabled = createMutation.isPending || !actualAmount || isLoadingExpected

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              {t('dialog.title')}
            </DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Summary card showing expected vs actual */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              {/* Period info */}
              {expectedData?.periodStart && (
                <p className="text-xs text-muted-foreground">
                  {t('dialog.periodInfo', { date: formatDate(expectedData.periodStart) })}
                </p>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('dialog.expectedAmount')}</span>
                <span className="font-medium font-mono">
                  {isLoadingExpected ? '...' : formatCurrency(expectedAmount)}
                </span>
              </div>

              <div className="h-px bg-border/50" />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('dialog.actualAmount')}</span>
                <span className="font-medium font-mono">
                  {actualAmount ? formatCurrency(parseFloat(actualAmount)) : '-'}
                </span>
              </div>

              <div className="h-px bg-border/50" />

              <div className="flex justify-between font-medium">
                <span>{t('dialog.variance')}</span>
                <span
                  className={cn(
                    'font-mono',
                    variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-foreground'
                  )}
                >
                  {variance > 0 ? '+' : ''}
                  {formatCurrency(variance)} ({variancePercent.toFixed(1)}%)
                </span>
              </div>

              {/* Warning if variance is high */}
              {isVarianceHigh && actualAmount && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded flex gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t('dialog.varianceWarning')}</span>
                </div>
              )}
            </div>

            {/* Actual amount input */}
            <div className="space-y-2">
              <Label htmlFor="actualAmount">{t('dialog.actualAmount')} *</Label>
              <Input
                id="actualAmount"
                type="number"
                step="0.01"
                min="0"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                placeholder={t('dialog.actualAmountPlaceholder')}
                disabled={isLoadingExpected}
                className="font-mono"
              />
            </div>

            {/* Deposit method */}
            <div className="space-y-2">
              <Label>{t('dialog.depositMethod')} *</Label>
              <Select value={depositMethod} onValueChange={(v) => setDepositMethod(v as DepositMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['BANK_DEPOSIT', 'SAFE', 'OWNER_WITHDRAWAL', 'NEXT_SHIFT'] as DepositMethod[]).map(
                    (method) => (
                      <SelectItem key={method} value={method}>
                        <div className="flex items-center gap-2">
                          {DEPOSIT_METHOD_ICONS[method]}
                          <span>{t(`dialog.depositMethods.${method}`)}</span>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Bank reference (only shown for bank deposit) */}
            {depositMethod === 'BANK_DEPOSIT' && (
              <div className="space-y-2">
                <Label htmlFor="bankReference">{t('dialog.bankReference')}</Label>
                <Input
                  id="bankReference"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder={t('dialog.bankReferencePlaceholder')}
                  maxLength={100}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('dialog.notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('dialog.notesPlaceholder')}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('dialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
