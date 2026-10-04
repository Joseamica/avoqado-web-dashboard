import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Lightbulb, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInvalidatePasses, usePassCapacity } from '@/hooks/use-passes'
import { useToast } from '@/hooks/use-toast'
import { deletePassCapRule, setDefaultPassCap, upsertWeeklyPassCap } from '@/services/passes.service'
import { apiErrorDescription } from '@/utils/apiError'
import type { WeeklyRuleInput, WeeklyRuleView } from '@/types/passes'
import { hhmm, isValidSpots, readSpots } from './passesFormat'
import { WeeklyRuleDialog } from './WeeklyRuleDialog'

interface PassCapacitySectionProps {
  venueId: string
  canManage: boolean
  /** ¿Hay alguna conexión ACTIVE (la única con la que el server aplica las reglas)? Sin ella se guardan igual y esperan. */
  connected: boolean
}

/** Lunes primero, como el diálogo (el server ordena por número de día: domingo = 0 primero). */
const mondayFirst = (weekday: number) => (weekday + 6) % 7

/**
 * Las tres capas de lugares para pases (spec §6, D3): tope general, excepciones por día+hora y —desde el calendario—
 * por sesión (Tarea 10). Las sugerencias vienen calculadas del server (p75 de ocupación propia, últimas 8 semanas) y
 * «Aplicar» sólo crea la excepción que proponen: la UI no decide nada por su cuenta.
 * La página la monta con `key={venueId}`: ningún borrador ni diálogo cruza de sucursal.
 */
