import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Calendar, ChevronDown, DollarSign, Heart, Plus, Settings, Tag, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import type {
  CreatePaymentLinkRequest,
  CustomFieldDefinition,
  TippingConfig,
  UpdatePaymentLinkRequest,
} from '@/services/paymentLink.service'
import paymentLinkService from '@/services/paymentLink.service'
import { ecommerceMerchantAPI } from '@/services/ecommerceMerchant.service'
import teamService from '@/services/team.service'
import type { Product } from '@/types'

import { DonationPreview } from './components/DonationPreview'
import { ItemFormSection, type BundleItem } from './components/ItemFormSection'
import { ItemPreview } from './components/ItemPreview'
import { PaymentLinkPreview } from './components/PaymentLinkPreview'
import { ShareActions } from './components/ShareActions'

interface CreatePaymentLinkDialogProps {
  open: boolean
  onClose: () => void
  editingLinkId?: string
}

type LinkPurpose = 'payment' | 'item' | 'event' | 'donation'

const PURPOSES: { key: LinkPurpose; icon: typeof DollarSign; comingSoon?: boolean }[] = [
  { key: 'payment', icon: Banknote },
  { key: 'item', icon: Tag },
  { key: 'event', icon: Calendar, comingSoon: true },
  { key: 'donation', icon: Heart },
]

