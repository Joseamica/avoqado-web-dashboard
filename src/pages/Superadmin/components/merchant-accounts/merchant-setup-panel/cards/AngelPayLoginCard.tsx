import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Loader2, Unlink, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listAngelPayUserAccountsForVenue, angelpayUserAccountAPI } from '@/services/superadmin-angelpay-user-account.service'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
  /**
   * Required when `mode === 'edit'`. Enables the "Desanexar" action which
   * unbinds this merchant from its AngelPayUserAccount (sets
   * angelpayUserAccountId to null on the merchant). Useful when consolidating
   * logins across multiple merchant accounts.
   */
  merchantAccountId?: string
  /**
   * Optional. When the operator confirms detach, the panel typically wants to
   * close because the merchant no longer has a login → activating in TPV is
   * blocked anyway. The parent passes a callback that closes the panel.
   */
  onDetached?: () => void
}

export default function AngelPayLoginCard({ state, dispatch, mode, merchantAccountId, onDetached }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDetachOpen, setConfirmDetachOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const venueId = state.venue.id

  const detachMutation = useMutation({
    mutationFn: () => {
      if (!merchantAccountId) throw new Error('merchantAccountId required')
      return paymentProviderAPI.updateMerchantAccount(merchantAccountId, { angelpayUserAccountId: null })
    },
    onSuccess: () => {
      // Invalidate every cache that knows about this merchant or its login.
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantAccountId] })
      queryClient.invalidateQueries({ queryKey: ['merchant-angelpay-account', merchantAccountId] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['angelpay-logins', venueId] })
      toast({
        title: 'Merchant desanexado',
        description: 'Ya no está ligado a esta cuenta AngelPay. Asígnalo a otra cuenta antes de operarlo en TPV.',
      })
      setConfirmDetachOpen(false)
      onDetached?.()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo desanexar',
        description: err?.response?.data?.message || 'Error en el servidor. Reintenta.',
        variant: 'destructive',
      })
    },
  })

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

      {/* Detach action — only available in edit mode AND only when the
       *  merchant is currently bound to a login (no point detaching if there
       *  isn't one). Sits OUTSIDE the card button so clicking it doesn't try
       *  to open the (disabled) edit dialog. */}
      {mode === 'edit' && merchantAccountId && state.login.mode === 'existing' && (
        <button
          type="button"
          onClick={() => setConfirmDetachOpen(true)}
          disabled={detachMutation.isPending}
          className="-mt-3 mb-1 ml-5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          data-tour="setup-panel-detach-angelpay"
        >
          {detachMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Unlink className="w-3 h-3" />
          )}
          Desanexar este merchant de la cuenta AngelPay
        </button>
      )}

      <AlertDialog open={confirmDetachOpen} onOpenChange={setConfirmDetachOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desanexar de la cuenta AngelPay?</AlertDialogTitle>
            <AlertDialogDescription>
              El merchant <strong>{state.merchant.existingMerchantLabel ?? state.merchant.displayName ?? ''}</strong> dejará
              de estar ligado a esta cuenta AngelPay. Quedará huérfano: no podrá procesar pagos en TPV hasta que lo asignes
              a otra cuenta. Los costos, precios, slot y liquidación se mantienen — solo se rompe el vínculo con el login.
              Esto NO afecta a los demás merchants anexados a la misma cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={detachMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={e => {
                e.preventDefault()
                detachMutation.mutate()
              }}
              disabled={detachMutation.isPending}
            >
              {detachMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sí, desanexar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              venueId={venueId}
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
  venueId,
  hasExisting,
  onCancel,
  onSaved,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  venueId: string | undefined
  hasExisting: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const newLogin =
    state.login.mode === 'new'
      ? state.login
      : { mode: 'new' as const, email: '', pin: '', environment: 'QA' as const }
  const patch = (p: Partial<typeof newLogin>) =>
    dispatch({ type: 'SET_LOGIN', login: { ...newLogin, ...p, mode: 'new' } })

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLogin.email) && /^\d{6}$/.test(newLogin.pin)

  /**
   * Creates the AngelPayUserAccount in the backend immediately when the
   * operator clicks "Usar esta cuenta". Previously this only kept the data
   * in local state and the row was created during "Activar merchant" — but
   * that meant the Merchant card couldn't use the TPV auto-discovery
   * panel (it requires `state.login.mode === 'existing'` with a real
   * `angelpayUserAccountId`). For multi-account setups where the operator
   * doesn't know the merchant ID/affiliation, this was a hard blocker.
   *
   * After create succeeds we flip `state.login` to `mode='existing'` so
   * the next card sees a real backend account.
   */
  const createMutation = useMutation({
    mutationFn: () => {
      if (!venueId) throw new Error('venueId required')
      return angelpayUserAccountAPI.create(venueId, {
        email: newLogin.email,
        pin: newLogin.pin,
        environment: newLogin.environment,
      })
    },
    onSuccess: created => {
      // Refresh the "Cuentas existentes en este venue" list above so the new
      // row appears as selected and future re-opens of the dialog see it.
      queryClient.invalidateQueries({ queryKey: ['angelpay-logins', venueId] })
      // Flip to existing-mode with the real id so MerchantCard's TPV
      // auto-discovery panel becomes available.
      dispatch({
        type: 'SET_LOGIN',
        login: { mode: 'existing', angelpayUserAccountId: created.id },
      })
      toast({
        title: 'Cuenta AngelPay creada',
        description: `Lista para descubrir merchants vía TPV (${created.email}).`,
      })
      onSaved()
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo crear la cuenta AngelPay',
        description: err?.response?.data?.message || 'Error en el servidor. Reintenta.',
        variant: 'destructive',
      })
    },
  })

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
        <button
          type="button"
          onClick={onCancel}
          disabled={createMutation.isPending}
          className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!valid || !venueId || createMutation.isPending}
          className="inline-flex items-center text-xs font-medium bg-foreground text-background rounded-md px-3 py-1 disabled:opacity-50"
        >
          {createMutation.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
          {createMutation.isPending ? 'Creando cuenta…' : 'Usar esta cuenta'}
        </button>
      </div>
    </div>
  )
}
