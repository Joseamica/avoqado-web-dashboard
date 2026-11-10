import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { updateAreaTicketTerminal, type AreaTicketTerminal, type FulfillmentArea, type ScaleProfile } from '@/services/areaTickets.service'
import { CapacidadDeVales, cambioDeCapacidad, tieneEmitirYCobrar } from '../../areaTicketTerminalCapabilities'

const NONE = '__none__'
const apiError = (error: any, fallback: string): string => error?.response?.data?.message ?? error?.response?.data?.error ?? fallback

/**
 * Selectores y casillas de vales de UNA terminal (área, emitir, cobrar, entregar y báscula). Lo comparten
 * Configuración › Vales por área › Terminales y la ficha del aparato.
 */
export function TerminalAreaTicketEditor({
  venueId,
  terminal,
  areas,
  profiles,
  showScale,
  onSaved,
}: {
  venueId: string
  terminal: AreaTicketTerminal
  areas: FulfillmentArea[]
  profiles: ScaleProfile[]
  showScale: boolean
  onSaved?: (t: AreaTicketTerminal) => void
}) {
  const { t } = useTranslation('settings')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof updateAreaTicketTerminal>[2]; apagada?: CapacidadDeVales | null }) =>
      updateAreaTicketTerminal(venueId, terminal.id, input),
    onSuccess: (data, { apagada }) => {
      // D5-A: si prender una casilla apagó la otra, se dice por qué.
      if (apagada) {
        toast({
          title: t('areaTickets.terminals.issueOrCheckoutTitle'),
          description: t(
            apagada === 'canCheckoutAreaTickets' ? 'areaTickets.terminals.turnedOffCheckout' : 'areaTickets.terminals.turnedOffIssue',
          ),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['area-ticket-overview', venueId] })
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, terminal.id] })
      queryClient.invalidateQueries({ queryKey: ['printRouting', venueId] })
      onSaved?.(data as AreaTicketTerminal)
    },
    onError: error => toast({ title: 'No se pudo actualizar', description: apiError(error, 'Intenta de nuevo.'), variant: 'destructive' }),
  })
  // Dos toques en el mismo cuadro llegan antes de que `isPending` deshabilite los interruptores: el segundo saldría con
  // los datos viejos. El candado es síncrono (full-testingv2 del 2-nov vio 2 PUT y 2 avisos con un doble clic).
  const guardando = useRef(false)
  const guardar = (vars: Parameters<typeof mutation.mutate>[0]) => {
    if (guardando.current) return
    guardando.current = true
    mutation.mutate(vars, { onSettled: () => (guardando.current = false) })
  }

  return (
    <div>
      <Select
        value={terminal.fulfillmentAreaId ?? NONE}
        disabled={mutation.isPending}
        onValueChange={value => guardar({ input: { fulfillmentAreaId: value === NONE ? null : value } })}
      >
        <SelectTrigger className="mb-3 w-56">
          <SelectValue placeholder="Sin área" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin área / caja</SelectItem>
          {areas
            .filter(area => area.active)
            .map(area => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {tieneEmitirYCobrar(terminal) && (
        <p
          className="mb-3 rounded-lg border border-warning-border bg-warning-muted px-3 py-2 text-sm text-warning-foreground"
          data-tour="area-terminal-issue-and-checkout"
        >
          {t('areaTickets.terminals.bothOnWarning')}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['canIssueAreaTickets', 'Emitir vales'],
          ['canCheckoutAreaTickets', 'Cobrar vales'],
          ['canDeliverAreaTickets', 'Entregar'],
        ].map(([key, label]) => (
          <label key={key} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            {label}
            <Switch
              checked={Boolean(terminal[key as keyof AreaTicketTerminal])}
              // D5 (Codex final #3): mientras se guarda un cambio, no se manda otro con datos viejos.
              disabled={mutation.isPending}
              onCheckedChange={checked => {
                const { input, apagada } = cambioDeCapacidad(terminal, key as CapacidadDeVales, checked)
                guardar({ input, apagada })
              }}
            />
          </label>
        ))}
        {showScale && (
          <Select
            value={terminal.scaleProfileId ?? NONE}
            disabled={mutation.isPending}
            onValueChange={value => guardar({ input: { scaleProfileId: value === NONE ? null : value } })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin báscula" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin báscula</SelectItem>
              {profiles
                .filter(profile => profile.active)
                .map(profile => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
