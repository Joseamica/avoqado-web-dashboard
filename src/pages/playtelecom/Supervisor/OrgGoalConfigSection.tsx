/**
 * OrgGoalConfigSection - Organization-level sales goal defaults
 *
 * Shows org-level goals with CRUD. Gated behind goals:org-manage permission.
 * Available to OWNER role (and any role granted goals:org-manage).
 */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Building2, Loader2 } from 'lucide-react'
import { useOrgGoals, useCreateOrgGoal, useUpdateOrgGoal, useDeleteOrgGoal } from '@/hooks/useStoresAnalysis'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { OrgGoal } from '@/services/storesAnalysis.service'

const orgGoalSchema = z.object({
  goal: z.number().min(1, 'La meta debe ser mayor a 0'),
  goalType: z.enum(['AMOUNT', 'QUANTITY'] as const),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'] as const),
})

type OrgGoalFormData = z.infer<typeof orgGoalSchema>

export default function OrgGoalConfigSection() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { can } = useAccess()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<OrgGoal | null>(null)

  const { data: orgGoals, isLoading } = useOrgGoals({ enabled: can('goals:org-manage') })
  const createMutation = useCreateOrgGoal()
  const updateMutation = useUpdateOrgGoal()
  const deleteMutation = useDeleteOrgGoal()

  const form = useForm<OrgGoalFormData>({
    resolver: zodResolver(orgGoalSchema),
    defaultValues: {
      goal: 15000,
      goalType: 'AMOUNT',
      period: 'MONTHLY',
    },
  })

  const watchGoalType = form.watch('goalType')

  const handleOpenCreate = useCallback(() => {
    setEditingGoal(null)
    form.reset({ goal: 15000, goalType: 'AMOUNT', period: 'MONTHLY' })
    setDialogOpen(true)
  }, [form])

  const handleOpenEdit = useCallback(
    (goal: OrgGoal) => {
      setEditingGoal(goal)
      form.reset({ goal: goal.goal, goalType: goal.goalType, period: goal.period })
      setDialogOpen(true)
    },
    [form],
  )

  const handleDelete = useCallback(
    async (goalId: string) => {
      try {
        await deleteMutation.mutateAsync(goalId)
        toast({ title: t('playtelecom:supervisor.orgGoals.deleteSuccess') })
      } catch {
        toast({ title: t('playtelecom:supervisor.orgGoals.error'), variant: 'destructive' })
      }
    },
    [deleteMutation, toast, t],
  )

  const onSubmit = async (data: OrgGoalFormData) => {
    try {
      if (editingGoal) {
        await updateMutation.mutateAsync({
          goalId: editingGoal.id,
          data: { goal: data.goal, goalType: data.goalType, period: data.period },
        })
      } else {
        await createMutation.mutateAsync({ goal: data.goal, goalType: data.goalType, period: data.period })
      }
      toast({ title: t('playtelecom:supervisor.orgGoals.success') })
      setDialogOpen(false)
    } catch {
      toast({ title: t('playtelecom:supervisor.orgGoals.error'), variant: 'destructive' })
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  const activeGoals = useMemo(() => (orgGoals ?? []).filter(g => g.active), [orgGoals])

  if (!can('goals:org-manage')) return null

  const formatGoalValue = (goal: OrgGoal) => {
    if (goal.goalType === 'QUANTITY') return `${goal.goal} ventas`
    return `$${goal.goal.toLocaleString()}`
  }

  const periodLabel = (period: string) => t(`playtelecom:supervisor.goalDialog.periods.${period}`, { defaultValue: period })

  return (
    <>
      <GlassCard className="p-5 border-purple-500/20 bg-purple-500/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-500" />
            <h4 className="text-xs font-bold text-muted-foreground uppercase">
              {t('playtelecom:supervisor.orgGoals.title')}
            </h4>
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-purple-500 hover:text-purple-400 hover:bg-purple-500/10" onClick={handleOpenCreate}>
            <Plus className="w-3 h-3 mr-1" />
            {t('playtelecom:supervisor.goalDialog.createGoal')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t('playtelecom:supervisor.orgGoals.description')}</p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activeGoals.length > 0 ? (
          <div className="space-y-2">
            {activeGoals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2 border border-border/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-500">
                    {t('playtelecom:supervisor.orgGoals.source.organization')}
                  </Badge>
                  <span className="text-sm font-bold">{formatGoalValue(goal)}</span>
                  <span className="text-xs text-muted-foreground">{periodLabel(goal.period)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenEdit(goal)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(goal.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">{t('playtelecom:supervisor.orgGoals.empty')}</p>
            <p className="text-xs mt-1">{t('playtelecom:supervisor.orgGoals.emptyDescription')}</p>
          </div>
        )}
      </GlassCard>

      {/* Create/Edit Org Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? t('playtelecom:supervisor.orgGoals.editTitle') : t('playtelecom:supervisor.orgGoals.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('playtelecom:supervisor.orgGoals.description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <SelectItem value="AMOUNT">{t('playtelecom:supervisor.goalDialog.goalTypes.AMOUNT', { defaultValue: 'Monto ($)' })}</SelectItem>
                        <SelectItem value="QUANTITY">{t('playtelecom:supervisor.goalDialog.goalTypes.QUANTITY', { defaultValue: 'Cantidad de ventas' })}</SelectItem>
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
                        {watchGoalType !== 'QUANTITY' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>}
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
                        <SelectItem value="DAILY">{t('playtelecom:supervisor.goalDialog.periods.DAILY', { defaultValue: 'Diario' })}</SelectItem>
                        <SelectItem value="WEEKLY">{t('playtelecom:supervisor.goalDialog.periods.WEEKLY', { defaultValue: 'Semanal' })}</SelectItem>
                        <SelectItem value="MONTHLY">{t('playtelecom:supervisor.goalDialog.periods.MONTHLY', { defaultValue: 'Mensual' })}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('playtelecom:supervisor.goalDialog.cancel', { defaultValue: 'Cancelar' })}
                </Button>
                <Button type="submit" disabled={isMutating}>
                  {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('playtelecom:supervisor.goalDialog.save', { defaultValue: 'Guardar' })}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
