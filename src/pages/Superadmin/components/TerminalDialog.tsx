import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Smartphone, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { getAllVenues } from '@/services/superadmin.service'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { Terminal, TerminalType, CreateTerminalRequest } from '@/services/superadmin-terminals.service'

interface TerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  terminal?: Terminal | null
  onSave: (data: CreateTerminalRequest) => Promise<void>
}

export const TerminalDialog: React.FC<TerminalDialogProps> = ({ open, onOpenChange, terminal, onSave }) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    venueId: '',
    serialNumber: '',
    name: '',
    type: 'TPV_ANDROID' as TerminalType,
    brand: 'PAX',
    model: 'A910S',
    assignedMerchantIds: [] as string[],
    generateActivationCode: true,
  })

  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: getAllVenues })

  // Superadmin can assign ANY merchant account to ANY terminal (cross-venue)
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
  })

  useEffect(() => {
    if (terminal) {
      setFormData({
        venueId: terminal.venueId,
        serialNumber: terminal.serialNumber,
        name: terminal.name,
        type: terminal.type,
        brand: terminal.brand || 'PAX',
        model: terminal.model || 'A910S',
        assignedMerchantIds: terminal.assignedMerchantIds || [],
        generateActivationCode: false,
      })
    } else {
      setFormData({
        venueId: '',
        serialNumber: '',
        name: '',
        type: 'TPV_ANDROID',
        brand: 'PAX',
        model: 'A910S',
        assignedMerchantIds: [],
        generateActivationCode: true,
      })
    }
  }, [terminal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Ensure serial number has AVQD- prefix (required by Android TPV)
      const serialNumber = formData.serialNumber.startsWith('AVQD-')
        ? formData.serialNumber
        : `AVQD-${formData.serialNumber}`

      await onSave({
        ...formData,
        serialNumber,
      })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleMerchant = (merchantId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedMerchantIds: prev.assignedMerchantIds.includes(merchantId)
        ? prev.assignedMerchantIds.filter(id => id !== merchantId)
        : [...prev.assignedMerchantIds, merchantId]
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-500" />
              <DialogTitle>{terminal ? 'Edit Terminal' : 'Create New Terminal'}</DialogTitle>
            </div>
            <DialogDescription>
              {terminal ? 'Update terminal configuration' : 'Create a new terminal and optionally generate an activation code'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="venueId">Venue <span className="text-destructive">*</span></Label>
              <Select value={formData.venueId} onValueChange={(value) => setFormData({ ...formData, venueId: value, assignedMerchantIds: [] })}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select venue..." />
                </SelectTrigger>
                <SelectContent>
                  {venues.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serialNumber">Serial Number <span className="text-destructive">*</span></Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="2841548417 (AVQD- prefix will be added automatically)"
                required
                disabled={!!terminal}
                className="bg-background border-input font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter the serial number. The "AVQD-" prefix will be added automatically if not present.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Terminal Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Main POS Terminal"
                required
                className="bg-background border-input"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as TerminalType })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TPV_ANDROID">TPV Android (Payment Terminal)</SelectItem>
                    <SelectItem value="TPV_IOS">TPV iOS</SelectItem>
                    <SelectItem value="PRINTER_RECEIPT">Receipt Printer</SelectItem>
                    <SelectItem value="PRINTER_KITCHEN">Kitchen Printer</SelectItem>
                    <SelectItem value="KDS">Kitchen Display System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Brand</Label>
                <Input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="bg-background" />
              </div>

              <div className="grid gap-2">
                <Label>Model</Label>
                <Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="bg-background" />
              </div>
            </div>

            {merchantAccounts.length > 0 && (
              <div className="grid gap-2">
                <Label>Assigned Merchant Accounts (All Providers)</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                  {merchantAccounts.map(merchant => (
                    <label key={merchant.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.assignedMerchantIds.includes(merchant.id)}
                        onChange={() => toggleMerchant(merchant.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 flex items-center gap-2 text-sm">
                        <span className="font-medium">{merchant.displayName || merchant.alias}</span>
                        <span className="text-xs text-muted-foreground">({merchant.externalMerchantId})</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{merchant.provider?.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!terminal && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.generateActivationCode}
                  onChange={(e) => setFormData({ ...formData, generateActivationCode: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Generate activation code after creation</span>
              </label>
            )}

            {formData.assignedMerchantIds.length === 0 && (
              <div className="flex items-start space-x-2 text-sm bg-yellow-50 dark:bg-yellow-950/50 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-yellow-700 dark:text-yellow-300">
                  No merchant accounts assigned. Terminal won't be able to process payments until at least one merchant account is assigned.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Saving...' : terminal ? 'Update Terminal' : 'Create Terminal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
