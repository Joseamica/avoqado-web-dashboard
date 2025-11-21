import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  type MerchantAccount,
  type MerchantAccountCredentials,
  paymentProviderAPI,
} from '@/services/paymentProvider.service'
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface MerchantAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: MerchantAccount | null
  onSave: (data: {
    providerId: string
    externalMerchantId: string
    alias?: string
    displayName?: string
    active?: boolean
    displayOrder?: number
    credentials: MerchantAccountCredentials
    providerConfig?: any
  }) => Promise<void>
}

export const MerchantAccountDialog: React.FC<MerchantAccountDialogProps> = ({
  open,
  onOpenChange,
  account,
  onSave,
}) => {
  const { t: _t } = useTranslation('superadmin')
  const [loading, setLoading] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)

  const [formData, setFormData] = useState({
    providerId: '',
    externalMerchantId: '',
    alias: '',
    displayName: '',
    active: true,
    displayOrder: 0,
    merchantId: '',
    apiKey: '',
    customerId: '',
    terminalId: '',
    providerConfig: '',
  })

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-list'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
  })

  useEffect(() => {
    if (account) {
      setFormData({
        providerId: account.providerId,
        externalMerchantId: account.externalMerchantId,
        alias: account.alias || '',
        displayName: account.displayName || '',
        active: account.active,
        displayOrder: account.displayOrder || 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: account.providerConfig ? JSON.stringify(account.providerConfig, null, 2) : '',
      })
    } else {
      setFormData({
        providerId: '',
        externalMerchantId: '',
        alias: '',
        displayName: '',
        active: true,
        displayOrder: 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: '',
      })
    }
  }, [account, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const credentials: MerchantAccountCredentials = {
        merchantId: formData.merchantId,
        apiKey: formData.apiKey,
        customerId: formData.customerId || undefined,
        terminalId: formData.terminalId || undefined,
      }

      let providerConfig: any = undefined
      if (formData.providerConfig) {
        try {
          providerConfig = JSON.parse(formData.providerConfig)
        } catch (_err) {
          alert('Invalid JSON in provider config')
          setLoading(false)
          return
        }
      }

      await onSave({
        providerId: formData.providerId,
        externalMerchantId: formData.externalMerchantId,
        alias: formData.alias || undefined,
        displayName: formData.displayName || undefined,
        active: formData.active,
        displayOrder: formData.displayOrder,
        credentials,
        providerConfig,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {account ? 'Edit Merchant Account' : 'Add Merchant Account'}
            </DialogTitle>
            <DialogDescription>
              {account
                ? 'Update merchant account information'
                : 'Add a new merchant account for payment processing'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Provider */}
            <div className="grid gap-2">
              <Label htmlFor="provider">
                Payment Provider <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.providerId}
                onValueChange={value => setFormData({ ...formData, providerId: value })}
                disabled={!!account}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* External Merchant ID */}
            <div className="grid gap-2">
              <Label htmlFor="externalMerchantId">
                External Merchant ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="externalMerchantId"
                value={formData.externalMerchantId}
                onChange={e => setFormData({ ...formData, externalMerchantId: e.target.value })}
                placeholder="8e341c9a-0298-4aa1-ba6b-be11a526560f"
                required
                className="bg-background border-input font-mono text-sm"
              />
            </div>

            {/* Alias */}
            <div className="grid gap-2">
              <Label htmlFor="alias">Alias (Internal Reference)</Label>
              <Input
                id="alias"
                value={formData.alias}
                onChange={e => setFormData({ ...formData, alias: e.target.value })}
                placeholder="main-account"
                className="bg-background border-input"
              />
            </div>

            {/* Display Name */}
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Main Menta Account"
                className="bg-background border-input"
              />
            </div>

            {/* Credentials Section */}
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Credentials (Encrypted)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCredentials(!showCredentials)}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {!account && (
                <div className="flex items-start space-x-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <p>Credentials will be encrypted before storing in the database</p>
                </div>
              )}

              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="merchantId">
                    Merchant ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="merchantId"
                    type={showCredentials ? 'text' : 'password'}
                    value={formData.merchantId}
                    onChange={e => setFormData({ ...formData, merchantId: e.target.value })}
                    required={!account}
                    placeholder="merchant-12345"
                    className="bg-background border-input font-mono text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="apiKey">
                    API Key <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="apiKey"
                    type={showCredentials ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                    required={!account}
                    placeholder="sk_live_..."
                    className="bg-background border-input font-mono text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customerId">Customer ID (Optional)</Label>
                  <Input
                    id="customerId"
                    type={showCredentials ? 'text' : 'password'}
                    value={formData.customerId}
                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                    placeholder="cus_..."
                    className="bg-background border-input font-mono text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="terminalId">Terminal ID (Optional)</Label>
                  <Input
                    id="terminalId"
                    type={showCredentials ? 'text' : 'password'}
                    value={formData.terminalId}
                    onChange={e => setFormData({ ...formData, terminalId: e.target.value })}
                    placeholder="term_..."
                    className="bg-background border-input font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Provider Config (JSON) */}
            <div className="grid gap-2">
              <Label htmlFor="providerConfig">Provider Config (JSON, Optional)</Label>
              <Textarea
                id="providerConfig"
                value={formData.providerConfig}
                onChange={e => setFormData({ ...formData, providerConfig: e.target.value })}
                placeholder='{"webhookSecret": "whsec_...", "mode": "live"}'
                rows={4}
                className="bg-background border-input font-mono text-xs"
              />
            </div>

            {/* Display Order */}
            <div className="grid gap-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                className="bg-background border-input"
              />
            </div>

            {/* Active */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
              />
              <label htmlFor="active" className="text-sm font-medium leading-none cursor-pointer">
                Active
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account ? 'Update Account' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
