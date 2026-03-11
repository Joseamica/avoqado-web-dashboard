import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Calendar, ChevronDown, DollarSign, FileText, Heart, Settings, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import paymentLinkService from '@/services/paymentLink.service'
import type { CreatePaymentLinkRequest } from '@/services/paymentLink.service'
import type { Product } from '@/types'

import { ItemFormSection } from './components/ItemFormSection'
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

export default function CreatePaymentLinkDialog({
  open,
  onClose,
  editingLinkId,
}: CreatePaymentLinkDialogProps) {
  const { venueId } = useCurrentVenue()
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [customFields, setCustomFields] = useState(false)
  const [tips, setTips] = useState(false)
  const [purposeDropdownOpen, setPurposeDropdownOpen] = useState(false)

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
      setStep('details')
      // Infer purpose from existing data
      if (link.amountType === 'OPEN' && !link.isReusable) setSelectedPurpose('donation')
      else setSelectedPurpose('payment')
    }
  }, [existingLink])

  // Reset form state whenever the dialog opens (for new links) or closes
  useEffect(() => {
    if (open && !isEditing) {
      // Reset all form state when opening a fresh create dialog
      setTitle('')
      setDescription('')
      setAmountType('FIXED')
      setAmount('')
      setIsReusable(false)
      setRedirectUrl('')
      setRedirectEnabled(false)
      setSelectedProduct(null)
      setCustomFields(false)
      setTips(false)
      setPurposeDropdownOpen(false)
      setStep('type')
      setSelectedPurpose(null)
    }
    if (!open) {
      setStep(isEditing ? 'details' : 'type')
      setSelectedPurpose(null)
      setPurposeDropdownOpen(false)
    }
  }, [open, isEditing])

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
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreatePaymentLinkRequest) =>
      paymentLinkService.updatePaymentLink(venueId, editingLinkId!, data),
    onSuccess: () => {
      toast({ title: t('toasts.updated') })
      queryClient.invalidateQueries({ queryKey: ['payment-links', venueId] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const handleSave = () => {
    // For item purpose, use product data
    const effectiveTitle = selectedPurpose === 'item' && selectedProduct ? selectedProduct.name : title.trim()
    const effectiveAmount = selectedPurpose === 'item' && selectedProduct ? selectedProduct.price : (amount ? parseFloat(amount) : undefined)
    const effectiveDescription = selectedPurpose === 'item' && selectedProduct ? (selectedProduct.description || '') : description.trim()

    if (!effectiveTitle) return

    const data: CreatePaymentLinkRequest = {
      title: effectiveTitle,
      description: effectiveDescription || undefined,
      amountType,
      ...(amountType === 'FIXED' && effectiveAmount ? { amount: effectiveAmount } : {}),
      isReusable,
      ...((redirectEnabled && redirectUrl.trim()) ? { redirectUrl: redirectUrl.trim() } : {}),
    }

    setIsSaving(true)
    if (isEditing) {
      updateMutation.mutate(data, { onSettled: () => setIsSaving(false) })
    } else {
      createMutation.mutate(data, { onSettled: () => setIsSaving(false) })
    }
  }

  const canSave = selectedPurpose === 'item'
    ? !!selectedProduct
    : title.trim().length > 0 && (amountType === 'OPEN' || (amountType === 'FIXED' && parseFloat(amount) > 0))

  const handleClose = () => {
    if (step === 'details' && !isEditing) {
      setStep('type')
    } else {
      onClose()
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={
        step === 'type'
          ? t('form.createTitle')
          : isEditing
            ? t('form.editTitle')
            : t('form.createTitle')
      }
      contentClassName="bg-muted/30"
      actions={
        step === 'details' ? (
          <div className="flex items-center gap-2">
            {isEditing && existingLink?.data && (
              <ShareActions
                shortCode={existingLink.data.shortCode}
                title={existingLink.data.title}
                asDropdown
              />
            )}
            <Button onClick={handleSave} disabled={!canSave || isSaving} className="cursor-pointer">
              {t('form.save')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {step === 'type' ? (
        /* ─── Step 1: Purpose Selection (Square-style) ──────── */
        <div className="mx-auto max-w-6xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left: Type list */}
            <div className="lg:col-span-2 space-y-3">
              {PURPOSES.map(({ key, icon: Icon, comingSoon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePurposeSelect(key)}
                  disabled={comingSoon}
                  className={`relative w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                    comingSoon
                      ? 'opacity-50 cursor-not-allowed border-border'
                      : selectedPurpose === key
                        ? 'border-foreground shadow-sm bg-card cursor-pointer'
                        : 'border-border hover:border-foreground/30 hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
                    <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[15px]">
                        {t(`wizard.${key}Title`)}
                      </h3>
                      {comingSoon && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {tCommon('common.comingSoon', 'Muy pronto')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t(`wizard.${key}Description`)}
                    </p>
                  </div>
                </button>
              ))}

              <div className="pt-4">
                <Button
                  onClick={handleContinue}
                  disabled={!selectedPurpose}
                  className="cursor-pointer"
                >
                  {t('wizard.continue')}
                </Button>
              </div>
            </div>

            {/* Right: Live preview */}
            <div className="lg:col-span-3">
              <div className="sticky top-24">
                <PaymentLinkPreview
                  title={title || t('form.titlePlaceholder')}
                  description={description}
                  amountType={selectedPurpose === 'donation' ? 'OPEN' : 'FIXED'}
                  amount={undefined}
                />
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
                    {selectedPurpose && (() => {
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
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${purposeDropdownOpen ? 'rotate-180' : ''}`} />
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
                  selectedProduct={selectedProduct}
                  onProductSelect={product => {
                    setSelectedProduct(product)
                    setTitle(product.name)
                    setAmount(String(product.price))
                    setAmountType('FIXED')
                  }}
                  customFields={customFields}
                  onCustomFieldsChange={setCustomFields}
                  tips={tips}
                  onTipsChange={setTips}
                  redirectUrl={redirectUrl}
                  onRedirectUrlChange={setRedirectUrl}
                  redirectEnabled={redirectEnabled}
                  onRedirectEnabledChange={setRedirectEnabled}
                />
              ) : (
                /* Default payment/donation form */
                <>
                  {/* Details card */}
                  <div className="rounded-xl border border-input bg-card p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {t('form.details')}
                    </div>

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
                  </div>

                  {/* Amount card */}
                  <div className="rounded-xl border border-input bg-card p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      {t('form.amount')}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('form.amountType')}</Label>
                      <div className="flex rounded-lg border border-input bg-muted/50 p-1">
                        <button
                          type="button"
                          onClick={() => setAmountType('FIXED')}
                          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            amountType === 'FIXED'
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t('form.fixed')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountType('OPEN')}
                          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            amountType === 'OPEN'
                              ? 'bg-card text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {t('form.open')}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {amountType === 'FIXED' ? t('form.fixedHint') : t('form.openHint')}
                      </p>
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
                  </div>

                  {/* Settings card */}
                  <div className="rounded-xl border border-input bg-card p-6 space-y-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Settings className="h-4 w-4" />
                      {t('form.settings')}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t('form.reusable')}</Label>
                        <p className="text-xs text-muted-foreground">
                          {isReusable ? t('form.reusableHint') : t('form.singleUse')}
                        </p>
                      </div>
                      <Switch
                        checked={isReusable}
                        onCheckedChange={setIsReusable}
                        className="cursor-pointer"
                      />
                    </div>

                    <div className="border-t border-input pt-4 space-y-2">
                      <Label htmlFor="pl-redirect">{t('form.redirectUrl')}</Label>
                      <Input
                        id="pl-redirect"
                        type="url"
                        value={redirectUrl}
                        onChange={e => setRedirectUrl(e.target.value)}
                        placeholder={t('form.redirectUrlPlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('form.redirectUrlHint')}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Preview (3 cols) */}
            <div className="lg:col-span-3">
              <div className="sticky top-24">
                {selectedPurpose === 'item' ? (
                  <ItemPreview
                    product={selectedProduct}
                    redirectEnabled={redirectEnabled}
                    redirectUrl={redirectUrl}
                    customFieldsEnabled={customFields}
                  />
                ) : (
                  <PaymentLinkPreview
                    title={title}
                    description={description}
                    amountType={amountType}
                    amount={amount ? parseFloat(amount) : undefined}
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
