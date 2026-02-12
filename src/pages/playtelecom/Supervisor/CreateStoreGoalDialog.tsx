import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateStoreGoal, useUpdateStoreGoal } from '@/hooks/useStoresAnalysis'
import { useToast } from '@/hooks/use-toast'

const goalSchema = z.object({
  storeId: z.string().min(1, 'La tienda es requerida'),
  goal: z.number().min(1, 'La meta debe ser mayor a 0'),
  goalType: z.enum(['AMOUNT', 'QUANTITY'] as const),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'] as const),
})

type GoalFormData = z.infer<typeof goalSchema>

interface StoreOption {
  id: string
  name: string
}

interface CreateStoreGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stores: StoreOption[]
  /** Pre-selected store ID (when clicking a specific store) */
  selectedStoreId?: string | null
  /** Goal ID when editing an existing goal */
  editGoalId?: string | null
  /** Current goal amount when editing */
  editGoalAmount?: number
  /** Current goal type when editing */
  editGoalType?: 'AMOUNT' | 'QUANTITY'
  /** Current goal period when editing */
  editGoalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

export default function CreateStoreGoalDialog({
  open,
  onOpenChange,
  stores,
  selectedStoreId,
  editGoalId,
  editGoalAmount,
  editGoalType,
  editGoalPeriod,
}: CreateStoreGoalDialogProps) {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { toast } = useToast()

  const isEditing = !!editGoalId
  const createMutation = useCreateStoreGoal()
  const updateMutation = useUpdateStoreGoal()

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      storeId: selectedStoreId || '',
      goal: editGoalAmount || 15000,
      goalType: editGoalType || 'AMOUNT',
      period: editGoalPeriod || 'DAILY',
    },
  })

  const watchGoalType = form.watch('goalType')

  useEffect(() => {
    if (open) {
      form.reset({
        storeId: selectedStoreId || '',
        goal: editGoalAmount || (editGoalType === 'QUANTITY' ? 50 : 15000),
        goalType: editGoalType || 'AMOUNT',
        period: editGoalPeriod || 'DAILY',
      })
    }
  }, [open, selectedStoreId, editGoalAmount, editGoalType, editGoalPeriod, form])

  const onSubmit = async (data: GoalFormData) => {
    try {
      if (isEditing && editGoalId) {
        await updateMutation.mutateAsync({
          storeId: data.storeId,
          goalId: editGoalId,
          data: { goal: data.goal, goalType: data.goalType, period: data.period },
        })
        toast({ title: t('playtelecom:supervisor.goalDialog.success') })
      } else {
        await createMutation.mutateAsync({
          storeId: data.storeId,
          data: { staffId: null, goal: data.goal, goalType: data.goalType, period: data.period },
        })
        toast({ title: t('playtelecom:supervisor.goalDialog.success') })
      }
      onOpenChange(false)
    } catch (_error) {
      toast({
        title: t('playtelecom:supervisor.goalDialog.error'),
        variant: 'destructive',
      })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('playtelecom:supervisor.goalDialog.editTitle', { defaultValue: 'Editar Meta' })
              : t('playtelecom:supervisor.goalDialog.createTitle', { defaultValue: 'Crear Meta de Venta' })}
          </DialogTitle>
          <DialogDescription>
            {t('playtelecom:supervisor.goalDialog.description', { defaultValue: 'Establece una meta de venta para la tienda' })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Store Selector */}
            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('playtelecom:supervisor.goalDialog.store', { defaultValue: 'Tienda' })}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('playtelecom:supervisor.goalDialog.selectStore', { defaultValue: 'Seleccionar tienda...' })}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stores.map(store => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Goal Type */}
            <FormField
              control={form.control}
              name="goalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('playtelecom:supervisor.goalDialog.goalType', { defaultValue: 'Tipo de meta' })}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AMOUNT">
                        {t('playtelecom:supervisor.goalDialog.goalTypes.AMOUNT', { defaultValue: 'Monto ($)' })}
                      </SelectItem>
                      <SelectItem value="QUANTITY">
                        {t('playtelecom:supervisor.goalDialog.goalTypes.QUANTITY', { defaultValue: 'Cantidad de ventas' })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Goal Value */}
            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {watchGoalType === 'QUANTITY'
                      ? t('playtelecom:supervisor.goalDialog.goalQuantity', { defaultValue: 'Meta de ventas (unidades)' })
                      : t('playtelecom:supervisor.goalDialog.goalAmount', { defaultValue: 'Meta de venta ($)' })}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      {watchGoalType !== 'QUANTITY' && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      )}
                      <Input
                        type="number"
                        className={watchGoalType !== 'QUANTITY' ? 'pl-7' : ''}
                        placeholder={watchGoalType === 'QUANTITY' ? '50' : '15000'}
                        {...field}
                        onChange={e => {
                          const v = e.target.value
                          field.onChange(v === '' ? '' : parseFloat(v) || 0)
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Period */}
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('playtelecom:supervisor.goalDialog.period', { defaultValue: 'Periodo' })}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DAILY">
                        {t('playtelecom:supervisor.goalDialog.periods.DAILY', { defaultValue: 'Diario' })}
                      </SelectItem>
                      <SelectItem value="WEEKLY">
                        {t('playtelecom:supervisor.goalDialog.periods.WEEKLY', { defaultValue: 'Semanal' })}
                      </SelectItem>
                      <SelectItem value="MONTHLY">
                        {t('playtelecom:supervisor.goalDialog.periods.MONTHLY', { defaultValue: 'Mensual' })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('playtelecom:supervisor.goalDialog.cancel', { defaultValue: 'Cancelar' })}
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-500">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('playtelecom:supervisor.goalDialog.save', { defaultValue: 'Guardar' })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
