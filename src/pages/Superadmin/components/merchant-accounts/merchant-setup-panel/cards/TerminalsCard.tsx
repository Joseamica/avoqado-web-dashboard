import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Search, Smartphone, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn, includesNormalized } from '@/lib/utils'
import { getAllTerminals, type Terminal } from '@/services/superadmin-terminals.service'
import { AngelPayCreateTerminalDialog } from '../../../angelpay/AngelPayCreateTerminalDialog'
import type { SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
}

/** Terminal types that can actually run a card transaction (TPVs). The rest
 *  (printers, KDS) are shown but un-checkable so the operator sees why. */
const COMPATIBLE_TYPES = ['TPV_ANDROID', 'TPV_IOS']

export default function TerminalsCard({ state, dispatch, mode }: Props) {
  const [open, setOpen] = useState(false)

  // Venue is the prerequisite — without a venueId we can't query terminals,
  // and even if we could there'd be nothing meaningful to show. Edit mode is
  // out-of-scope here (Task 4.2 will wire per-card save).
  const venueReady = !!state.venue.id
  const disabled = mode === 'edit' || !venueReady

  // Pull the cached list (if any) so the collapsed summary can show real names
  // instead of opaque ids. We don't enable the query here — the dialog body
  // does that — but if the dialog has been opened in this session we'll have
  // data sitting in the cache.
  const queryClient = useQueryClient()
  const cachedTerminals =
    queryClient.getQueryData<Terminal[]>([
      'superadmin-terminals-by-venue',
      state.venue.id,
    ]) ?? []

  const count = state.terminals.terminalIds.length
  const isEmpty = count === 0

  const summary = useMemo(() => {
    if (isEmpty) return null
    const selected = cachedTerminals.filter(t => state.terminals.terminalIds.includes(t.id))
    const names = selected
      .map(t => (t.name?.trim() || t.serialNumber || 'Sin nombre').trim())
      .filter(Boolean)
      .slice(0, 2)
    const base = `${count} terminal${count > 1 ? 'es' : ''} seleccionada${count > 1 ? 's' : ''}`
    if (names.length === 0) return base
    const tail = names.join(', ')
    const more = selected.length > 2 ? '…' : ''
    return `${base} · ${tail}${more}`
  }, [isEmpty, count, cachedTerminals, state.terminals.terminalIds])

  const pendingLabel =
    mode === 'edit'
      ? 'Pendiente'
      : !venueReady
        ? 'Elige el venue primero'
        : 'Opcional'

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          !isEmpty ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          !disabled && 'hover:bg-muted/30 cursor-pointer',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        data-tour="setup-panel-card-terminals"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Terminales TPV</h3>
          </div>
          {!isEmpty ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {count} seleccionada{count > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {pendingLabel}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || (
            <span className="text-muted-foreground">
              Opcional — atará las terminales después
            </span>
          )}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terminales TPV</DialogTitle>
          </DialogHeader>
          <TerminalsDialogBody
            state={state}
            dispatch={dispatch}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function TerminalsDialogBody({
  state,
  dispatch,
  onClose,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  // Local draft — only commits to the reducer on Save. The Set keeps toggle
  // logic O(1) and avoids stale-closure traps if the user double-clicks.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(state.terminals.terminalIds),
  )
  const [search, setSearch] = useState('')

  // "Crear terminal NEXGO" sub-dialog. Mirrors CostCard's create-aggregator
  // sub-dialog pattern: open it, let the existing component handle the POST,
  // then react via onCreated.
  const [createTerminalOpen, setCreateTerminalOpen] = useState(false)

  const venueId = state.venue.id ?? ''

  const { data: terminals = [], isLoading } = useQuery<Terminal[]>({
    queryKey: ['superadmin-terminals-by-venue', venueId],
    queryFn: () => getAllTerminals({ venueId }),
    enabled: !!venueId,
  })

  // Split: terminals available to attach (not retired, not bound to another
  // merchant) vs. those already attached to a different merchant (read-only
  // tail group so the operator understands what's missing from the list).
  const { available, alreadyAttached } = useMemo(() => {
    const avail: Terminal[] = []
    const taken: Terminal[] = []
    for (const t of terminals) {
      if (t.status === 'RETIRED') continue
      const isAttached = (t.assignedMerchantIds?.length ?? 0) > 0
      if (isAttached) taken.push(t)
      else avail.push(t)
    }
    return { available: avail, alreadyAttached: taken }
  }, [terminals])

  // Substring filter applied only to the "available" pool. Already-attached
  // ones stay in the bottom group regardless of search so they keep their
  // explanatory role.
  const filtered = useMemo(() => {
    if (!search.trim()) return available
    return available.filter(
      t =>
        includesNormalized(t.name ?? '', search) ||
        includesNormalized(t.serialNumber ?? '', search),
    )
  }, [available, search])

  const toggle = (id: string, isCompatible: boolean) => {
    if (!isCompatible) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllCompatible = () => {
    const compatibleIds = available
      .filter(t => COMPATIBLE_TYPES.includes(t.type))
      .map(t => t.id)
    setSelected(new Set(compatibleIds))
  }

  const handleClear = () => setSelected(new Set())

  const handleSave = () => {
    dispatch({
      type: 'SET_TERMINALS',
      terminals: { skipped: false, terminalIds: Array.from(selected) },
    })
    onClose()
  }

  const handleTerminalCreated = (terminal: Terminal) => {
    // Refresh the list so the new terminal appears, then pre-check it so the
    // operator doesn't have to scroll back and click it manually.
    queryClient.invalidateQueries({
      queryKey: ['superadmin-terminals-by-venue', venueId],
    })
    setSelected(prev => {
      const next = new Set(prev)
      next.add(terminal.id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Asocia las terminales físicas de este venue al merchant. Opcional —
        puedes hacerlo después desde la sección de terminales del venue.
      </p>

      {/* Top action bar — create + bulk select. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setCreateTerminalOpen(true)}
        >
          + Crear terminal NEXGO
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleSelectAllCompatible}
            disabled={available.length === 0}
          >
            Seleccionar todas las compatibles
          </Button>
          {selected.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClear}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o serial"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-10"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List body — loading / empty / no-results / rows. */}
      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Cargando terminales...
        </div>
      ) : terminals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Este venue no tiene terminales registradas todavía.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCreateTerminalOpen(true)}
          >
            + Crear terminal NEXGO
          </Button>
        </div>
      ) : filtered.length === 0 && search.trim() ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Sin resultados para «{search}».
        </div>
      ) : (
        <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
          {filtered.map(terminal => {
            const isCompatible = COMPATIBLE_TYPES.includes(terminal.type)
            const isSelected = selected.has(terminal.id)
            return (
              <label
                key={terminal.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer',
                  !isCompatible && 'opacity-50 cursor-not-allowed',
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-transparent hover:bg-muted/50',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={!isCompatible}
                  onCheckedChange={() => toggle(terminal.id, isCompatible)}
                />
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {terminal.name?.trim() || 'Sin nombre'}
                  </span>
                  {terminal.serialNumber && (
                    <span className="text-[11px] text-muted-foreground font-mono truncate">
                      {terminal.serialNumber}
                    </span>
                  )}
                  {(terminal.brand || terminal.model) && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {[terminal.brand, terminal.model].filter(Boolean).join(' ')}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {terminal.type}
                  </Badge>
                  {terminal.status && terminal.status !== 'ACTIVE' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {terminal.status}
                    </Badge>
                  )}
                </div>
                {!isCompatible && (
                  <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                    <Ban className="w-3 h-3 mr-1" />
                    N/C
                  </Badge>
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* Already-attached tail group — informative, not interactive. */}
      {alreadyAttached.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-input">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Ya atadas a otro merchant
            </p>
            <Badge variant="outline" className="text-[10px]">
              {alreadyAttached.length} asignación{alreadyAttached.length > 1 ? 'es' : ''}
            </Badge>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
            {alreadyAttached.map(terminal => (
              <div
                key={terminal.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 opacity-60"
              >
                <span className="text-sm truncate">
                  {terminal.name?.trim() || 'Sin nombre'}
                </span>
                {terminal.serialNumber && (
                  <span className="text-[11px] text-muted-foreground font-mono truncate">
                    {terminal.serialNumber}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] ml-auto">
                  {terminal.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:underline"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="text-xs font-medium bg-foreground text-background rounded-md px-3 py-1.5"
        >
          Guardar
        </button>
      </div>

      {/* Inline NEXGO terminal create. The dialog handles its own POST + toast;
       *  we just react in onCreated to refresh + auto-check. */}
      <AngelPayCreateTerminalDialog
        open={createTerminalOpen}
        onOpenChange={setCreateTerminalOpen}
        venueId={venueId}
        venueName={state.venue.name ?? undefined}
        onCreated={handleTerminalCreated}
      />
    </div>
  )
}
