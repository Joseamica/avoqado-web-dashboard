/**
 * BankConnectWizard — flujo self-connect de cuenta bancaria (OWNER).
 *
 * Pasos (espejo de la máquina de estados del backend):
 *   providers → credentials → [code 2FA | code device] → [selectAccount] → done
 * El paso siguiente SIEMPRE lo decide la respuesta del backend vía
 * stepForStatus(result.status) — el wizard no asume el orden.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Building2, CheckCircle2, Loader2 } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type FinancialProvider,
  type ProviderAccountOption,
  type ConnectionStepResult,
} from '@/services/financialConnection.service'
import { stepForStatus, type WizardStep } from './bankConnectSteps'

interface Props {
  open: boolean
  onClose: () => void
  venueId: string
}

/** Mensaje de error legible: el backend ya responde en español; 429 tiene copy propio. */
function errorMessage(err: unknown, t: (k: string) => string): string {
  const e = err as { response?: { status?: number; data?: { message?: string } } }
  if (e?.response?.status === 429) return e.response.data?.message ?? t('wizard.errors.rateLimited')
  return e?.response?.data?.message ?? t('wizard.errors.generic')
}

export function BankConnectWizard({ open, onClose, venueId }: Props) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()

  const [wizard, setWizard] = useState<WizardStep>({ step: 'providers' })
  const [provider, setProvider] = useState<FinancialProvider | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [accountOptions, setAccountOptions] = useState<ProviderAccountOption[]>([])
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
    mutationFn: () => financialConnectionAPI.createConnection(venueId, { providerId: provider!.id, email, password }),
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
    onSuccess: () => advance({ connectionId: connectionId!, status: 'CONNECTED' }),
    onError: err => setError(errorMessage(err, t)),
  })

  const reset = () => {
    setWizard({ step: 'providers' })
    setProvider(null)
    setConnectionId(null)
    setAccountOptions([])
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
                    setWizard({ step: 'credentials' })
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
