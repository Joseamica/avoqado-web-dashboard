import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useToast } from '@/hooks/use-toast'
import { getProducts } from '@/services/menu.service'
import referralsService from '@/services/referrals.service'
import type {
  ReferralRewardRecurrence,
  ReferralRewardType,
  TierReward,
  TierRewardInput,
  UpdateReferralConfigRequest,
} from '@/types/referrals'

// ─── Local editable row model ────────────────────────────────────────────────
// Numeric fields are kept as strings while editing so the input can be
// momentarily empty/invalid without fighting the user; parsed + validated on submit.
interface EditableReward {
  localId: string
  rewardType: ReferralRewardType
  recurrence: ReferralRewardRecurrence
  rewardPercent: string
  rewardProductId: string
  rewardQuantity: string
}

let localIdSeq = 0
function nextLocalId(): string {
  localIdSeq += 1
  return `local-${localIdSeq}`
}

/** Prisma `Decimal` serializes as a numeric string (e.g. "20.00") — normalize
 *  to a plain number string ("20") so the edit field isn't cluttered with
 *  trailing zeros the user never typed. */
function normalizePercentString(value: string | number | null | undefined): string {
  if (value == null) return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : String(value)
}

function toEditable(reward: TierReward): EditableReward {
  return {
    localId: nextLocalId(),
    rewardType: reward.rewardType,
    recurrence: reward.recurrence,
    rewardPercent: normalizePercentString(reward.rewardPercent),
    rewardProductId: reward.rewardProductId ?? '',
    rewardQuantity: String(reward.rewardQuantity ?? 1),
  }
}

function defaultEditable(seedPercent?: number): EditableReward {
  return {
    localId: nextLocalId(),
    rewardType: 'PERCENT_COUPON',
    recurrence: 'ONE_TIME',
    rewardPercent: seedPercent != null ? String(seedPercent) : '',
    rewardProductId: '',
    rewardQuantity: '1',
  }
}

interface ProductOption {
  id: string
  name: string
  price?: number | string | null
}

/** Searchable product picker for the FREE_PRODUCT reward rows — mirrors the
 *  pattern in CreditPackForm.tsx's ProductPicker, adapted to plain state
 *  (this editor doesn't use react-hook-form). */
