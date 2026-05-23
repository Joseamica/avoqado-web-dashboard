import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, Info, Loader2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { fetchAngelPayMerchantsFromTpv } from '@/services/superadmin-angelpay-user-account.service'
import { getAllTerminals } from '@/services/superadmin-terminals.service'
import { cn } from '@/lib/utils'
import type { MerchantSlice, SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface Props {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
}

const MERCHANT_ID_RE = /^\d+$/

/** Local re-derive of the merchant card's validity. Mirrors `isCardValid(s, 'merchant')`
 *  so the card surface stays self-contained. */
function isMerchantValid(m: MerchantSlice): boolean {
  if (m.mode === 'empty') return false
  if (m.mode === 'existing') return !!m.existingMerchantId
  return (
    MERCHANT_ID_RE.test(m.externalMerchantId) &&
    !!m.name.trim() &&
    !!m.affiliation.trim() &&
    !!m.displayName.trim() &&
    m.idConfirmed
  )
}

export default function MerchantCard({ state, dispatch, mode }: Props) {
  const [open, setOpen] = useState(false)

  const loginReady = state.login.mode !== 'empty'
  const isValid = isMerchantValid(state.merchant)
  const disabled = mode === 'edit' || !loginReady

  const summary =
    state.merchant.mode === 'empty'
      ? null
      : state.merchant.mode === 'existing'
        ? state.merchant.existingMerchantLabel || `Merchant ${state.merchant.existingMerchantId}`
        : state.merchant.displayName || state.merchant.name || `ID ${state.merchant.externalMerchantId}`

  const pendingLabel = mode === 'edit'
    ? 'Pendiente'
    : !loginReady
      ? 'Selecciona cuenta primero'
      : 'Pendiente'

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          isValid ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          !disabled && 'hover:bg-muted/30 cursor-pointer',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        data-tour="setup-panel-card-merchant"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Merchant</h3>
          </div>
          {isValid ? (
            <Badge className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{pendingLabel}</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {summary || <span className="text-muted-foreground">MerchantAccount a crear o reutilizar</span>}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Datos del merchant</DialogTitle>
          </DialogHeader>
          <MerchantDialogBody state={state} dispatch={dispatch} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function MerchantDialogBody({
  state,
  dispatch,
  onClose,
}: {
  state: SetupState
  dispatch: (action: SetupAction) => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const venueId = state.venue.id

  // Local form buffer — only commit to reducer when user clicks "Guardar".
  // Otherwise opening the modal would already dirty `state.merchant` and the
  // header progress counter would flip prematurely.
  const initialDraft: MerchantSlice =
    state.merchant.mode === 'empty'
      ? {
          mode: 'create',
          externalMerchantId: '',
          name: '',
          affiliation: '',
          displayName: '',
          idConfirmed: false,
        }
      : state.merchant

  const [draft, setDraft] = useState<MerchantSlice>(initialDraft)
  const [tpvFetchState, setTpvFetchState] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle')
  const [tpvFetchMsg, setTpvFetchMsg] = useState('')

  // Load all merchants — needed so we can list ones already linked to the chosen
  // AngelPay login (offers reuse) and to poll for newly discovered ones after a
  // TPV fetch. Same query key as the wizard so the cache is shared.
  const { data: allMerchants = [] } = useQuery<MerchantAccount[]>({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
  })

  const { data: terminals = [] } = useQuery({
    queryKey: ['venue-terminals', venueId],
    queryFn: () => getAllTerminals({ venueId: venueId as string }),
    enabled: !!venueId,
  })

  const nexgoTerminal = useMemo(
    () => terminals.find(t => t.brand === 'NEXGO' && t.status === 'ACTIVE'),
    [terminals],
  )

  // Merchants linked to the chosen existing login — offer for reuse so the
  // operator doesn't have to retype the data the wizard already knows about.
  const loginMerchants = useMemo(() => {
    if (state.login.mode !== 'existing') return []
    const loginId = state.login.angelpayUserAccountId
    return allMerchants.filter(m => m.angelpayUserAccountId === loginId)
  }, [allMerchants, state.login])

  const handleTpvFetch = async () => {
    if (state.login.mode !== 'existing' || !venueId) return
    const loginId = state.login.angelpayUserAccountId
    if (!nexgoTerminal) {
      setTpvFetchState('error')
      setTpvFetchMsg('No hay una terminal NEXGO activa en este venue.')
      return
    }
    setTpvFetchState('fetching')
    setTpvFetchMsg('Buscando merchants en la terminal…')
    const before = allMerchants.filter(m => m.angelpayUserAccountId === loginId).length

    // `mode: 'PREVIEW_ONLY'` tells the report endpoint to SKIP the legacy
    // zero-touch auto-onboarding when the TPV reports back. The panel owns
    // merchant creation when the operator clicks "Activar merchant"
    // (`fullSetupAngelPayMerchant`); without this flag the TPV report would
    // silently create a MerchantAccount + take a slot mid-setup, and the
    // activation would then 409 with "slot ya ocupado" after the operator
    // spent several minutes filling cards.
    try {
      await fetchAngelPayMerchantsFromTpv({
        venueId,
        terminalId: nexgoTerminal.id,
        angelpayUserAccountId: loginId,
        mode: 'PREVIEW_ONLY',
      })
    } catch {
      setTpvFetchState('error')
      setTpvFetchMsg('No se pudo iniciar la búsqueda en la terminal.')
      return
    }

    // Poll for up to ~30s. Transient poll failures (network blip) are swallowed
    // — only the "no new merchants in window" outcome surfaces as an error.
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      try {
        const fresh = await queryClient.fetchQuery({
          queryKey: ['merchant-accounts-all'],
          queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
        })
        const found = fresh.filter(m => m.angelpayUserAccountId === loginId).length
        if (found > before) {
          setTpvFetchState('done')
          setTpvFetchMsg(`Se encontraron ${found - before} merchant(s). Elígelos abajo.`)
          return
        }
      } catch {
        // ignore — keep polling
      }
    }
    setTpvFetchState('error')
    setTpvFetchMsg('La terminal no reportó merchants nuevos (timeout 30s). Verifica que la TPV esté en línea.')
  }

  // ------- Draft mutators -------
  const setCreateField = (patch: Partial<Omit<MerchantSlice, 'mode'>>) => {
    setDraft(prev => ({
      ...prev,
      ...patch,
      mode: 'create',
      // Reset the "I confirm" checkbox when ID changes.
      idConfirmed:
        patch.externalMerchantId !== undefined ? false : (patch.idConfirmed ?? prev.idConfirmed),
    }))
  }

  const pickExisting = (m: MerchantAccount) => {
    setDraft({
      mode: 'existing',
      externalMerchantId: '',
      name: '',
      affiliation: '',
      displayName: '',
      idConfirmed: false,
      existingMerchantId: m.id,
      existingMerchantLabel:
        m.displayName || m.angelpayMerchantName || `Merchant ${m.externalMerchantId}`,
    })
  }

  const switchToCreate = () => {
    setDraft({
      mode: 'create',
      externalMerchantId: '',
      name: '',
      affiliation: '',
      displayName: '',
      idConfirmed: false,
    })
  }

  const canSave = isMerchantValid(draft)

  const handleSave = () => {
    if (!canSave) {
      toast({
        title: 'Faltan datos',
        description: 'Completa los campos del merchant antes de guardar.',
        variant: 'destructive',
      })
      return
    }
    dispatch({ type: 'SET_MERCHANT', merchant: draft })
    onClose()
  }

  return (
    <div className="space-y-4">
      {/* Header banner — clarifies that AngelPay login != merchant. */}
      <p className="flex items-start gap-1.5 rounded-lg border border-input bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Aquí defines el <strong>MerchantAccount</strong> que se va a crear (o reutilizar). Crear
          la cuenta AngelPay del paso anterior <strong>NO crea automáticamente un merchant</strong>{' '}
          — el merchant nace al confirmar este wizard.
        </span>
      </p>

      {/* TPV auto-discovery — only meaningful when the login is an EXISTING one
          (a brand-new login isn't on AngelPay yet). */}
      {state.login.mode === 'existing' && (
        <div className="rounded-lg border border-input bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Auto-descubrir merchants vía TPV NEXGO</p>
              <p className="text-[11px] text-muted-foreground">
                {nexgoTerminal
                  ? `${nexgoTerminal.name || nexgoTerminal.serialNumber} activa — lista para descubrir merchants.`
                  : 'AngelPay necesita una terminal NEXGO activa en este venue para buscar merchants.'}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={!nexgoTerminal || tpvFetchState === 'fetching'}
              onClick={handleTpvFetch}
            >
              {tpvFetchState === 'fetching' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5 mr-1.5" />
              )}
              {tpvFetchState === 'fetching' ? 'Buscando…' : 'Buscar en TPV'}
            </Button>
          </div>
          {tpvFetchMsg && (
            <p
              className={cn(
                'text-[11px]',
                tpvFetchState === 'error'
                  ? 'text-destructive'
                  : tpvFetchState === 'done'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground',
              )}
            >
              {tpvFetchMsg}
            </p>
          )}
        </div>
      )}

      {/* Pick an existing merchant linked to this login. */}
      {loginMerchants.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">
            Esta cuenta AngelPay ya tiene merchants — úsalos o captura uno nuevo
          </Label>
          {loginMerchants.map(m => {
            const selected = draft.mode === 'existing' && draft.existingMerchantId === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => pickExisting(m)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border border-input px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors',
                  selected && 'border-foreground bg-muted/40',
                )}
              >
                <span className="min-w-0 truncate">
                  {m.displayName || m.angelpayMerchantName || 'Sin nombre'}
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    ID {m.externalMerchantId}
                  </span>
                </span>
                {selected && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
              </button>
            )
          })}
          <button
            type="button"
            onClick={switchToCreate}
            className={cn(
              'w-full rounded-lg border border-dashed border-input px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
              draft.mode === 'create' && 'border-foreground border-solid bg-muted/40',
            )}
          >
            + Capturar un merchant nuevo
          </button>
        </div>
      )}

      {/* Create form OR existing confirmation */}
      {draft.mode === 'existing' ? (
        <p className="rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          Usarás el merchant existente <strong>{draft.existingMerchantLabel}</strong>. No necesitas
          capturar datos.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">ID del merchant (numérico)</Label>
            <Input
              value={draft.externalMerchantId}
              onChange={e => setCreateField({ externalMerchantId: e.target.value.replace(/\D/g, '') })}
              placeholder="9814275"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Afiliación</Label>
              <Input
                value={draft.affiliation}
                onChange={e => setCreateField({ affiliation: e.target.value })}
                placeholder="Núm. de afiliación"
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre del merchant</Label>
              <Input
                value={draft.name}
                onChange={e =>
                  setCreateField({
                    name: e.target.value,
                    // Mirror into displayName until the operator edits it.
                    displayName: draft.displayName || e.target.value,
                  })
                }
                placeholder="Nombre del comercio"
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre para mostrar</Label>
            <Input
              value={draft.displayName}
              onChange={e => setCreateField({ displayName: e.target.value })}
              placeholder="Cómo se mostrará en el panel"
              className="h-10"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-input bg-amber-500/5 p-3">
            <Checkbox
              checked={draft.idConfirmed}
              onCheckedChange={c => setDraft(prev => ({ ...prev, idConfirmed: !!c }))}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              Confirmo que el ID{' '}
              <strong className="text-foreground">{draft.externalMerchantId || '—'}</strong> y la
              afiliación{' '}
              <strong className="text-foreground">{draft.affiliation || '—'}</strong> son
              correctos. Un error rutea pagos a un merchant equivocado.
            </span>
          </label>
        </div>
      )}

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
          disabled={!canSave}
          className="text-xs font-medium bg-foreground text-background rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          Guardar merchant
        </button>
      </div>
    </div>
  )
}
