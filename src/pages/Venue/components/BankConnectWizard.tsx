/**
 * BankConnectWizard — flujo self-connect de cuenta bancaria (OWNER).
 *
 * Pasos (espejo de la máquina de estados del backend):
 *   providers → credentials → [code 2FA | code device] → [selectAccount] → done
 * El paso siguiente SIEMPRE lo decide la respuesta del backend vía
 * stepForStatus(result.status) — el wizard no asume el orden.
 */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Building2, CheckCircle2, Loader2 } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type FinancialProvider,
  type ProviderAccountOption,
  type ConnectionStepResult,
  type FinancialConnectionStatus,
} from '@/services/financialConnection.service'
import { stepForStatus, type WizardStep } from './bankConnectSteps'
import { connectStrategyFor } from './connectStrategies'

/** Reanuda una conexión ya iniciada (estado PENDING_*) en el paso que le toca, en vez de empezar de cero. */
export interface WizardResume {
  connectionId: string
  status: FinancialConnectionStatus
  accountOptions?: ProviderAccountOption[]
}

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
  /** Si viene, el wizard abre directo en el paso de `status` con esta conexión (Continuar validación). */
  resume?: WizardResume | null
}

/** Mensaje de error legible: el backend ya responde en español; 429 tiene copy propio. */
function errorMessage(err: unknown, t: (k: string) => string): string {
  const e = err as { response?: { status?: number; data?: { message?: string } } }
  if (e?.response?.status === 429) return e.response.data?.message ?? t('wizard.errors.rateLimited')
  return e?.response?.data?.message ?? t('wizard.errors.generic')
}

