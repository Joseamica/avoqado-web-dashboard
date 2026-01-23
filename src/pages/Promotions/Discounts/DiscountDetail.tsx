import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { PermissionGate } from '@/components/PermissionGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { cn } from '@/lib/utils'
import discountService from '@/services/discount.service'
import type { Discount } from '@/types/discount'
import { DiscountWizard } from '../components/DiscountWizard'
import { useDiscountFormData } from '../hooks/useDiscountFormData'

type TabId = 'general' | 'scope' | 'rules' | 'config'

// Helper component for label:value rows
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? '-'}</p>
    </div>
  )
}

// Boolean badge helper
function BooleanBadge({ value }: { value: boolean }) {
  const { t: tCommon } = useTranslation('common')
  return <Badge variant={value ? 'default' : 'secondary'}>{value ? tCommon('yes') : tCommon('no')}</Badge>
}

// Days of week badges
function DaysOfWeekBadges({ days }: { days?: number[] }) {
  const { t } = useTranslation('promotions')

  if (!days || days.length === 0 || days.length === 7) {
    return <span className="text-muted-foreground">{t('discounts.detail.empty.allDays')}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {days.map(day => (
        <Badge key={day} variant="outline" className="text-xs">
          {t(`discounts.form.days.${day}`)}
        </Badge>
      ))}
    </div>
  )
}

// Format discount value based on type
function formatDiscountValue(discount: Discount, currencySymbol = '$'): string {
  switch (discount.type) {
    case 'PERCENTAGE':
      return `${discount.value}%`
    case 'FIXED_AMOUNT':
      return `${currencySymbol}${discount.value.toFixed(2)}`
    case 'COMP':
      return '100% (Cortesía)'
    default:
      return `${discount.value}`
  }
}

// Format time range
function formatTimeRange(timeFrom?: string, timeUntil?: string, t?: (key: string) => string): string {
  if (!timeFrom && !timeUntil) {
    return t?.('discounts.detail.empty.allDay') || 'Todo el día'
  }
  return `${timeFrom || '00:00'} - ${timeUntil || '23:59'}`
}

// Format date
function formatDate(dateString?: string, t?: (key: string) => string): string {
  if (!dateString) {
    return t?.('discounts.detail.empty.always') || 'Siempre'
  }
  return new Date(dateString).toLocaleDateString()
}

