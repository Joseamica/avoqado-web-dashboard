/**
 * TerminalsSubsection — Section A of the AngelPay onboarding wizard
 * (Task 54). Lives inside `ManualAccountDialog` directly under the venue
 * selector.
 *
 * Job: tell the operator whether the venue has ≥1 ACTIVE NEXGO terminal, and
 * if not, offer two ways to fix it without leaving the dialog:
 *
 *   1. "Crear terminal nueva" — opens the existing `TerminalDialog` (parent
 *      controls the open state because the dialog has its own venue picker
 *      and we don't want two dialogs trying to manage the same overlay).
 *   2. "Anexar terminal existente" — opens the new `AttachTerminalDialog`
 *      to re-parent a terminal from another venue.
 *
 * When ≥1 terminal exists, we still show those two CTAs (smaller, under
 * the list) so adding more is one click away. Common pattern when a venue
 * is rolling out multiple Nexgo devices.
 *
 * `onReadyChange` lets the parent track terminal-presence as a wizard gate
 * — Section C (merchants) only renders when this fires `true` plus the
 * AngelPay account is ACTIVE.
 */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Smartphone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { terminalAPI, type Terminal } from '@/services/superadmin-terminals.service'

export interface TerminalsSubsectionProps {
  venueId: string
  /** Brand we care about for this provider (typically 'NEXGO' for AngelPay). */
  brand: string
  /** Fires whenever the count of matching ACTIVE terminals changes. */
  onReadyChange?: (ready: boolean) => void
  onCreateTerminal: () => void
  onAttachTerminal: () => void
}

export function TerminalsSubsection({
  venueId,
  brand,
  onReadyChange,
  onCreateTerminal,
  onAttachTerminal,
}: TerminalsSubsectionProps) {
  // Same query key prefix as the rest of the dashboard so create/attach
  // mutations elsewhere invalidate us automatically.
  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ['superadmin-terminals', { venueId }],
    queryFn: () => terminalAPI.getAllTerminals({ venueId }),
    enabled: !!venueId,
  })

  const matching = terminals.filter(
    (t) => t.status === 'ACTIVE' && t.brand?.toUpperCase() === brand.toUpperCase(),
  )

  useEffect(() => {
    onReadyChange?.(matching.length > 0)
  }, [matching.length, onReadyChange])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando terminales…
      </div>
    )
  }

  if (matching.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Empieza registrando una terminal {brand}</p>
            <p className="text-xs text-muted-foreground mt-1">
              AngelPay solo opera en terminales {brand}. Crea una nueva o anexa una existente que pertenezca
              físicamente a este venue.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button type="button" size="sm" onClick={onCreateTerminal}>
            <Plus className="w-4 h-4 mr-1" />
            Crear terminal nueva
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAttachTerminal}>
            Anexar terminal existente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {matching.length} terminal{matching.length === 1 ? '' : 'es'} {brand} activa
        {matching.length === 1 ? '' : 's'} en este venue:
      </p>
      <div className="space-y-1.5">
        {matching.map((t) => (
          <TerminalRow key={t.id} terminal={t} />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={onCreateTerminal}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar otra
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAttachTerminal}>
          Anexar existente
        </Button>
      </div>
    </div>
  )
}

function TerminalRow({ terminal }: { terminal: Terminal }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border rounded-md bg-muted/30 text-sm flex-wrap">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <span className="font-medium truncate">{terminal.name}</span>
        <Badge variant="outline" className="font-mono text-xs">
          {terminal.serialNumber}
        </Badge>
        {terminal.brand && (
          <Badge variant="secondary" className="text-xs">
            {terminal.brand}
            {terminal.model ? ` ${terminal.model}` : ''}
          </Badge>
        )}
      </div>
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">{terminal.status}</Badge>
    </div>
  )
}

export default TerminalsSubsection
