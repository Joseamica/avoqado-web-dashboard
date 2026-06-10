// src/pages/Settings/Billing/components/SuperadminPlanControl.tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Crown, ShieldCheck } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import type { PlanState } from '@/services/features.service'

// Lazy load superadmin service — same pattern as Subscriptions.tsx (only loaded when
// a superadmin actually triggers an action; the panel itself is superadmin-gated).
const loadSuperadminService = () => import('@/services/superadmin.service')

const GRADIENT_BTN =
  'bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0'

const TIER_LABEL: Record<string, string> = {
  GRATIS: 'Free',
  FREE: 'Free',
  PRO: 'Pro',
  PREMIUM: 'Premium',
  ENTERPRISE: 'Enterprise',
}

export interface SuperadminPlanControlProps {
  venueId: string
  venueName?: string
  planState: PlanState | undefined
}

/**
 * Superadmin-only base-plan administration for ONE venue, rendered inside the
 * SuperadminFeatureControl collapsible: current tier/grandfathered/trial state,
 * grandfathered toggle, permanent COMP plan assignment, and plan-trial grants.
 * Hardcoded Spanish (superadmin screens are i18n-exempt).
 */
export function SuperadminPlanControl({ venueId, venueName, planState }: SuperadminPlanControlProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  const venueLabel = venueName || 'este venue'
  const grandfathered = planState?.grandfathered ?? false
  const currentTierLabel = TIER_LABEL[planState?.planTier ?? 'FREE'] ?? 'Free'

  // Pending confirmations (AlertDialog state)
  const [pendingGrandfathered, setPendingGrandfathered] = useState<boolean | null>(null)
  const [compTier, setCompTier] = useState<'FREE' | 'PRO' | 'PREMIUM'>('PRO')
  const [confirmCompOpen, setConfirmCompOpen] = useState(false)
  const [trialTier, setTrialTier] = useState<'PRO' | 'PREMIUM'>('PRO')
  const [trialDays, setTrialDays] = useState<number | undefined>(undefined)

  const invalidatePlanQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['venuePlan', venueId] })
    queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
    queryClient.invalidateQueries({ queryKey: ['seatStatus', venueId] })
  }

  const errorToast = (title: string, error: any) => {
    toast({ title, description: error?.response?.data?.error || error?.message, variant: 'destructive' })
  }

  const grandfatheredMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const service = await loadSuperadminService()
      return service.setVenueGrandfathered(venueId, value)
    },
    onSuccess: (_state, value) => {
      invalidatePlanQueries()
      toast({
        title: value ? 'Venue marcado como legacy (grandfathered)' : 'Venue removido de legacy',
        description: value
          ? 'Operará sin paywalls ni límite de usuarios.'
          : 'Entrará al modelo de planes: cap de 2 usuarios en Free y paywalls Pro/Premium.',
      })
      setPendingGrandfathered(null)
    },
    onError: (error: any) => {
      errorToast('No se pudo actualizar grandfathered', error)
      setPendingGrandfathered(null)
    },
  })

  const compPlanMutation = useMutation({
    mutationFn: async (tier: 'FREE' | 'PRO' | 'PREMIUM') => {
      const service = await loadSuperadminService()
      return service.assignCompPlan(venueId, tier)
    },
    onSuccess: (_state, tier) => {
      invalidatePlanQueries()
      toast({
        title: tier === 'FREE' ? 'Plan comp removido' : `Plan ${TIER_LABEL[tier]} asignado (comp)`,
        description:
          tier === 'FREE'
            ? 'El venue quedó en Free (se removió el plan comp/base).'
            : 'Plan comp permanente, sin cobro ni vencimiento.',
      })
      setConfirmCompOpen(false)
    },
    onError: (error: any) => {
      errorToast('No se pudo asignar el plan', error)
      setConfirmCompOpen(false)
    },
  })

  const trialMutation = useMutation({
    mutationFn: async ({ tier, days }: { tier: 'PRO' | 'PREMIUM'; days: number }) => {
      const service = await loadSuperadminService()
      return service.extendPlanTrial(venueId, tier, days)
    },
    onSuccess: (_state, { tier, days }) => {
      invalidatePlanQueries()
      toast({
        title: `Prueba ${TIER_LABEL[tier]} otorgada`,
        description: `${days} día${days === 1 ? '' : 's'} de prueba para ${venueLabel}.`,
      })
      setTrialDays(undefined)
    },
    onError: (error: any) => errorToast('No se pudo otorgar la prueba', error),
  })

  const handleGrantTrial = () => {
    if (trialDays === undefined || !Number.isFinite(trialDays) || trialDays < 1 || trialDays > 365) {
      toast({ title: 'Días inválidos', description: 'Los días de prueba deben estar entre 1 y 365.', variant: 'destructive' })
      return
    }
    trialMutation.mutate({ tier: trialTier, days: Math.floor(trialDays) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-500" />
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Plan del venue · Superadmin</h4>
      </div>

      {/* Estado actual */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background/50 border border-input">
        <span className="text-xs text-muted-foreground">Estado actual:</span>
        <Badge variant="outline" className="border-amber-400/50 text-amber-700 dark:text-amber-300">
          Plan {currentTierLabel}
        </Badge>
        {grandfathered && (
          <Badge className={GRADIENT_BTN}>
            <ShieldCheck className="h-3 w-3 mr-1" />
            Legacy / Grandfathered — sin paywalls ni límites
          </Badge>
        )}
        {planState?.trialEndsAt && (
          <Badge variant="outline" className="text-muted-foreground">
            <CalendarClock className="h-3 w-3 mr-1" />
            Prueba hasta {formatDate(planState.trialEndsAt)}
          </Badge>
        )}
      </div>

      {/* Toggle Grandfathered */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-background/50 border border-input">
        <div>
          <p className="text-sm font-medium">Venue legacy (grandfathered)</p>
          <p className="text-xs text-muted-foreground">Exento de TODA la monetización por planes: sin paywalls y sin cap de usuarios.</p>
        </div>
        <Switch
          checked={grandfathered}
          disabled={grandfatheredMutation.isPending || !planState}
          onCheckedChange={next => setPendingGrandfathered(next)}
          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-400 data-[state=checked]:to-pink-500"
        />
      </div>

      {/* Asignar plan comp (sin vigencia) */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-3 rounded-lg bg-background/50 border border-input">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="sa-comp-tier" className="text-sm font-medium">
            Asignar plan (sin vigencia)
          </Label>
          <p className="text-xs text-muted-foreground">Plan comp permanente: sin cobro, sin Stripe, sin vencimiento. Free remueve el plan comp.</p>
          <Select value={compTier} onValueChange={v => setCompTier(v as 'FREE' | 'PRO' | 'PREMIUM')}>
            <SelectTrigger id="sa-comp-tier" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FREE">Free</SelectItem>
              <SelectItem value="PRO">Pro</SelectItem>
              <SelectItem value="PREMIUM">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setConfirmCompOpen(true)}
          disabled={compPlanMutation.isPending}
          className={`cursor-pointer ${GRADIENT_BTN}`}
        >
          {compPlanMutation.isPending ? 'Asignando…' : 'Asignar'}
        </Button>
      </div>

      {/* Extender prueba */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-3 rounded-lg bg-background/50 border border-input">
        <div className="flex-1 space-y-1.5">
          <Label className="text-sm font-medium">Extender prueba</Label>
          <p className="text-xs text-muted-foreground">Otorga o extiende una prueba del plan (1 a 365 días), sin tarjeta.</p>
          <div className="flex gap-2">
            <Select value={trialTier} onValueChange={v => setTrialTier(v as 'PRO' | 'PREMIUM')}>
              <SelectTrigger className="w-32" aria-label="Plan de prueba">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="PREMIUM">Premium</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={365}
              placeholder="Días"
              aria-label="Días de prueba"
              className="w-24"
              value={trialDays ?? ''}
              onChange={e => {
                const raw = e.target.value
                setTrialDays(raw === '' ? undefined : parseInt(raw, 10))
              }}
            />
          </div>
        </div>
        <Button onClick={handleGrantTrial} disabled={trialMutation.isPending} className={`cursor-pointer ${GRADIENT_BTN}`}>
          {trialMutation.isPending ? 'Otorgando…' : 'Dar días de prueba'}
        </Button>
      </div>

      {/* Confirm: toggle grandfathered */}
      <AlertDialog open={pendingGrandfathered !== null} onOpenChange={open => !open && setPendingGrandfathered(null)}>
        <AlertDialogContent className="border-2 border-amber-400/50">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingGrandfathered ? '¿Marcar como venue legacy (grandfathered)?' : '¿Quitar grandfathered?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingGrandfathered
                ? `${venueLabel} operará sin paywalls ni límite de usuarios — exento de toda la monetización por planes, igual que antes de los tiers.`
                : `${venueLabel} entrará al modelo de planes: cap de 2 usuarios en Free y paywalls Pro/Premium.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={grandfatheredMutation.isPending}
              onClick={() => {
                if (pendingGrandfathered !== null) grandfatheredMutation.mutate(pendingGrandfathered)
              }}
              className={GRADIENT_BTN}
            >
              {grandfatheredMutation.isPending ? 'Guardando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: assign comp plan */}
      <AlertDialog open={confirmCompOpen} onOpenChange={setConfirmCompOpen}>
        <AlertDialogContent className="border-2 border-amber-400/50">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {compTier === 'FREE' ? '¿Remover plan comp / dejar en Free?' : `¿Asignar plan ${TIER_LABEL[compTier]} (comp)?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {compTier === 'FREE'
                ? `Se removerá el plan comp/base de ${venueLabel} y quedará en Free.`
                : `Plan comp permanente para ${venueLabel}: sin cobro, sin Stripe, sin vencimiento.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={compPlanMutation.isPending}
              onClick={() => compPlanMutation.mutate(compTier)}
              className={GRADIENT_BTN}
            >
              {compPlanMutation.isPending ? 'Asignando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