export function BankConnectWizard({ open, onClose, venueId, resume }: Props) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()

  const [wizard, setWizard] = useState<WizardStep>({ step: 'providers' })
  const [provider, setProvider] = useState<FinancialProvider | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [accountOptions, setAccountOptions] = useState<ProviderAccountOption[]>([])
  const [accountKind, setAccountKind] = useState<'MERCHANT' | 'CLIENT'>('MERCHANT')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['financial-providers'],
    queryFn: financialConnectionAPI.listProviders,
    enabled: open,
  })

  const advance = (r: ConnectionStepResult) => {
    setConnectionId(r.connectionId)
    if (r.accountOptions) setAccountOptions(r.accountOptions)
    const next = stepForStatus(r.status)
    setWizard(next)
    setError(null)
    setCode('')
    if (next.step === 'done') {
      queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] })
    }
  }

  const connect = useMutation({
    mutationFn: () => financialConnectionAPI.createConnection(venueId, { providerId: provider!.id, email, password, accountKind }),
    onSuccess: advance,
    onError: err => setError(errorMessage(err, t)),
  })

  const validate = useMutation({
    mutationFn: () =>
      wizard.step === 'code' && wizard.variant === 'device'
        ? financialConnectionAPI.validateDevice(venueId, connectionId!, code)
        : financialConnectionAPI.validateTwoFactor(venueId, connectionId!, code),
    onSuccess: advance,
    onError: err => setError(errorMessage(err, t)),
  })

  const select = useMutation({
    mutationFn: (externalId: string) => financialConnectionAPI.selectAccount(venueId, connectionId!, externalId),
    // Rutea por el status que devuelve el backend (igual que las otras dos mutaciones)
    // en vez de asumir CONNECTED — si algún día select-account tuviera un paso extra,
    // el wizard lo respeta en lugar de saltar directo a "done".
    onSuccess: r => advance({ connectionId: connectionId!, status: r.status }),
    onError: err => setError(errorMessage(err, t)),
  })

  // Reanudar una conexión PENDING_*: al abrir con `resume`, saltar directo al paso que le toca
  // (código 2FA/dispositivo o selección de cuenta) con la conexión ya creada. El reto server-side
  // tiene TTL de 5 min: si expiró, el backend responde "el reto expiró; vuelve a iniciar".
  useEffect(() => {
    if (!open || !resume) return
    setConnectionId(resume.connectionId)
    setAccountOptions(resume.accountOptions ?? [])
    setWizard(stepForStatus(resume.status))
    setCode('')
    setError(null)
  }, [open, resume])

  const reset = () => {
    setWizard({ step: 'providers' })
    setProvider(null)
    setConnectionId(null)
    setAccountOptions([])
    setAccountKind('MERCHANT')
    setEmail('')
    setPassword('')
    setCode('')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const codeCopy = useMemo(() => {
    if (wizard.step !== 'code') return null
    return wizard.variant === 'twoFactor'
      ? { title: t('wizard.code.twoFactorTitle'), desc: t('wizard.code.twoFactorDesc') }
      : { title: t('wizard.code.deviceTitle'), desc: t('wizard.code.deviceDesc') }
  }, [wizard, t])

  return (
    <FullScreenModal open={open} onClose={handleClose} title={t('wizard.title')}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {wizard.step === 'providers' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('wizard.step1.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.step1.description')}</p>
            </div>
            {loadingProviders && <Loader2 className="h-5 w-5 animate-spin" />}
            {!loadingProviders && providers.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('wizard.step1.none')}</p>
            )}
            <div className="grid gap-3">
              {providers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p)
                    setWizard(connectStrategyFor(p.connectionType) === 'credential-form' ? { step: 'credentials' } : { step: 'unsupported' })
                  }}
                  className="flex items-center gap-3 rounded-2xl border-2 border-input bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {wizard.step === 'credentials' && provider && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              connect.mutate()
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">{t('wizard.step2.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.step2.description')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['MERCHANT', 'CLIENT'] as const).map(k => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={accountKind === k}
                  disabled={connect.isPending}
                  onClick={() => setAccountKind(k)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    accountKind === k ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t(`wizard.step2.kind.${k === 'MERCHANT' ? 'business' : 'personal'}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('wizard.step2.kind.hint')}</p>
            <div className="grid gap-2">
              <Label htmlFor="fc-email">{t('wizard.step2.email')}</Label>
              <Input id="fc-email" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fc-password">{t('wizard.step2.password')}</Label>
              <Input
                id="fc-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={connect.isPending || !email || !password}>
              {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connect.isPending ? t('wizard.step2.connecting') : t('wizard.step2.submit')}
            </Button>
          </form>
        )}

        {wizard.step === 'code' && codeCopy && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              validate.mutate()
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">{codeCopy.title}</h2>
              <p className="text-sm text-muted-foreground">{codeCopy.desc}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fc-code">{t('wizard.code.codeLabel')}</Label>
              <Input
                id="fc-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em]"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button type="submit" disabled={validate.isPending || code.length !== 6}>
              {validate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {validate.isPending ? t('wizard.code.validating') : t('wizard.code.submit')}
            </Button>
          </form>
        )}

        {wizard.step === 'selectAccount' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('wizard.selectAccount.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wizard.selectAccount.description')}</p>
            </div>
            <div className="grid gap-3">
              {accountOptions.map(a => (
                <button
                  key={a.externalId}
                  type="button"
                  disabled={select.isPending}
                  onClick={() => select.mutate(a.externalId)}
                  className="flex items-center justify-between rounded-2xl border-2 border-input bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{a.label ?? a.externalId}</span>
                    {a.clabe && <span className="text-xs text-muted-foreground">CLABE {a.clabe}</span>}
                  </div>
                  {a.balance != null && <Badge variant="secondary">{Currency(a.balance)}</Badge>}
                </button>
              ))}
            </div>
          </div>
        )}

        {wizard.step === 'unsupported' && provider && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Badge variant="outline">{t('wizard.unsupported.badge')}</Badge>
            <h2 className="text-lg font-semibold">{t('wizard.unsupported.title', { provider: provider.name })}</h2>
            <p className="text-sm text-muted-foreground">{t('wizard.unsupported.description')}</p>
            <Button variant="outline" onClick={() => setWizard({ step: 'providers' })}>
              {t('wizard.unsupported.back')}
            </Button>
          </div>
        )}

        {wizard.step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
            <h2 className="text-lg font-semibold">{t('wizard.done.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('wizard.done.description')}</p>
            <Button onClick={handleClose}>{t('wizard.done.close')}</Button>
          </div>
        )}
      </div>
    </FullScreenModal>
  )
}