export function PassCapacitySection({ venueId, canManage, connected }: PassCapacitySectionProps) {
  const { t } = useTranslation('passes')
  const { toast } = useToast()
  const invalidate = useInvalidatePasses()
  const capacity = usePassCapacity(venueId)
  // Borrador del tope general, atado al valor del server sobre el que se tecleó: otro refetch (crear/borrar una excepción,
  // aplicar una sugerencia) no lo pisa, y si el tope del server CAMBIA (otro administrador, o el guardado) gana el nuevo.
  const [draft, setDraft] = useState<{ base: number | null; value: number | null } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [ruleToDelete, setRuleToDelete] = useState<WeeklyRuleView | null>(null)

  const serverDefault = capacity.data?.defaultMaxSpots ?? null
  const defaultSpots = draft && draft.base === serverDefault ? draft.value : serverDefault

  // Cada callback DEVUELVE la invalidación: isPending dura hasta que la capacidad y el calendario se refrescaron (P2-8).
  // onError también recarga (R2b-17): aunque falle, el server pudo haber cambiado (otro administrador borró la regla).
  const errorText = (error: unknown) => apiErrorDescription(error) || t('errors.generic')
  const onError = (error: unknown) => {
    toast({ variant: 'destructive', title: errorText(error) })
    return invalidate(venueId, 'rules')
  }
  const saveDefault = useMutation({
    mutationFn: (maxSpots: number | null) => setDefaultPassCap(venueId, maxSpots),
    onSuccess: () => {
      toast({ title: t('capacity.default.saved') })
      return invalidate(venueId, 'rules')
    },
    onError,
  })
  const upsertWeekly = useMutation({
    mutationFn: ({ input }: { input: WeeklyRuleInput; fromDialog: boolean }) => upsertWeeklyPassCap(venueId, input),
    onMutate: () => setDialogError(null),
    onSuccess: () => {
      setDialogOpen(false)
      toast({ title: t('capacity.weekly.saved') })
      return invalidate(venueId, 'rules')
    },
    // Desde el diálogo, el error va DENTRO (el modal tapa la lista que habría que corregir y un toast se va en 5 s);
    // desde «Aplicar» la lista está a la vista: toast, como los demás.
    onError: (error: unknown, { fromDialog }) => {
      if (!fromDialog) return onError(error)
      setDialogError(errorText(error))
      return invalidate(venueId, 'rules')
    },
  })
  const removeRule = useMutation({
    mutationFn: (ruleId: string) => deletePassCapRule(venueId, ruleId),
    onSuccess: () => {
      toast({ title: t('capacity.weekly.deleted') })
      return invalidate(venueId, 'rules')
    },
    onError,
  })

  const busy = saveDefault.isPending || upsertWeekly.isPending || removeRule.isPending
  const disabled = !canManage || busy
  const defaultDirty = defaultSpots !== serverDefault
  const defaultValid = defaultSpots === null || isValidSpots(defaultSpots)

  if (capacity.isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground" role="status" aria-label={t('common:loading')}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (capacity.isError && !capacity.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('capacity.loadError')}</AlertTitle>
        <AlertDescription>{apiErrorDescription(capacity.error) || t('errors.generic')}</AlertDescription>
        {/* No se refresca sola: sin esto el dueño se queda en el error hasta recargar la página. */}
        <Button
          variant="outline"
          size="sm"
          className="col-start-2 mt-2 justify-self-start"
          onClick={() => capacity.refetch()}
          disabled={capacity.isFetching}
          data-tour="passes-capacity-retry"
        >
          {t('common:retry')}
        </Button>
      </Alert>
    )
  }
  if (!capacity.data) return null

  const { suggestions } = capacity.data
  const weekly = [...capacity.data.weekly].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday))
  const ruleAt = (weekday: number, startMinute: number | null) => weekly.find(r => r.weekday === weekday && r.startMinute === startMinute)
  const ruleLabel = (rule: WeeklyRuleView) =>
    `${t(`days.${rule.weekday}`)} · ${hhmm(rule.startMinute) ?? t('allDay')} · ${t('capacity.weekly.spots', { count: rule.maxSpots })}`

  return (
    <>
      <Card className="border-input shadow-sm" data-tour="passes-capacity">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('capacity.title')}</CardTitle>
          <CardDescription>{t('capacity.description')}</CardDescription>
          {!connected && <p className="pt-1 text-sm text-muted-foreground">{t('capacity.notConnected')}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Capa 1: tope general */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-input bg-muted/40 px-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="passes-default-cap">{t('capacity.default.label')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="passes-default-cap"
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  className="w-28"
                  value={Number.isNaN(defaultSpots) ? '' : (defaultSpots ?? '')}
                  onChange={e => setDraft({ base: serverDefault, value: readSpots(e.target) })}
                  disabled={disabled}
                  aria-invalid={!defaultValid}
                  aria-describedby="passes-default-cap-help"
                  data-tour="passes-default-cap"
                />
                <span className="text-sm text-muted-foreground">{t('capacity.default.unit')}</span>
              </div>
              <p id="passes-default-cap-help" className={defaultValid ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
                {defaultValid ? t('capacity.default.hint') : t('capacity.default.invalid')}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={disabled || !defaultDirty || !defaultValid}
              onClick={() => saveDefault.mutate(defaultSpots)}
              data-tour="passes-default-cap-save"
            >
              {saveDefault.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('capacity.default.save')}
            </Button>
          </div>

          {/* Capa 2: excepciones por día y hora */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{t('capacity.weekly.title')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setDialogError(null)
                  setDialogOpen(true)
                }}
                data-tour="passes-weekly-add"
              >
                {t('capacity.weekly.add')}
              </Button>
            </div>
            {weekly.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('capacity.weekly.empty')}</p>
            ) : (
              <ul className="divide-y divide-input rounded-lg border border-input">
                {weekly.map(rule => (
                  <li key={rule.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span>{ruleLabel(rule)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 cursor-pointer"
                      disabled={disabled}
                      onClick={() => setRuleToDelete(rule)}
                      aria-label={t('capacity.weekly.deleteRule', { rule: ruleLabel(rule) })}
                      data-tour="passes-weekly-delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sugerencias con su porqué */}
          <div className="space-y-2 rounded-lg border border-input p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{t('capacity.suggestions.title')}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('capacity.suggestions.description')}</p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('capacity.suggestions.empty')}</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map(s => {
                  const current = ruleAt(s.weekday, s.startMinute)
                  return (
                    <li key={`${s.weekday}-${s.startMinute}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <p>
                          {t('capacity.suggestions.line', {
                            day: t(`daysPlural.${s.weekday}`),
                            time: hhmm(s.startMinute),
                            pct: s.capacity > 0 ? Math.round((s.p75Occupancy / s.capacity) * 100) : 0,
                            count: s.suggestedMaxSpots,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('capacity.suggestions.weeks', { count: s.weeksOfData })}</p>
                        {/* «Aplicar» reemplaza la excepción de ese día y hora: si hoy tiene otro valor, se dice antes. */}
                        {current && current.maxSpots !== s.suggestedMaxSpots && (
                          <p className="text-xs text-muted-foreground">{t('capacity.weekly.replaces', { count: current.maxSpots })}</p>
                        )}
                      </div>
                      {s.applied ? (
                        <Badge variant="secondary">{t('capacity.suggestions.applied')}</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() =>
                            upsertWeekly.mutate({
                              input: { weekday: s.weekday, startMinute: s.startMinute, maxSpots: s.suggestedMaxSpots },
                              fromDialog: false,
                            })
                          }
                          data-tour="passes-suggestion-apply"
                        >
                          {t('capacity.suggestions.apply')}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <WeeklyRuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={input => upsertWeekly.mutate({ input, fromDialog: true })}
        saving={upsertWeekly.isPending}
        existing={weekly}
        error={dialogError}
      />

      <AlertDialog open={!!ruleToDelete} onOpenChange={open => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('capacity.weekly.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ruleToDelete && t('capacity.weekly.deleteBody', { rule: ruleLabel(ruleToDelete) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => ruleToDelete && removeRule.mutate(ruleToDelete.id)}
              data-tour="passes-weekly-delete-confirm"
            >
              {t('capacity.weekly.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