export default function DiscountDetail() {
  const { discountId } = useParams<{ discountId: string }>()
  const navigate = useNavigate()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()

  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [isEditWizardOpen, setIsEditWizardOpen] = useState(false)
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()

  // Fetch discount data
  const { data: discount, isLoading } = useQuery({
    queryKey: ['discount', venueId, discountId],
    queryFn: () => discountService.getDiscount(venueId, discountId!),
    enabled: !!venueId && !!discountId,
  })

  // Set breadcrumb to show discount name instead of ID
  useEffect(() => {
    if (discount?.name && discountId) {
      setCustomSegment(discountId, discount.name)
    }
    return () => {
      if (discountId) {
        clearCustomSegment(discountId)
      }
    }
  }, [discount?.name, discountId, setCustomSegment, clearCustomSegment])

  // Fetch form data for product/category names
  const { productOptions, categoryOptions, customerGroupOptions, dayOptions } = useDiscountFormData(venueId)

  // Map IDs to names
  const productNamesMap = useMemo(() => {
    const map = new Map<string, string>()
    productOptions.forEach((p: { value: string; label: string }) => map.set(p.value, p.label))
    return map
  }, [productOptions])

  const categoryNamesMap = useMemo(() => {
    const map = new Map<string, string>()
    categoryOptions.forEach((c: { value: string; label: string }) => map.set(c.value, c.label))
    return map
  }, [categoryOptions])

  const customerGroupNamesMap = useMemo(() => {
    const map = new Map<string, string>()
    customerGroupOptions.forEach((g: { value: string; label: string }) => map.set(g.value, g.label))
    return map
  }, [customerGroupOptions])

  // Tabs configuration
  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: t('discounts.detail.tabs.general') },
    { id: 'scope', label: t('discounts.detail.tabs.scope') },
    { id: 'rules', label: t('discounts.detail.tabs.rules') },
    { id: 'config', label: t('discounts.detail.tabs.config') },
  ]

  const handleEditSuccess = () => {
    setIsEditWizardOpen(false)
    queryClient.invalidateQueries({ queryKey: ['discount', venueId, discountId] })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!discount) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">{t('discounts.detail.notFound')}</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          <ChevronLeft className="mr-2 h-4 w-4" />
          {tCommon('back')}
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">{discount.name}</h1>
            <Badge variant={discount.active ? 'default' : 'secondary'}>
              {discount.active ? t('discounts.status.active') : t('discounts.status.inactive')}
            </Badge>
            <Badge variant="outline">{t(`discounts.form.types.${discount.type}`)}</Badge>
          </div>
          <PermissionGate permission="discounts:update">
            <Button onClick={() => setIsEditWizardOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {tCommon('edit')}
            </Button>
          </PermissionGate>
        </div>

        {/* Horizontal Tabs (pill-style) */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'general' && <GeneralTab discount={discount} t={t} />}
        {activeTab === 'scope' && (
          <ScopeTab
            discount={discount}
            t={t}
            productNamesMap={productNamesMap}
            categoryNamesMap={categoryNamesMap}
            customerGroupNamesMap={customerGroupNamesMap}
          />
        )}
        {activeTab === 'rules' && <RulesTab discount={discount} t={t} />}
        {activeTab === 'config' && <ConfigTab discount={discount} t={t} />}
      </div>

      {/* Edit Wizard Dialog */}
      <DiscountWizard
        open={isEditWizardOpen}
        onOpenChange={setIsEditWizardOpen}
        venueId={venueId}
        editDiscount={discount}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}

// ==================== TAB COMPONENTS ====================

interface TabProps {
  discount: Discount
  t: (key: string) => string
}

function GeneralTab({ discount, t }: TabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('discounts.detail.sections.basicInfo')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-6">
        <InfoRow label={t('discounts.form.fields.name')} value={discount.name} />
        <InfoRow label={t('discounts.form.fields.description')} value={discount.description || '-'} />
        <InfoRow
          label={t('discounts.form.fields.type')}
          value={<Badge variant="outline">{t(`discounts.form.types.${discount.type}`)}</Badge>}
        />
        <InfoRow label={t('discounts.form.fields.value')} value={formatDiscountValue(discount)} />
      </CardContent>
    </Card>
  )
}

interface ScopeTabProps extends TabProps {
  productNamesMap: Map<string, string>
  categoryNamesMap: Map<string, string>
  customerGroupNamesMap: Map<string, string>
}