function RewardProductPicker({
  products,
  value,
  onChange,
  placeholder,
  changeLabel,
}: {
  products: ProductOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  changeLabel: string
}) {
  const [search, setSearch] = useState('')
  const selected = useMemo(() => products.find(p => p.id === value) ?? null, [products, value])

  const items = useMemo<SearchComboboxItem[]>(() => {
    const term = search.trim().toLowerCase()
    return products
      .filter(p => !term || p.name.toLowerCase().includes(term))
      .map(p => ({
        id: p.id,
        label: p.name,
        endLabel: p.price != null && Number(p.price) > 0 ? `$${Number(p.price).toFixed(2)}` : undefined,
      }))
  }, [products, search])

  if (selected) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent">
        <span className="text-sm flex-1 truncate">{selected.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => {
            onChange('')
            setSearch('')
          }}
        >
          {changeLabel}
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

export interface TierRewardEditorProps {
  venueId: string
  tierLevel: 1 | 2 | 3
  /** Current threshold for this level (prefilled into the input). */
  initialReferralsRequired?: number
  /** Active TierReward rows already scoped to this level (Task 2/summary already filters — pass as-is or pre-filtered). */
  initialRewards: TierReward[]
  /** Fallback single-percent seed when `initialRewards` is empty (legacy venues never migrated to `tierRewards`). */
  legacyRewardPercent?: number
  /** Previous tier's threshold — this level's threshold must be strictly greater. */
  minReferralsRequired?: number
  /** Next tier's threshold — this level's threshold must be strictly lower. */
  maxReferralsRequired?: number
  onClose: () => void
}

/**
 * Per-tier reward editor (spec D4 "Editar nivel"): edits ONE tier level's
 * referrals-required threshold + its list of rewards, then PATCHes
 * `tier{N}ReferralsRequired` + `tiers` (rows for ONLY this level — the
 * backend's `persistTierRewards` groups incoming `tiers` by `tierLevel` and
 * replaces ONLY the levels present, so other tiers are left untouched).
 */
export default function TierRewardEditor({
  venueId,
  tierLevel,
  initialReferralsRequired,
  initialRewards,
  legacyRewardPercent,
  minReferralsRequired,
  maxReferralsRequired,
  onClose,
}: TierRewardEditorProps) {
  const { t } = useTranslation('referrals')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [referralsRequired, setReferralsRequired] = useState(
    initialReferralsRequired != null ? String(initialReferralsRequired) : '',
  )
  const [rows, setRows] = useState<EditableReward[]>(() =>
    initialRewards.length > 0 ? initialRewards.map(toEditable) : [defaultEditable(legacyRewardPercent)],
  )
  const [formError, setFormError] = useState<string | null>(null)

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', venueId, 'for-referrals-tier-editor'],
    queryFn: () => getProducts(venueId, { orderBy: 'name', includeRecipe: false, includeModifiers: false }),
    enabled: !!venueId,
  })
  const products = (productsData ?? []) as ProductOption[]

  const updateRow = (localId: string, patch: Partial<EditableReward>) => {
    setRows(prev => prev.map(r => (r.localId === localId ? { ...r, ...patch } : r)))
  }

  const addRow = () => setRows(prev => [...prev, defaultEditable()])
  const removeRow = (localId: string) =>
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.localId !== localId) : prev))

  const mutation = useMutation({
    mutationFn: (patch: UpdateReferralConfigRequest) => referralsService.updateConfig(venueId, patch),
    onSuccess: () => {
      toast({ title: t('editor.success') })
      queryClient.invalidateQueries({ queryKey: ['referrals-config', venueId] })
      onClose()
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || t('editor.error')
      setFormError(message)
      toast({ title: tCommon('common.error'), description: message, variant: 'destructive' })
    },
  })

  const handleSubmit = () => {
    setFormError(null)

    const referralsNum = parseInt(referralsRequired, 10)
    if (!Number.isFinite(referralsNum) || referralsNum < 1) {
      setFormError(t('editor.errors.referralsRequired'))
      return
    }
    if (minReferralsRequired != null && referralsNum <= minReferralsRequired) {
      setFormError(t('editor.errors.thresholdTooLow', { min: minReferralsRequired }))
      return
    }
    if (maxReferralsRequired != null && referralsNum >= maxReferralsRequired) {
      setFormError(t('editor.errors.thresholdTooHigh', { max: maxReferralsRequired }))
      return
    }

    if (rows.length === 0) {
      setFormError(t('editor.errors.atLeastOneReward'))
      return
    }

    const tiers: TierRewardInput[] = []
    for (const row of rows) {
      // PERMANENT_DISCOUNT is disabled for NEW selection in the dropdown (TPV
      // can't auto-apply it yet), but a row already in this shape (grandfathered
      // data) must still be editable/saveable — same percent validation as coupon.
      if (row.rewardType === 'PERCENT_COUPON' || row.rewardType === 'PERMANENT_DISCOUNT') {
        const percent = parseFloat(row.rewardPercent)
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          setFormError(t('editor.errors.percentInvalid'))
          return
        }
        tiers.push({ tierLevel, rewardType: row.rewardType, recurrence: 'ONE_TIME', rewardPercent: percent })
        continue
      }

      // FREE_PRODUCT
      if (!row.rewardProductId) {
        setFormError(t('editor.errors.productRequired'))
        return
      }
      const quantity = parseInt(row.rewardQuantity, 10)
      if (!Number.isFinite(quantity) || quantity < 1) {
        setFormError(t('editor.errors.quantityInvalid'))
        return
      }
      tiers.push({
        tierLevel,
        rewardType: 'FREE_PRODUCT',
        recurrence: row.recurrence,
        rewardProductId: row.rewardProductId,
        rewardQuantity: quantity,
      })
    }

    const fieldName = `tier${tierLevel}ReferralsRequired` as const
    mutation.mutate({ [fieldName]: referralsNum, tiers } as UpdateReferralConfigRequest)
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editor.title', { level: tierLevel })}</DialogTitle>
          <DialogDescription>{t('editor.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="editorReferralsRequired" className="text-xs font-medium">
              {t('activate.tierReferralsRequired')}
            </Label>
            <Input
              id="editorReferralsRequired"
              type="number"
              min={1}
              step={1}
              className="h-9 max-w-[160px]"
              value={referralsRequired}
              onChange={e => setReferralsRequired(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.localId} className="rounded-xl border border-input p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('editor.rewardIndex', { index: index + 1 })}
                  </p>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeRow(row.localId)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('editor.rewardType')}</Label>
                  <Select
                    value={row.rewardType}
                    onValueChange={value => updateRow(row.localId, { rewardType: value as ReferralRewardType })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT_COUPON">{t('editor.rewardTypeCoupon')}</SelectItem>
                      <SelectItem value="PERMANENT_DISCOUNT" disabled>
                        <div className="flex flex-col items-start">
                          <span>{t('editor.rewardTypePermanent')}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {t('editor.rewardTypePermanentNote')}
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="FREE_PRODUCT">{t('editor.rewardTypeFreeProduct')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(row.rewardType === 'PERCENT_COUPON' || row.rewardType === 'PERMANENT_DISCOUNT') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{t('activate.tierRewardPercent')}</Label>
                    <div className="relative max-w-[140px]">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className="h-9 pr-8"
                        value={row.rewardPercent}
                        onChange={e => updateRow(row.localId, { rewardPercent: e.target.value })}
                      />
                      <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                )}

                {row.rewardType === 'FREE_PRODUCT' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{t('editor.rewardProduct')}</Label>
                      <RewardProductPicker
                        products={products}
                        value={row.rewardProductId}
                        onChange={id => updateRow(row.localId, { rewardProductId: id })}
                        placeholder={
                          productsLoading ? tCommon('common.loading', { defaultValue: 'Cargando...' }) : t('editor.rewardProductPlaceholder')
                        }
                        changeLabel={tCommon('change', { defaultValue: 'Cambiar' })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('editor.rewardQuantity')}</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          className="h-9"
                          value={row.rewardQuantity}
                          onChange={e => updateRow(row.localId, { rewardQuantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('editor.rewardRecurrence')}</Label>
                        <Select
                          value={row.recurrence}
                          onValueChange={value =>
                            updateRow(row.localId, { recurrence: value as ReferralRewardRecurrence })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONE_TIME">{t('editor.recurrenceOnce')}</SelectItem>
                            <SelectItem value="MONTHLY">{t('editor.recurrenceMonthly')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t('editor.rewardManualHint')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" />
            {t('editor.addReward')}
          </Button>

          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {tCommon('common.cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? t('editor.saving') : t('editor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
