import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useCreateCommissionTier, useUpdateCommissionTier } from '@/hooks/useCommissions'
import type { CommissionTier, TierPeriod, TierType, ThresholdType } from '@/types/commission'
import { zodResolver } from '@hookform/resolvers/zod'
import { Target } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

const tierTypes: TierType[] = ['BY_QUANTITY', 'BY_AMOUNT']
const tierPeriods: TierPeriod[] = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']

const createTierSchema = z.object({
  tierLevel: z.number().min(1, 'Tier level must be at least 1'),
  tierName: z.string().min(1, 'Tier name is required'),
  tierType: z.enum(['BY_QUANTITY', 'BY_AMOUNT']),
  minThreshold: z.number().min(0, 'Minimum threshold must be >= 0'),
  maxThreshold: z.number().nullable(),
  minThresholdType: z.enum(['FIXED', 'STAFF_GOAL']),
  maxThresholdType: z.enum(['FIXED', 'STAFF_GOAL']),
  rate: z.number().min(0, 'Rate must be >= 0').max(100, 'Rate must be <= 100'),
  tierPeriod: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  active: z.boolean(),
})

type TierFormData = z.infer<typeof createTierSchema>

interface CreateTierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configId: string
  tier?: CommissionTier | null
  nextLevel: number
}