function ScopeTab({ discount, t, productNamesMap, categoryNamesMap, customerGroupNamesMap }: ScopeTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.detail.sections.scope')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <InfoRow
            label={t('discounts.form.fields.scope')}
            value={<Badge variant="outline">{t(`discounts.form.scopes.${discount.scope}`)}</Badge>}
          />

          {/* Target Products */}
          {discount.scope === 'ITEM' && discount.targetItemIds && discount.targetItemIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('discounts.detail.fields.targetProducts')}</p>
              <div className="flex flex-wrap gap-2">
                {discount.targetItemIds.map(id => (
                  <Badge key={id} variant="secondary">
                    {productNamesMap.get(id) || id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Target Categories */}
          {discount.scope === 'CATEGORY' && discount.targetCategoryIds && discount.targetCategoryIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('discounts.detail.fields.targetCategories')}</p>
              <div className="flex flex-wrap gap-2">
                {discount.targetCategoryIds.map(id => (
                  <Badge key={id} variant="secondary">
                    {categoryNamesMap.get(id) || id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Customer Group */}
          {discount.scope === 'CUSTOMER_GROUP' && discount.customerGroupId && (
            <InfoRow
              label={t('discounts.form.fields.customerGroup')}
              value={<Badge variant="secondary">{customerGroupNamesMap.get(discount.customerGroupId) || discount.customerGroupId}</Badge>}
            />
          )}

          {/* BOGO Configuration */}
          {discount.scope === 'QUANTITY' && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <p className="font-medium">{t('discounts.bogo.title')}</p>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label={t('discounts.bogo.buyQuantity')} value={discount.buyQuantity} />
                <InfoRow label={t('discounts.bogo.getQuantity')} value={discount.getQuantity} />
                <InfoRow
                  label={t('discounts.bogo.getDiscount')}
                  value={`${discount.getDiscountPercent}%${discount.getDiscountPercent === 100 ? ' (GRATIS)' : ''}`}
                />
              </div>
              {discount.buyItemIds && discount.buyItemIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('discounts.bogo.buyFrom')}</p>
                  <div className="flex flex-wrap gap-2">
                    {discount.buyItemIds.map(id => (
                      <Badge key={id} variant="secondary">
                        {productNamesMap.get(id) || id}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {discount.getItemIds && discount.getItemIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('discounts.bogo.getFrom')}</p>
                  <div className="flex flex-wrap gap-2">
                    {discount.getItemIds.map(id => (
                      <Badge key={id} variant="secondary">
                        {productNamesMap.get(id) || id}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RulesTab({ discount, t }: TabProps) {
  return (
    <div className="space-y-4">
      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.detail.sections.usageLimits')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <InfoRow
            label={t('discounts.form.fields.minPurchaseAmount')}
            value={discount.minPurchaseAmount ? `$${discount.minPurchaseAmount.toFixed(2)}` : t('discounts.detail.empty.noLimit')}
          />
          <InfoRow
            label={t('discounts.form.fields.maxDiscountAmount')}
            value={discount.maxDiscountAmount ? `$${discount.maxDiscountAmount.toFixed(2)}` : t('discounts.detail.empty.noLimit')}
          />
          <InfoRow
            label={t('discounts.form.fields.maxTotalUses')}
            value={discount.maxTotalUses ? `${discount.currentUses} / ${discount.maxTotalUses}` : `${discount.currentUses} / ∞`}
          />
          <InfoRow
            label={t('discounts.form.fields.maxUsesPerCustomer')}
            value={discount.maxUsesPerCustomer || t('discounts.detail.empty.noLimit')}
          />
        </CardContent>
      </Card>

      {/* Time Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.detail.sections.timeRestrictions')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <InfoRow label={t('discounts.form.fields.validFrom')} value={formatDate(discount.validFrom, t)} />
          <InfoRow label={t('discounts.form.fields.validUntil')} value={formatDate(discount.validUntil, t)} />
          <InfoRow label={t('discounts.form.fields.daysOfWeek')} value={<DaysOfWeekBadges days={discount.daysOfWeek} />} />
          <InfoRow label={t('discounts.detail.fields.timeRange')} value={formatTimeRange(discount.timeFrom, discount.timeUntil, t)} />
        </CardContent>
      </Card>
    </div>
  )
}

function ConfigTab({ discount, t }: TabProps) {
  const { t: _tCommon } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('discounts.detail.sections.advanced')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-6">
        <InfoRow label={t('discounts.form.fields.isAutomatic')} value={<BooleanBadge value={discount.isAutomatic} />} />
        <InfoRow label={t('discounts.form.fields.priority')} value={discount.priority} />
        <InfoRow label={t('discounts.form.fields.isStackable')} value={<BooleanBadge value={discount.isStackable} />} />
        <InfoRow label={t('discounts.form.fields.applyBeforeTax')} value={<BooleanBadge value={discount.applyBeforeTax} />} />
        {discount.type === 'COMP' && (
          <>
            <InfoRow
              label={t('discounts.form.fields.requiresApproval')}
              value={<BooleanBadge value={discount.requiresApproval || false} />}
            />
            <InfoRow label={t('discounts.form.fields.compReason')} value={discount.compReason || '-'} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
