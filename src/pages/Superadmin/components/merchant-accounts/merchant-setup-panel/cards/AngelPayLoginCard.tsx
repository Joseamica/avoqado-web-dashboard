import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Info, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listAngelPayUserAccountsForVenue } from '@/services/superadmin-angelpay-user-account.service'
import { cn } from '@/lib/utils'
import type { SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
}

export default function AngelPayLoginCard({ state, dispatch, mode }: Props) {
  const [open, setOpen] = useState(false)
  const venueId = state.venue.id

  const { data: existing = [] } = useQuery({
    queryKey: ['angelpay-logins', venueId],
    queryFn: () => listAngelPayUserAccountsForVenue(venueId!),
    enabled: !!venueId && open,
  })

  const activeOnly = existing.filter(a => a.status !== 'DELETED' && a.status !== 'SUSPENDED')

  const isValid =
    state.login.mode === 'existing'
      ? !!state.login.angelpayUserAccountId
      : state.login.mode === 'new'
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.login.email) && /^\d{6}$/.test(state.login.pin)
        : false

  const summary = (() => {
    const login = state.login
    if (login.mode === 'empty') return null
    if (login.mode === 'existing') return activeOnly.find(a => a.id === login.angelpayUserAccountId)?.email
    return login.email
  })()

  return (
    <>
      <button
        type="button"
        onClick={() => mode === 'create' && setOpen(true)}
        disabled={!venueId || mode === 'edit'}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          isValid ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          mode === 'create' && venueId && 'hover:bg-muted/30 cursor-pointer',
          !venueId && 'opacity-60 cursor-not-allowed',
        )}
        data-tour="setup-panel-card-login"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Cuenta AngelPay</h3>
          </div>
          {isValid ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {venueId ? 'Pendiente' : 'Selecciona venue primero'}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || <span className="text-muted-foreground">Login del adquirente</span>}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cuenta AngelPay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeOnly.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Cuentas existentes en este venue</Label>
                {activeOnly.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: a.id } })
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border border-input px-3 py-2 hover:bg-muted/30 transition-colors text-left',
                      state.login.mode === 'existing' &&
                        state.login.angelpayUserAccountId === a.id &&
                        'border-foreground bg-muted/40',
                    )}
                  >
                    <span className="text-sm truncate">{a.email}</span>
                    <Badge variant="outline" className="text-[10px]">{a.environment}</Badge>
                  </button>
                ))}
              </div>
            )}

            <NewLoginInline
              state={state}
              dispatch={dispatch}
              hasExisting={activeOnly.length > 0}
              onCancel={() => setOpen(false)}
              onSaved={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewLoginInline({
  state,
  dispatch,
  hasExisting,
  onCancel,
  onSaved,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  hasExisting: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const newLogin =
    state.login.mode === 'new'
      ? state.login
      : { mode: 'new' as const, email: '', pin: '', environment: 'QA' as const }
  const patch = (p: Partial<typeof newLogin>) =>
    dispatch({ type: 'SET_LOGIN', login: { ...newLogin, ...p, mode: 'new' } })

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLogin.email) && /^\d{6}$/.test(newLogin.pin)

  return (
    <div className="space-y-3 rounded-lg border border-input p-3">
      <Label className="text-xs">+ Conectar una cuenta nueva</Label>
      {hasExisting && (
        <p className="flex items-start gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1.5 text-[11px] text-blue-700 dark:text-blue-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Este venue ya tiene cuentas AngelPay. Si usas TPV en el siguiente paso, el TPV debe re-loguearse
            con esta cuenta nueva primero. Recomendable: 1 cuenta a la vez.
          </span>
        </p>
      )}
      <div className="space-y-2">
        <Label className="text-xs">Correo</Label>
        <Input
          value={newLogin.email}
          onChange={e => patch({ email: e.target.value })}
          placeholder="correo@ejemplo.com"
          className="h-10"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">PIN (6 dígitos)</Label>
          <Input
            value={newLogin.pin}
            onChange={e => patch({ pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            placeholder="123456"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Ambiente</Label>
          <Select value={newLogin.environment} onValueChange={v => patch({ environment: v as 'QA' | 'PROD' })}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="QA">QA</SelectItem>
              <SelectItem value="PROD">PROD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:underline">
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSaved}
          disabled={!valid}
          className="text-xs font-medium bg-foreground text-background rounded-md px-3 py-1 disabled:opacity-50"
        >
          Usar esta cuenta
        </button>
      </div>
    </div>
  )
}