export default function CreateTierDialog({ open, onOpenChange, configId, tier, nextLevel }: CreateTierDialogProps) {
  const { t } = useTranslation('commissions')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()

  const isEditing = !!tier

  const createTierMutation = useCreateCommissionTier(configId)
  const updateTierMutation = useUpdateCommissionTier(configId)

  const form = useForm<TierFormData>({
    resolver: zodResolver(createTierSchema),
    defaultValues: {
      tierLevel: tier?.tierLevel || nextLevel,
      tierName: tier?.tierName || '',
      tierType: tier?.tierType || 'BY_AMOUNT',
      minThreshold: tier?.minThreshold || 0,
      maxThreshold: tier?.maxThreshold || null,
      minThresholdType: (tier?.minThresholdType as ThresholdType) || 'FIXED',
      maxThresholdType: (tier?.maxThresholdType as ThresholdType) || 'FIXED',
      rate: tier ? tier.rate * 100 : 0,
      tierPeriod: tier?.tierPeriod || 'MONTHLY',
      active: tier?.active ?? true,
    },
  })

  // Reset form when tier changes
  useEffect(() => {
    if (open) {
      form.reset({
        tierLevel: tier?.tierLevel || nextLevel,
        tierName: tier?.tierName || '',
        tierType: tier?.tierType || 'BY_AMOUNT',
        minThreshold: tier?.minThreshold || 0,
        maxThreshold: tier?.maxThreshold || null,
        minThresholdType: (tier?.minThresholdType as ThresholdType) || 'FIXED',
        maxThresholdType: (tier?.maxThresholdType as ThresholdType) || 'FIXED',
        rate: tier ? tier.rate * 100 : 0,
        tierPeriod: tier?.tierPeriod || 'MONTHLY',
        active: tier?.active ?? true,
      })
    }
  }, [open, tier, nextLevel, form])

  const onSubmit = async (data: TierFormData) => {
    try {
      const payload = {
        tierLevel: data.tierLevel,
        name: data.tierName,
        tierType: data.tierType,
        minThreshold: data.minThreshold,
        maxThreshold: data.maxThreshold,
        minThresholdType: data.minThresholdType,
        maxThresholdType: data.maxThresholdType,
        rate: data.rate / 100, // Convert percentage to decimal
        period: data.tierPeriod,
        active: data.active,
      }

      if (isEditing && tier) {
        await updateTierMutation.mutateAsync({
          tierId: tier.id,
          data: payload,
        })
        toast({
          title: t('success.tierUpdated'),
        })
      } else {
        await createTierMutation.mutateAsync(payload)
        toast({
          title: t('success.tierCreated'),
        })
      }

      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: isEditing ? t('errors.updateError') : t('errors.createError'),
        description: error.response?.data?.message || tCommon('common.error'),
        variant: 'destructive',
      })
    }
  }

  const isPending = createTierMutation.isPending || updateTierMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('tiers.edit') : t('tiers.create')}</DialogTitle>
          <DialogDescription>{isEditing ? t('tiers.editDescription') : t('tiers.createDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Level and Name */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="tierLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tiers.level')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => {
                          const raw = e.target.value
                          field.onChange(raw === '' ? (undefined as unknown as number) : parseInt(raw))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tierName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('tiers.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('tiers.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Type and Period */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tierType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tiers.type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tierTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {t(`tierTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tierPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tiers.period')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tierPeriods.map(period => (
                          <SelectItem key={period} value={period}>
                            {t(`tierPeriods.${period}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minThreshold"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('tiers.minThreshold')}</FormLabel>
                      <button
                        type="button"
                        onClick={() => {
                          const current = form.getValues('minThresholdType')
                          form.setValue('minThresholdType', current === 'STAFF_GOAL' ? 'FIXED' : 'STAFF_GOAL')
                        }}
                        aria-label={
                          form.watch('minThresholdType') === 'STAFF_GOAL'
                            ? t('wizard.advanced.tiers.useFixedBoundary')
                            : t('wizard.advanced.tiers.useGoalBoundary')
                        }
                        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-primary leading-none transition-colors hover:bg-primary/10"
                      >
                        <Target className="h-3 w-3 shrink-0" />
                        {form.watch('minThresholdType') === 'STAFF_GOAL'
                          ? t('wizard.advanced.tiers.boundaryFixed')
                          : t('wizard.advanced.tiers.boundaryGoalShort')}
                      </button>
                    </div>
                    <FormControl>
                      {form.watch('minThresholdType') === 'STAFF_GOAL' ? (
                        <Badge variant="secondary" className="flex items-center gap-1.5 h-9 text-xs font-normal px-3 rounded-md w-full justify-start">
                          <Target className="w-3.5 h-3.5 shrink-0" />
                          {t('wizard.advanced.tiers.boundaryGoal')}
                        </Badge>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          {...field}
                          value={field.value ?? ''}
                          onChange={e => {
                            const raw = e.target.value
                            field.onChange(raw === '' ? (undefined as unknown as number) : parseFloat(raw))
                          }}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxThreshold"
                render={({ field: maxField }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('tiers.maxThreshold')}</FormLabel>
                      <button
                        type="button"
                        onClick={() => {
                          const current = form.getValues('maxThresholdType')
                          form.setValue('maxThresholdType', current === 'STAFF_GOAL' ? 'FIXED' : 'STAFF_GOAL')
                        }}
                        aria-label={
                          form.watch('maxThresholdType') === 'STAFF_GOAL'
                            ? t('wizard.advanced.tiers.useFixedBoundary')
                            : t('wizard.advanced.tiers.useGoalBoundary')
                        }
                        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-primary leading-none transition-colors hover:bg-primary/10"
                      >
                        <Target className="h-3 w-3 shrink-0" />
                        {form.watch('maxThresholdType') === 'STAFF_GOAL'
                          ? t('wizard.advanced.tiers.boundaryFixed')
                          : t('wizard.advanced.tiers.boundaryGoalShort')}
                      </button>
                    </div>
                    <FormControl>
                      {form.watch('maxThresholdType') === 'STAFF_GOAL' ? (
                        <Badge variant="secondary" className="flex items-center gap-1.5 h-9 text-xs font-normal px-3 rounded-md w-full justify-start">
                          <Target className="w-3.5 h-3.5 shrink-0" />
                          {t('wizard.advanced.tiers.boundaryGoal')}
                        </Badge>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={t('tiers.unlimited')}
                          value={maxField.value ?? ''}
                          onChange={e => {
                            const value = e.target.value
                            maxField.onChange(value === '' ? null : parseFloat(value))
                          }}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Rate */}
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tiers.rate')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        className="pr-8"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active Toggle */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('tiers.active')}</FormLabel>
                    <p className="text-sm text-muted-foreground">{t('tiers.activeDescription')}</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon('common.saving') : isEditing ? t('actions.save') : t('actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
