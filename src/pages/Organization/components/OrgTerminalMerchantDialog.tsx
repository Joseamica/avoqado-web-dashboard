import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { getOrgMerchantAccounts, type OrgTerminal } from '@/services/organizationDashboard.service'

interface OrgTerminalMerchantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  terminal: OrgTerminal | null
  onSave: (merchantIds: string[]) => Promise<void>
}

export const OrgTerminalMerchantDialog: React.FC<OrgTerminalMerchantDialogProps> = ({
  open,
  onOpenChange,
  orgId,
  terminal,
  onSave,
}) => {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['org-merchant-accounts', orgId],
    queryFn: () => getOrgMerchantAccounts(orgId),
    enabled: open,
  })

  useEffect(() => {
    if (terminal) {
      setSelectedIds(terminal.assignedMerchantIds || [])
    }
  }, [terminal, open])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onSave(selectedIds)
      onOpenChange(false)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: error.response?.data?.message || error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleMerchant = (merchantId: string) => {
    setSelectedIds(prev =>
      prev.includes(merchantId) ? prev.filter(id => id !== merchantId) : [...prev, merchantId],
    )
  }

  if (!terminal) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <DialogTitle>{t('terminals.merchants.title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('terminals.merchants.description', { name: terminal.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="text-sm text-muted-foreground mb-3">
            {t('terminals.merchants.terminalInfo', {
              name: terminal.name,
              serial: terminal.serialNumber || '—',
            })}
          </div>

          {merchantAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('terminals.merchants.noMerchants')}
            </p>
          ) : (
            <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
              {merchantAccounts.map(merchant => (
                <label
                  key={merchant.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(merchant.id)}
                    onChange={() => toggleMerchant(merchant.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 flex items-center gap-2 text-sm">
                    <span className="font-medium">{merchant.displayName || merchant.alias}</span>
                    {merchant.externalMerchantId && (
                      <span className="text-xs text-muted-foreground">({merchant.externalMerchantId})</span>
                    )}
                    {merchant.provider && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{merchant.provider.name}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {t('terminals.merchants.selectedCount', { count: selectedIds.length })}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('terminals.dialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? t('terminals.dialog.saving') : t('terminals.merchants.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