export default function CreatePaymentLinkDialog({ open, onClose, editingLinkId }: CreatePaymentLinkDialogProps) {
  const { venueId, venue, fullBasePath } = useCurrentVenue()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { t } = useTranslation('paymentLinks')
  const { t: tCommon } = useTranslation()

  const isEditing = !!editingLinkId

  // ─── Wizard state ──────────────────────────────────────
  const [step, setStep] = useState<'type' | 'details'>(isEditing ? 'details' : 'type')
  const [selectedPurpose, setSelectedPurpose] = useState<LinkPurpose | null>(null)

  // ─── Form state ────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amountType, setAmountType] = useState<'FIXED' | 'OPEN'>('FIXED')
  const [amount, setAmount] = useState('')
  const [isReusable, setIsReusable] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [redirectEnabled, setRedirectEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ─── Item-specific state ──────────────────────────────
  // Bundle line items for ITEM-purpose links. Multi-product: each entry has
  // its own quantity. Single-product is just length=1. The total customer pays
  // is sum(quantity × product.price). Empty array = no items selected.
  const [selectedItems, setSelectedItems] = useState<BundleItem[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [customFieldsEnabled, setCustomFieldsEnabled] = useState(false)
  const [tippingConfig, setTippingConfig] = useState<TippingConfig | null>(null)
  const [purposeDropdownOpen, setPurposeDropdownOpen] = useState(false)

  // ─── Commission attribution (optional, multi-staff) ──────
  // Array of staff IDs who share commission for sales via this link.
  // [] = no commission. N IDs = backend splits commission equally (1/N each).
  // Distinct from the LINK CREATOR (logged-in user) — a manager can create
  // a link "on behalf of" one or more salespeople.
  const [attributedStaffIds, setAttributedStaffIds] = useState<string[]>([])
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false)
  const { data: teamPage } = useQuery({
    queryKey: ['team-members', venueId, 'for-payment-link-attribution'],
    queryFn: () => teamService.getTeamMembers(venueId, 1, 100),
    enabled: !!venueId && open && !isEditing,
    staleTime: 60_000,
  })
  const activeStaff = useMemo(
    () => (teamPage?.data ?? []).filter(m => m.active && m.staffId),
    [teamPage?.data],
  )
  const attributedStaffNames = useMemo(() => {
    if (attributedStaffIds.length === 0) return null
    return activeStaff
      .filter(s => attributedStaffIds.includes(s.staffId))
      .map(s => `${s.firstName} ${s.lastName}`.trim())
  }, [attributedStaffIds, activeStaff])

  // ─── Channel (ecommerce merchant) selection ──────────────
  // Only shown when the venue has 2+ active channels USABLE for online
  // checkout. TPV-only providers (Menta, AngelPay, etc.) are excluded — they
  // don't have ecommerce checkout integration today. Stripe Connect channels
  // also require chargesEnabled (Stripe approved the account) to be usable.
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null)
  const { data: allActiveMerchants = [] } = useQuery({
    queryKey: ['ecommerce-merchants', venueId, 'active-for-payment-link-create'],
    queryFn: () => ecommerceMerchantAPI.listByVenue(venueId, { active: true }),
    enabled: !!venueId && open && !isEditing,
  })

  const usableMerchants = useMemo(() => {
    return allActiveMerchants.filter(m => {
      const code = m.provider?.code
      // Stripe Connect: must have charges enabled (Stripe approved).
      if (code === 'STRIPE_CONNECT') return !!m.chargesEnabled
      // Blumon: has working ecommerce inline flow.
      if (code === 'BLUMON') return true
      // Everything else (Menta, AngelPay, Clip, ...) → TPV providers; no
      // online payment flow wired up today. Exclude from payment-link UI.
      return false
    })
  }, [allActiveMerchants])

  // Venue-wide defaults from the "Ajustes generales" page. Used to seed the
  // tipping config, custom fields, and the customerNotes shorthand toggle
  // when the user opens a fresh create dialog. Edit mode ignores these and
  // shows what was saved on the link itself.
  const { data: venueSettings } = useQuery({
    queryKey: ['payment-link-settings', venueId],
    queryFn: () => paymentLinkService.getSettings(venueId),
    enabled: !!venueId && open && !isEditing,
  })

  const showMerchantPicker = usableMerchants.length > 1

  // Auto-select the only usable merchant so the user never has to pick when
  // there's no real choice. Reruns if the underlying list changes.
  useEffect(() => {
    if (!showMerchantPicker && usableMerchants.length === 1 && !selectedMerchantId) {
      setSelectedMerchantId(usableMerchants[0].id)
    }
  }, [usableMerchants, showMerchantPicker, selectedMerchantId])

  // ─── Load existing link for editing ────────────────────
  const { data: existingLink } = useQuery({
    queryKey: ['payment-link', venueId, editingLinkId],
    queryFn: () => paymentLinkService.getPaymentLink(venueId, editingLinkId!),
    enabled: isEditing && open,
  })

  useEffect(() => {
    if (existingLink?.data) {
      const link = existingLink.data
      setTitle(link.title)
      setDescription(link.description || '')
      setAmountType(link.amountType)
      setAmount(link.amount ? String(link.amount) : '')
      setIsReusable(link.isReusable)
      setRedirectUrl(link.redirectUrl || '')
      setRedirectEnabled(!!link.redirectUrl)
      setStep('details')

      // Restore custom fields
      if (link.customFields && link.customFields.length > 0) {
        setCustomFields(link.customFields)
        setCustomFieldsEnabled(true)
      } else {
        setCustomFields([])
        setCustomFieldsEnabled(false)
      }

      // Restore tipping config
      setTippingConfig(link.tippingConfig || null)

      // Map purpose from backend enum to frontend key
      const purposeReverseMap: Record<string, LinkPurpose> = {
        PAYMENT: 'payment',
        ITEM: 'item',
        DONATION: 'donation',
      }
      setSelectedPurpose(purposeReverseMap[link.purpose] || 'payment')

      // Restore bundle line items + modifiers for ITEM links. Empty for
      // PAYMENT/DONATION. The dialog supports re-editing the full bundle.
      if (link.purpose === 'ITEM' && Array.isArray(link.items)) {
        setSelectedItems(
          link.items.map(it => ({
            product: {
              id: it.product.id,
              name: it.product.name,
              description: it.product.description || null,
              price: it.product.price,
              imageUrl: it.product.imageUrl || null,
            } as Product,
            quantity: it.quantity,
            modifiers: (it.modifiers ?? []).map(m => ({
              modifierId: m.modifier.id,
              name: m.modifier.name,
              price: Number(m.modifier.price),
              quantity: m.quantity,
            })),
          })),
        )
      } else {
        setSelectedItems([])
      }
    }
  }, [existingLink])

  // Reset form state whenever the dialog opens (for new links) or closes.
  // Seeds tipping + custom-fields from venue settings so the operator's
  // "Ajustes generales" defaults are actually applied. `customerNotesEnabled`
  // is shorthand: if it's on AND defaultCustomFields is empty, seed a single
  // "Nota" text field so the customer gets a free-text comment box.
  useEffect(() => {
    if (open && !isEditing) {
      setTitle('')
      setDescription('')
      setAmountType('FIXED')
      setAmount('')
      setIsReusable(false)
      setRedirectUrl('')
      setRedirectEnabled(false)
      setSelectedItems([])

      const seededFields = (venueSettings?.defaultCustomFields && venueSettings.defaultCustomFields.length > 0)
        ? venueSettings.defaultCustomFields
        : venueSettings?.customerNotesEnabled
          ? [{ id: `cf_note_${Date.now()}`, type: 'TEXT' as const, label: 'Nota', required: false }]
          : []
      setCustomFields(seededFields)
      setCustomFieldsEnabled(seededFields.length > 0)

      setTippingConfig(venueSettings?.defaultTippingConfig ?? null)

      setPurposeDropdownOpen(false)
      setStep('type')
      setSelectedPurpose(null)
    }
    if (!open) {
      setStep(isEditing ? 'details' : 'type')
      setSelectedPurpose(null)
      setPurposeDropdownOpen(false)
    }
  }, [open, isEditing, venueSettings])

  const handlePurposeSelect = (purpose: LinkPurpose) => {
    const def = PURPOSES.find(p => p.key === purpose)
    if (def?.comingSoon) return
    setSelectedPurpose(purpose)
    switch (purpose) {
      case 'payment':
        setAmountType('FIXED')
        setIsReusable(false)
        break
      case 'item':
        setAmountType('FIXED')
        setIsReusable(false)
        break
      case 'donation':
        setAmountType('OPEN')
        setIsReusable(true)
        break
      case 'event':
        setAmountType('FIXED')
        setIsReusable(false)
        break
    }
  }

  const handleContinue = () => {
    if (selectedPurpose) setStep('details')
  }

  // ─── Mutations ─────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentLinkRequest) => paymentLinkService.createPaymentLink(venueId, data),
    onSuccess: () => {
      toast({ title: t('toasts.created') })
      queryClient.invalidateQueries({ queryKey: ['payment-links', venueId] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || error.response?.data?.error || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePaymentLinkRequest) => paymentLinkService.updatePaymentLink(venueId, editingLinkId!, data),
    onSuccess: () => {
      toast({ title: t('toasts.updated') })
      queryClient.invalidateQueries({ queryKey: ['payment-links', venueId] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || error.response?.data?.error || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    // For ITEM (bundle) purpose: derive title + amount from the items list.
    // With 1 product use its name + description; with N show "N artículos".
    // Total = sum(qty × price). The backend recomputes this too as a guard.
    const bundleSubtotal = selectedItems.reduce((sum, it) => {
      const modSum = it.modifiers.reduce((m, mm) => m + mm.price * mm.quantity, 0)
      return sum + (Number(it.product.price) + modSum) * it.quantity
    }, 0)
    const effectiveTitle =
      selectedPurpose === 'item'
        ? selectedItems.length === 1
          ? selectedItems[0].product.name
          : selectedItems.length > 1
            ? title.trim() || `Bundle (${selectedItems.length} artículos)`
            : ''
        : title.trim()
    const effectiveAmount =
      selectedPurpose === 'item' && selectedItems.length > 0
        ? bundleSubtotal
        : amount
          ? parseFloat(amount)
          : undefined
    const effectiveDescription =
      selectedPurpose === 'item' && selectedItems.length === 1
        ? selectedItems[0].product.description || ''
        : description.trim()

    if (!effectiveTitle) return

    // Map purpose to backend enum
    const purposeMap: Record<LinkPurpose, 'PAYMENT' | 'ITEM' | 'DONATION'> = {
      payment: 'PAYMENT',
      item: 'ITEM',
      event: 'PAYMENT', // events not yet implemented
      donation: 'DONATION',
    }

    // Sanitize custom fields: drop fields with no label, strip empty options
    const sanitizedFields = customFields
      .filter(f => f.label.trim().length > 0)
      .map(f => ({
        ...f,
        label: f.label.trim(),
        options: f.type === 'SELECT' ? (f.options || []).filter(o => o.trim().length > 0).map(o => o.trim()) : undefined,
      }))

    const baseData = {
      title: effectiveTitle,
      description: effectiveDescription || undefined,
      amountType,
      ...(amountType === 'FIXED' && effectiveAmount ? { amount: effectiveAmount } : {}),
      isReusable,
      ...(customFieldsEnabled && sanitizedFields.length > 0 ? { customFields: sanitizedFields } : { customFields: null }),
      ...(tippingConfig ? { tippingConfig } : { tippingConfig: null }),
    }

    setIsSaving(true)
    if (isEditing) {
      const updateData: UpdatePaymentLinkRequest = {
        ...baseData,
        // Explicitly null when disabled so backend clears existing value
        redirectUrl: redirectEnabled && redirectUrl.trim() ? redirectUrl.trim() : null,
        // Replace bundle items list for ITEM links (incl. their modifiers)
        ...(selectedPurpose === 'item'
          ? {
              items: selectedItems.map(it => ({
                productId: it.product.id,
                quantity: it.quantity,
                modifiers: it.modifiers.map(m => ({ modifierId: m.modifierId, quantity: m.quantity })),
              })),
            }
          : {}),
      }
      updateMutation.mutate(updateData, { onSettled: () => setIsSaving(false) })
    } else {
      const createData: CreatePaymentLinkRequest = {
        ...baseData,
        ...(redirectEnabled && redirectUrl.trim() ? { redirectUrl: redirectUrl.trim() } : {}),
        purpose: selectedPurpose ? purposeMap[selectedPurpose] : 'PAYMENT',
        ...(selectedPurpose === 'item'
          ? {
              items: selectedItems.map(it => ({
                productId: it.product.id,
                quantity: it.quantity,
                modifiers: it.modifiers.map(m => ({ modifierId: m.modifierId, quantity: m.quantity })),
              })),
            }
          : {}),
        // Pin to selected channel when set. Only matters with >1 active
        // merchants — for the 1-channel case it's still set, harmlessly.
        ...(selectedMerchantId ? { ecommerceMerchantId: selectedMerchantId } : {}),
        // Commission attribution. Empty array → no commission. N IDs → backend
        // splits commission equally across all attributed staff (1/N each).
        attributedStaffIds,
      }
      createMutation.mutate(createData, { onSettled: () => setIsSaving(false) })
    }
  }

  const canSave =
    selectedPurpose === 'item'
      ? selectedItems.length > 0
      : title.trim().length > 0 && (amountType === 'OPEN' || (amountType === 'FIXED' && parseFloat(amount) > 0))

  const handleClose = () => {
    if (step === 'details' && !isEditing) {
      setStep('type')
    } else {
      onClose()
    }
  }

  // ─── Custom fields & tipping handlers (for payment/donation form) ──
  const addCustomField = () => {
    if (customFields.length >= 5) return
    setCustomFields([...customFields, { id: `cf_${Date.now()}`, type: 'TEXT', label: '', required: false }])
  }

  const updateField = (index: number, updates: Partial<CustomFieldDefinition>) => {
    const updated = [...customFields]
    updated[index] = { ...updated[index], ...updates }
    setCustomFields(updated)
  }

  const removeField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  const tippingEnabled = tippingConfig !== null
  const handleTippingToggle = (enabled: boolean) => {
    if (enabled) {
      setTippingConfig({ presets: [10, 15, 20], allowCustom: true })
    } else {
      setTippingConfig(null)
    }
  }

  const updatePreset = (index: number, value: string) => {
    if (!tippingConfig) return
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1 || num > 100) return
    const presets = [...tippingConfig.presets]
    presets[index] = num
    setTippingConfig({ ...tippingConfig, presets })
  }

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      subtitle={venue?.name}
      title={step === 'type' ? t('form.createTitle') : isEditing ? t('form.editTitle') : t('form.createTitle')}
      contentClassName="bg-muted/30"
      actions={
        step === 'type' ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => navigate(`${fullBasePath}/payment-links/settings`)}
              aria-label={t('form.settings')}
              className="h-10 w-10 rounded-full cursor-pointer"
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">{t('form.settings')}</span>
            </Button>
            <Button onClick={handleContinue} disabled={!selectedPurpose} className="cursor-pointer">
              {t('wizard.continue')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isEditing && existingLink?.data && (
              <ShareActions shortCode={existingLink.data.shortCode} title={existingLink.data.title} asDropdown />
            )}
            <Button onClick={handleSave} disabled={!canSave || isSaving} className="cursor-pointer">
              {t('form.save')}
            </Button>
          </div>
        )
      }
    >
      {step === 'type' ? (
        /* ─── Step 1: Purpose Selection (Square-style flat list) ──────── */
        <div className="mx-auto max-w-6xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left: Type list */}
            <div className="lg:col-span-2 space-y-2">
              {PURPOSES.map(({ key, icon: Icon, comingSoon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePurposeSelect(key)}
                  disabled={comingSoon}
                  className={`w-full flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all duration-150 ${
                    comingSoon
                      ? 'opacity-50 cursor-not-allowed border-border'
                      : selectedPurpose === key
                        ? 'border-primary bg-primary/10 cursor-pointer'
                        : 'border-border hover:border-foreground/30 cursor-pointer'
                  }`}
                >
                  <Icon className="h-5 w-5 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="font-medium text-sm">{t(`wizard.${key}Title`)}</span>
                  {comingSoon && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-auto">
                      {tCommon('common.comingSoon', 'Muy pronto')}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right: Live preview */}
            <div className="lg:col-span-3">
              <div className="sticky top-24">
                {selectedPurpose === 'item' ? (
                  <ItemPreview items={[]} redirectEnabled={false} redirectUrl="" />
                ) : selectedPurpose === 'donation' ? (
                  <DonationPreview title={title || t('preview.donationTitlePlaceholder')} description={description} />
                ) : (
                  <PaymentLinkPreview
                    title={title || t('form.titlePlaceholder')}
                    description={description}
                    amountType="OPEN"
                    amount={undefined}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Step 2: Details Form ──────────────────────────── */
        <div className="mx-auto max-w-6xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left: Form (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Purpose selector dropdown (Square-style) */}
              {!isEditing && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPurposeDropdownOpen(!purposeDropdownOpen)}
                    className="w-full flex items-center gap-3 rounded-xl border border-input bg-card p-4 text-left cursor-pointer hover:border-foreground/30 transition-colors"
                  >
                    {selectedPurpose &&
                      (() => {
                        const PurposeIcon = PURPOSES.find(p => p.key === selectedPurpose)?.icon || Banknote
                        return (
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                            <PurposeIcon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                          </div>
                        )
                      })()}
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{t('wizard.purposeLabel')}</p>
                      <p className="font-medium text-sm">{selectedPurpose ? t(`wizard.${selectedPurpose}Title`) : ''}</p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${purposeDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {purposeDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-input bg-card shadow-lg overflow-hidden">
                      {PURPOSES.filter(p => !p.comingSoon).map(({ key, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            handlePurposeSelect(key)
                            setPurposeDropdownOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer ${
                            selectedPurpose === key ? 'bg-muted/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                            <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                          </div>
                          <span className="text-sm font-medium">{t(`wizard.${key}Title`)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Purpose-specific form content */}
              {selectedPurpose === 'item' ? (
                <ItemFormSection
                  selectedItems={selectedItems}
                  onItemsChange={setSelectedItems}
                  customFields={customFields}
                  onCustomFieldsChange={setCustomFields}
                  customFieldsEnabled={customFieldsEnabled}
                  onCustomFieldsEnabledChange={setCustomFieldsEnabled}
                  tippingConfig={tippingConfig}
                  onTippingConfigChange={setTippingConfig}
                  redirectUrl={redirectUrl}
                  onRedirectUrlChange={setRedirectUrl}
                  redirectEnabled={redirectEnabled}
                  onRedirectEnabledChange={setRedirectEnabled}
                />
              ) : (
                /* Default payment/donation form — flat sections (Square-style) */
                <div className="space-y-8">
                  {/* ── Details section ─────────────────────── */}
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">{t('form.details')}</h2>

                    <div className="space-y-2">
                      <Label htmlFor="pl-title">{t('form.titleField')}</Label>
                      <Input
                        id="pl-title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder={t('form.titlePlaceholder')}
                        className="h-12 text-base"
                        maxLength={100}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pl-description">{t('form.descriptionField')}</Label>
                      <Textarea
                        id="pl-description"
                        value={description}
                        onChange={e => setDescription(e.target.value.slice(0, 400))}
                        placeholder={t('form.descriptionPlaceholder')}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {t('form.descriptionCount', { count: description.length })}
                      </p>
                    </div>
                  </section>

                  <hr className="border-border" />

                  {/* ── Amount section ──────────────────────── */}
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">{t('form.amount')}</h2>

                    <div className="space-y-2">
                      <Label>{t('form.amountType')}</Label>
                      <div className="flex rounded-lg border border-input bg-muted/50 p-1">
                        <button
                          type="button"
                          onClick={() => setAmountType('FIXED')}
                          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            amountType === 'FIXED' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t('form.fixed')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountType('OPEN')}
                          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            amountType === 'OPEN' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t('form.open')}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">{amountType === 'FIXED' ? t('form.fixedHint') : t('form.openHint')}</p>
                    </div>

                    {amountType === 'FIXED' && (
                      <div className="space-y-2">
                        <Label htmlFor="pl-amount">{t('form.amountField')}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            id="pl-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder={t('form.amountPlaceholder')}
                            className="h-12 text-base pl-7"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <hr className="border-border" />

                  {/* ── Payment process section ───────────────── */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold">{t('itemForm.paymentProcess')}</h2>

                    {/* Custom fields toggle */}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">{t('itemForm.customFields')}</span>
                      <Switch
                        checked={customFieldsEnabled}
                        onCheckedChange={val => {
                          setCustomFieldsEnabled(val)
                          if (!val) {
                            setCustomFields([])
                          } else if (customFields.length === 0) {
                            setCustomFields([{ id: `cf_${Date.now()}`, type: 'TEXT', label: '', required: false }])
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </div>

                    {/* Custom fields list */}
                    {customFieldsEnabled && (
                      <div className="space-y-3">
                        {customFields.map((field, index) => (
                          <div key={field.id} className="rounded-xl border border-input bg-card p-3.5 space-y-2.5">
                            {/* Row 1: Label + Delete */}
                            <div className="flex items-center gap-2">
                              <Input
                                value={field.label}
                                onChange={e => updateField(index, { label: e.target.value })}
                                placeholder={t('itemForm.customFieldPlaceholder')}
                                className="flex-1 h-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                                onClick={() => removeField(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Row 2: Type selector + Required checkbox */}
                            <div className="flex items-center gap-3">
                              <Select
                                value={field.type}
                                onValueChange={val =>
                                  updateField(index, {
                                    type: val as 'TEXT' | 'SELECT',
                                    options: val === 'SELECT' ? field.options || [''] : undefined,
                                  })
                                }
                              >
                                <SelectTrigger className="w-[100px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TEXT">{t('itemForm.fieldTypeText')}</SelectItem>
                                  <SelectItem value="SELECT">{t('itemForm.fieldTypeSelect')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <Checkbox
                                  checked={field.required}
                                  onCheckedChange={val => updateField(index, { required: val === true })}
                                  className="cursor-pointer"
                                />
                                <span className="text-xs text-muted-foreground">{t('itemForm.requiredField')}</span>
                              </label>
                            </div>

                            {/* Options for SELECT type */}
                            {field.type === 'SELECT' && (
                              <div className="space-y-1.5 pl-1">
                                {(field.options || ['']).map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground w-4">{optIdx + 1}.</span>
                                    <Input
                                      value={opt}
                                      onChange={e => {
                                        const opts = [...(field.options || [''])]
                                        opts[optIdx] = e.target.value
                                        updateField(index, { options: opts })
                                      }}
                                      placeholder={t('itemForm.optionPlaceholder')}
                                      className="h-8 text-sm flex-1"
                                    />
                                    {(field.options || []).length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        onClick={() => {
                                          const opts = (field.options || []).filter((_, i) => i !== optIdx)
                                          updateField(index, { options: opts })
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {(field.options || []).length < 10 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      const opts = [...(field.options || []), '']
                                      updateField(index, { options: opts })
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {t('itemForm.addOption')}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {customFields.length < 5 && (
                          <button
                            type="button"
                            onClick={addCustomField}
                            className="w-full rounded-full border border-dashed border-border bg-muted/40 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                          >
                            {t('itemForm.addCustomField')}
                          </button>
                        )}
                        <p className="text-xs text-muted-foreground text-center">
                          {t('itemForm.customFieldsLimit', { count: customFields.length, max: 5 })}
                        </p>
                      </div>
                    )}

                    {/* Tips toggle */}
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">{t('itemForm.tips')}</span>
                      <Switch checked={tippingEnabled} onCheckedChange={handleTippingToggle} className="cursor-pointer" />
                    </div>

                    {/* Tipping config */}
                    {tippingEnabled && tippingConfig && (
                      <div className="rounded-xl border border-input bg-card p-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2.5">{t('itemForm.tipPresets')}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {tippingConfig.presets.map((preset, index) => (
                              <div key={index} className="relative">
                                <Input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={preset}
                                  onChange={e => updatePreset(index, e.target.value)}
                                  className="h-10 text-center pr-7 text-base font-medium"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                          <span className="text-sm">{t('itemForm.allowCustomTip')}</span>
                          <Switch
                            checked={tippingConfig.allowCustom}
                            onCheckedChange={val => setTippingConfig({ ...tippingConfig, allowCustom: val })}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <hr className="border-border" />

                  {/* ── Settings section (reusable + redirect only — channel
                      and staff attribution moved to shared section below) ── */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold">{t('form.settings')}</h2>

                    <div className="flex items-center justify-between py-1">
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium">{t('form.reusable')}</span>
                        <p className="text-xs text-muted-foreground">{isReusable ? t('form.reusableHint') : t('form.singleUse')}</p>
                      </div>
                      <Switch checked={isReusable} onCheckedChange={setIsReusable} className="cursor-pointer" />
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm font-medium">{t('form.redirectUrl')}</span>
                      <Switch checked={redirectEnabled} onCheckedChange={setRedirectEnabled} className="cursor-pointer" />
                    </div>

                    {redirectEnabled && (
                      <div className="space-y-2">
                        <Input
                          id="pl-redirect"
                          type="url"
                          value={redirectUrl}
                          onChange={e => setRedirectUrl(e.target.value)}
                          placeholder={t('form.redirectUrlPlaceholder')}
                        />
                        <p className="text-xs text-muted-foreground">{t('form.redirectUrlHint')}</p>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* Shared Configuración — channel picker + commission attribution.
                  Renders for ALL purposes (PAYMENT/ITEM/DONATION). Sits outside
                  the purpose-specific branches so the ITEM flow gets them too.
                  For ITEM we render the heading + divider; for non-ITEM the
                  existing Settings section above already owns the heading. */}
              {!isEditing && (
                <section className="space-y-4 mt-8">
                  {selectedPurpose === 'item' && (
                    <>
                      <hr className="border-border" />
                      <h2 className="text-lg font-semibold pt-4">{t('form.settings')}</h2>
                    </>
                  )}

                  {showMerchantPicker && (
                    <div className="space-y-2 py-1">
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium">Canal de cobro</span>
                        <p className="text-xs text-muted-foreground">
                          Tu venue tiene más de un canal activo. Elige cuál procesará los pagos de esta liga.
                        </p>
                      </div>
                      <Select value={selectedMerchantId ?? ''} onValueChange={v => setSelectedMerchantId(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {usableMerchants.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="font-medium">{m.channelName}</span>
                              {m.provider?.name && <span className="text-muted-foreground"> · {m.provider.name}</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 py-1">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">Atribuir comisión a</span>
                      <p className="text-xs text-muted-foreground">
                        Elige uno o varios miembros del equipo. Si seleccionas más de uno, la comisión se divide en partes iguales (ej. 2 personas = 50/50, 3 = 33/33/33). Si dejas vacío, no se genera comisión.
                      </p>
                    </div>
                    <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal h-auto min-h-10 py-2"
                        >
                          <span className="flex flex-wrap gap-1 items-center text-left">
                            {!attributedStaffNames ? (
                              <span className="text-muted-foreground">Sin atribución (no genera comisión)</span>
                            ) : attributedStaffNames.length <= 3 ? (
                              attributedStaffNames.map(name => (
                                <span
                                  key={name}
                                  className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span>
                                {attributedStaffNames.length} personas · split{' '}
                                {(100 / attributedStaffNames.length).toFixed(0)}/{(100 / attributedStaffNames.length).toFixed(0)}…
                              </span>
                            )}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar persona…" />
                          <CommandList>
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              {activeStaff.map(m => {
                                const checked = attributedStaffIds.includes(m.staffId)
                                return (
                                  <CommandItem
                                    key={m.staffId}
                                    value={`${m.firstName} ${m.lastName} ${m.role}`}
                                    onSelect={() => {
                                      setAttributedStaffIds(prev =>
                                        checked ? prev.filter(id => id !== m.staffId) : [...prev, m.staffId],
                                      )
                                    }}
                                    className="cursor-pointer gap-2"
                                  >
                                    <Checkbox checked={checked} className="pointer-events-none" />
                                    <span className="font-medium">
                                      {m.firstName} {m.lastName}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-auto">{m.role}</span>
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                        {attributedStaffIds.length > 0 && (
                          <div className="border-t border-border p-2 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {attributedStaffIds.length === 1
                                ? '1 persona · 100%'
                                : `${attributedStaffIds.length} personas · ${(100 / attributedStaffIds.length).toFixed(1)}% c/u`}
                            </span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground underline cursor-pointer"
                              onClick={() => setAttributedStaffIds([])}
                            >
                              Limpiar
                            </button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </section>
              )}
            </div>

            {/* Right: Preview (3 cols) */}
            <div className="lg:col-span-3">
              <div className="sticky top-24">
                {selectedPurpose === 'item' ? (
                  <ItemPreview
                    items={selectedItems}
                    redirectEnabled={redirectEnabled}
                    redirectUrl={redirectUrl}
                    customFields={customFieldsEnabled ? customFields : undefined}
                    tippingConfig={tippingConfig}
                  />
                ) : selectedPurpose === 'donation' ? (
                  <DonationPreview title={title} description={description} tippingConfig={tippingConfig} />
                ) : (
                  <PaymentLinkPreview
                    title={title}
                    description={description}
                    amountType={amountType}
                    amount={amount ? parseFloat(amount) : undefined}
                    tippingConfig={tippingConfig}
                    customFields={customFieldsEnabled ? customFields : undefined}
                    redirectEnabled={redirectEnabled}
                    redirectUrl={redirectUrl}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </FullScreenModal>
  )
}
