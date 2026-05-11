import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { includesNormalized } from '@/lib/utils'
import { paymentProviderAPI, type VenuePaymentConfig, type MerchantAccountListItem } from '@/services/paymentProvider.service'

/**
 * Format merchant account display name for dropdown
 * Shows: "Display Name (Provider - Environment)" or "Display Name (Provider)"
 */
function formatAccountLabel(account: MerchantAccountListItem): string {
  const name = account.displayName || account.alias || account.externalMerchantId
  const env = account.environment ? ` - ${account.environment}` : ''
  return `${name} (${account.providerName}${env})`
}

interface VenuePaymentConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: VenuePaymentConfig | null
  venueId: string
  onSave: (data: {
    primaryAccountId: string
    secondaryAccountId?: string
    tertiaryAccountId?: string
    preferredProcessor?: string
  }) => Promise<void>
}

export const VenuePaymentConfigDialog: React.FC<VenuePaymentConfigDialogProps> = ({
  open,
  onOpenChange,
  config,
  venueId: _venueId,
  onSave,
}) => {
  const { t } = useTranslation(['payment', 'common'])
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [primaryAccountId, setPrimaryAccountId] = useState('')
  const [secondaryAccountId, setSecondaryAccountId] = useState('')
  const [tertiaryAccountId, setTertiaryAccountId] = useState('')
  const [preferredProcessor, setPreferredProcessor] = useState('AUTO')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch merchant accounts for selection
  const { data: accounts = [] } = useQuery({
    queryKey: ['merchant-accounts-list'],
    queryFn: () => paymentProviderAPI.getMerchantAccountsList({ active: true }),
  })

  // Populate form when config is provided
  useEffect(() => {
    if (config) {
      setPrimaryAccountId(config.primaryAccountId || '')
      setSecondaryAccountId(config.secondaryAccountId || 'none')
      setTertiaryAccountId(config.tertiaryAccountId || 'none')
      setPreferredProcessor(config.preferredProcessor || 'AUTO')
    } else {
      setPrimaryAccountId('')
      setSecondaryAccountId('none')
      setTertiaryAccountId('none')
      setPreferredProcessor('AUTO')
    }
  }, [config])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!primaryAccountId) return

    setIsSubmitting(true)
    try {
      await onSave({
        primaryAccountId,
        secondaryAccountId: secondaryAccountId !== 'none' ? secondaryAccountId : undefined,
        tertiaryAccountId: tertiaryAccountId !== 'none' ? tertiaryAccountId : undefined,
        preferredProcessor,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateNew = () => {
    onOpenChange(false)
    navigate(`/venues/${slug}/merchant-accounts`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{config ? t('venuePaymentConfig.editConfig') : t('venuePaymentConfig.createConfig')}</DialogTitle>
            <DialogDescription>{t('venuePaymentConfig.configDescription')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
              {/* Primary Account */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('venuePaymentConfig.primaryAccount')} <span className="text-destructive">*</span>
                  </Label>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={handleCreateNew}>
                    + {t('common:createNew')}
                  </Button>
                </div>
                <AccountPicker
                  accounts={accounts}
                  value={primaryAccountId}
                  onChange={setPrimaryAccountId}
                  placeholder={t('venuePaymentConfig.selectAccount')}
                  allowNone={false}
                />
                <p className="text-sm text-muted-foreground">{t('venuePaymentConfig.primaryAccountDesc')}</p>
              </div>

              {/* Secondary Account */}
              <div className="space-y-2">
                <Label>
                  {t('venuePaymentConfig.secondaryAccount')} ({t('common:optional')})
                </Label>
                <AccountPicker
                  accounts={accounts}
                  value={secondaryAccountId}
                  onChange={setSecondaryAccountId}
                  placeholder={t('venuePaymentConfig.selectAccount')}
                  allowNone
                  noneLabel={t('common:none')}
                  excludeIds={[primaryAccountId].filter(Boolean)}
                />
                <p className="text-sm text-muted-foreground">{t('venuePaymentConfig.secondaryAccountDesc')}</p>
              </div>

              {/* Tertiary Account */}
              <div className="space-y-2">
                <Label>
                  {t('venuePaymentConfig.tertiaryAccount')} ({t('common:optional')})
                </Label>
                <AccountPicker
                  accounts={accounts}
                  value={tertiaryAccountId}
                  onChange={setTertiaryAccountId}
                  placeholder={t('venuePaymentConfig.selectAccount')}
                  allowNone
                  noneLabel={t('common:none')}
                  excludeIds={[primaryAccountId, secondaryAccountId !== 'none' ? secondaryAccountId : ''].filter(Boolean)}
                />
                <p className="text-sm text-muted-foreground">{t('venuePaymentConfig.tertiaryAccountDesc')}</p>
              </div>

              {/* Preferred Processor */}
              <div className="space-y-2">
                <Label htmlFor="preferredProcessor">{t('venuePaymentConfig.preferredProcessor')}</Label>
                <Select value={preferredProcessor} onValueChange={setPreferredProcessor}>
                  <SelectTrigger id="preferredProcessor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">{t('venuePaymentConfig.processorAuto')}</SelectItem>
                    <SelectItem value="LEGACY">{t('venuePaymentConfig.processorLegacy')}</SelectItem>
                    <SelectItem value="MENTA">{t('venuePaymentConfig.processorMenta')}</SelectItem>
                    <SelectItem value="CLIP">{t('venuePaymentConfig.processorClip')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common:cancel')}
              </Button>
              <Button type="submit" disabled={!primaryAccountId || isSubmitting}>
                {isSubmitting ? t('common:saving') : t('common:save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- Sub-components ----------

interface AccountPickerProps {
  accounts: MerchantAccountListItem[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  /** When true, allows clearing the selection back to the sentinel value 'none'. */
  allowNone?: boolean
  noneLabel?: string
  /** Account ids to hide (e.g. already chosen as primary/secondary). */
  excludeIds?: string[]
}

function AccountPicker({
  accounts,
  value,
  onChange,
  placeholder,
  allowNone = false,
  noneLabel = 'Sin selección',
  excludeIds = [],
}: AccountPickerProps) {
  const [search, setSearch] = useState('')
  const excludedSet = useMemo(() => new Set(excludeIds), [excludeIds])
  const selected = useMemo(
    () => (value && value !== 'none' ? accounts.find(a => a.id === value) ?? null : null),
    [accounts, value],
  )

  const items = useMemo<SearchComboboxItem[]>(() => {
    const base = accounts.filter(a => !excludedSet.has(a.id))
    const filtered = !search ? base : base.filter(a => includesNormalized(formatAccountLabel(a), search))
    return filtered.map(a => ({ id: a.id, label: formatAccountLabel(a) }))
  }, [accounts, excludedSet, search])

  // Frozen state when an account is selected.
  if (selected) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
        <span className="text-sm flex-1 truncate">{formatAccountLabel(selected)}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground cursor-pointer"
          onClick={() => {
            onChange(allowNone ? 'none' : '')
            setSearch('')
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cambiar
        </Button>
      </div>
    )
  }

  // Empty / search state.
  return (
    <div className="space-y-1">
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
      {allowNone && value !== 'none' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onChange('none')
            setSearch('')
          }}
        >
          {noneLabel}
        </Button>
      )}
    </div>
  )
}
