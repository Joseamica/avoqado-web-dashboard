import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { Loader2, Search, Smartphone, AlertCircle, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { includesNormalized } from '@/lib/utils'
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
  const { t } = useTranslation('terminals')
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [merchantSearch, setMerchantSearch] = useState('')
  const [formData, setFormData] = useState({
    venueId: '',
    serialNumber: '',
    name: '',
    type: TerminalType.TPV_ANDROID,
    brand: 'PAX',
    model: 'A910S',
    assignedMerchantIds: [] as string[],
    generateActivationCode: true,
  })

  const { data: venues = [] } = useQuery({ queryKey: ['venues'], queryFn: () => getAllVenues() })

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
        type: TerminalType.TPV_ANDROID,
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
        title: t('toast.error'),
        description: error.response?.data?.message || error.message || t('toast.error'),
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
              <DialogTitle>{terminal ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
            </div>
            <DialogDescription>
              {terminal ? t('dialog.editDescription') : t('dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="venueId">{t('dialog.venue')} <span className="text-destructive">*</span></Label>
              <VenuePicker
                venues={venues}
                value={formData.venueId}
                onChange={value => setFormData({ ...formData, venueId: value, assignedMerchantIds: [] })}
                placeholder={t('dialog.selectVenue')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serialNumber">{t('dialog.serialNumber')} <span className="text-destructive">*</span></Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder={t('dialog.serialPlaceholder')}
                required
                disabled={!!terminal}
                className="bg-background border-input font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {t('dialog.serialHelp')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">{t('dialog.name')} <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('dialog.namePlaceholder')}
                required
                className="bg-background border-input"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label>{t('dialog.type')}</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as TerminalType })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TPV_ANDROID">{t('dialog.types.tpvAndroid')}</SelectItem>
                    <SelectItem value="TPV_IOS">{t('dialog.types.tpvIos')}</SelectItem>
                    <SelectItem value="PRINTER_RECEIPT">{t('dialog.types.receiptPrinter')}</SelectItem>
                    <SelectItem value="PRINTER_KITCHEN">{t('dialog.types.kitchenPrinter')}</SelectItem>
                    <SelectItem value="KDS">{t('dialog.types.kds')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t('dialog.brand')}</Label>
                <Input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="bg-background" />
              </div>

              <div className="grid gap-2">
                <Label>{t('dialog.model')}</Label>
                <Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="bg-background" />
              </div>
            </div>

            {merchantAccounts.length > 0 && (
              <MerchantPickerSection
                merchants={merchantAccounts}
                selectedIds={formData.assignedMerchantIds}
                onToggle={toggleMerchant}
                search={merchantSearch}
                onSearchChange={setMerchantSearch}
                label={t('dialog.assignedMerchants')}
              />
            )}

            {!terminal && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.generateActivationCode}
                  onChange={(e) => setFormData({ ...formData, generateActivationCode: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('dialog.generateCode')}</span>
              </label>
            )}

            {formData.assignedMerchantIds.length === 0 && (
              <div className="flex items-start space-x-2 text-sm bg-yellow-50 dark:bg-yellow-950/50 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-yellow-700 dark:text-yellow-300">
                  {t('dialog.noMerchantWarning')}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{t('dialog.cancel')}</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? t('dialog.saving') : terminal ? t('dialog.update') : t('dialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Sub-components ----------

interface VenuePickerProps {
  venues: Array<{ id: string; name: string; slug?: string }>
  value: string
  onChange: (id: string) => void
  placeholder: string
}

function VenuePicker({ venues, value, onChange, placeholder }: VenuePickerProps) {
  const [search, setSearch] = useState('')

  const selected = useMemo(() => (value ? venues.find(v => v.id === value) ?? null : null), [venues, value])

  const items = useMemo<SearchComboboxItem[]>(
    () =>
      venues
        .filter(v => !search || includesNormalized(v.name ?? '', search))
        .map(v => ({ id: v.id, label: v.name, description: v.slug })),
    [venues, search],
  )

  if (selected) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
        <span className="text-sm flex-1 truncate">{selected.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground cursor-pointer"
          onClick={() => {
            onChange('')
            setSearch('')
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cambiar
        </Button>
      </div>
    )
  }

  return (
    <SearchCombobox
      placeholder={placeholder}
      items={items}
      value={search}
      onChange={setSearch}
      onSelect={item => {
        onChange(item.id)
        setSearch('')
      }}
    />
  )
}

interface MerchantOption {
  id: string
  displayName?: string | null
  alias?: string | null
  externalMerchantId?: string | null
  provider?: { name: string } | null
}

interface MerchantPickerSectionProps {
  merchants: MerchantOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  label: string
}

function MerchantPickerSection({
  merchants,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  label,
}: MerchantPickerSectionProps) {
  const filtered = useMemo(() => {
    if (!search) return merchants
    return merchants.filter(m => {
      const haystack = [m.displayName, m.alias, m.externalMerchantId, m.provider?.name].filter(Boolean).join(' ')
      return includesNormalized(haystack, search)
    })
  }, [merchants, search])

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {selectedIds.length > 0 && (
          <span className="text-xs text-muted-foreground">{selectedIds.length} seleccionado(s)</span>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar comercio…"
          className="h-9 pl-8 text-sm bg-background"
        />
      </div>
      <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto bg-background">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
        ) : (
          filtered.map(merchant => (
            <label
              key={merchant.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(merchant.id)}
                onChange={() => onToggle(merchant.id)}
                className="w-4 h-4"
              />
              <div className="flex-1 flex items-center gap-2 text-sm min-w-0">
                <span className="font-medium truncate">{merchant.displayName || merchant.alias}</span>
                {merchant.externalMerchantId && (
                  <span className="text-xs text-muted-foreground truncate">({merchant.externalMerchantId})</span>
                )}
                {merchant.provider && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">{merchant.provider.name}</span>
                )}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
