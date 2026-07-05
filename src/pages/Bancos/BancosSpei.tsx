/**
 * Bancos → SPEI externo. Envía dinero REAL a una CLABE de cualquier banco (no solo el conectado).
 * Flujo espejo de BankInternalTransferDialog (form → confirmación explícita → resultado), con
 * candados extra porque el destino es un banco ajeno no verificable de antemano:
 *  - CLABE validada con dígito verificador EN VIVO (utils/clabe) antes de habilitar "Revisar".
 *  - Banco destino del catálogo real del proveedor, autosugerido por el prefijo de la CLABE.
 *  - Advertencia fuerte de irreversibilidad en la confirmación; botón deshabilitado al enviar.
 * El backend agrega idempotencyKey del proveedor + dedup por contenido + auditoría + rate limit.
 * Solo cuentas PERSONALES (guard backend + UI, igual que Transferencias internas).
 */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/utils/currency'
import { isValidClabe } from '@/utils/clabe'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { BancosEmptyState, BancosErrorState } from '@/pages/Bancos/BancosEmptyState'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { useBancosData, type BancosData } from '@/pages/Bancos/useBancosData'
import { financialConnectionAPI, type SpeiOutResult } from '@/services/financialConnection.service'

const CONCEPT_MAX = 40

type Phase = 'form' | 'confirm' | 'done'

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { data?: { message?: string }; message?: string } } }
  return e?.response?.data?.data?.message ?? e?.response?.data?.message ?? fallback
}

function SpeiForm({ venueId, accounts }: { venueId: string; accounts: BancosData['accounts'] }) {
  const { t } = useTranslation('financialConnections')
  // Solo cuentas PERSONALES cuya conexión tiene UNA sola cuenta: el proveedor debita por la
  // identidad del USUARIO, no por la cuenta elegida — en conexiones multi-cuenta el dinero
  // podría salir de otra cuenta. El backend lo rechaza igual; aquí ni se ofrece.
  const eligibleAccounts = accounts.filter(a => a.connection.accountKind === 'CLIENT' && a.connection.accounts.length === 1)
  const hasExcludedMultiAccount = accounts.some(a => a.connection.accountKind === 'CLIENT' && a.connection.accounts.length > 1)

  const [sourceAccountId, setSourceAccountId] = useState(eligibleAccounts[0]?.account.id ?? '')
  const [clabe, setClabe] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [idBanco, setIdBanco] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('form')
  // Una key por INTENTO de envío (se genera al entrar a la confirmación): el retry automático
  // de POST de api.ts reenvía la misma → la idempotencia del proveedor absorbe el duplicado.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const [result, setResult] = useState<SpeiOutResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sourceAccount = eligibleAccounts.find(a => a.account.id === sourceAccountId)?.account ?? eligibleAccounts[0]?.account

  // Catálogo real de bancos del proveedor — puebla el selector de banco destino.
  const banks = useQuery({
    queryKey: ['spei-banks', sourceAccount?.id],
    queryFn: () => financialConnectionAPI.listSpeiBanks(venueId, sourceAccount!.id),
    enabled: !!sourceAccount,
  })

  const clabeComplete = clabe.length === 18
  const clabeOk = isValidClabe(clabe)
  const amountNum = Number(amount)

  // Autosugerir el banco por el prefijo institucional de la CLABE (3 primeros dígitos) —
  // el usuario puede corregirlo a mano si el catálogo trae otro mapeo.
  useEffect(() => {
    if (!clabeOk || idBanco != null || !banks.data) return
    const prefix = Number(clabe.slice(0, 3))
    const match = banks.data.find(b => b.clabePrefix === prefix)
    if (match) setIdBanco(match.idBanco)
  }, [clabeOk, clabe, idBanco, banks.data])

  const canReview = clabeOk && beneficiaryName.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0 && idBanco != null

  const send = useMutation({
    mutationFn: () =>
      financialConnectionAPI.sendSpeiOut(venueId, sourceAccount!.id, {
        destinationClabe: clabe,
        beneficiaryName: beneficiaryName.trim(),
        idBanco: idBanco!,
        amount: amountNum,
        concept: concept.trim(),
        idempotencyKey: idempotencyKey!,
      }),
    onSuccess: r => {
      setResult(r)
      setError(null)
      setPhase('done')
    },
    onError: err => {
      setError(errorMessage(err, t('hub.spei.errorTitle')))
      setPhase('done')
    },
  })

  const resetAll = () => {
    setClabe('')
    setBeneficiaryName('')
    setAmount('')
    setConcept('')
    setIdBanco(null)
    setIdempotencyKey(null)
    setResult(null)
    setError(null)
    setPhase('form')
  }

  const bankName = banks.data?.find(b => b.idBanco === idBanco)?.name ?? null
  const amountLabel = useMemo(() => (Number.isFinite(amountNum) && amountNum > 0 ? Currency(amountNum) : '—'), [amountNum])

  if (eligibleAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        {hasExcludedMultiAccount ? t('hub.spei.multiAccountUnavailable') : t('hub.personalOnly')}
      </div>
    )
  }

  return (
    <Card className="border-input">
      <CardHeader>
        <CardTitle>{t('hub.spei.formTitle')}</CardTitle>
        <CardDescription>{t('hub.spei.formDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {phase === 'form' && (
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              if (canReview) {
                // Nueva key por cada intento que llega a confirmación — un reintento del MISMO
                // intento (retry HTTP) reusa esta; regresar al form y volver a confirmar genera otra.
                setIdempotencyKey(crypto.randomUUID())
                setPhase('confirm')
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="spei-source">{t('hub.spei.fields.sourceAccount')}</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger id="spei-source" className="h-12 text-base" data-tour="spei-source-account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleAccounts.map(({ account }) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label ?? account.externalId}
                      {account.lastBalance != null ? ` · ${Currency(account.lastBalance)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="spei-clabe">{t('hub.spei.fields.clabe')}</Label>
                <Input
                  id="spei-clabe"
                  data-tour="spei-clabe"
                  className="h-12 text-base font-mono"
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="000000000000000000"
                  value={clabe}
                  onChange={e => {
                    setClabe(e.target.value.replace(/\D/g, ''))
                    setIdBanco(null) // re-sugerir banco al cambiar la CLABE
                  }}
                />
                {clabeComplete && !clabeOk && <p className="text-xs text-destructive">{t('hub.spei.clabeInvalid')}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spei-bank">{t('hub.spei.fields.bank')}</Label>
                <Select
                  value={idBanco != null ? String(idBanco) : ''}
                  onValueChange={v => setIdBanco(Number(v))}
                  disabled={banks.isLoading || banks.isError}
                >
                  <SelectTrigger id="spei-bank" className="h-12 text-base" data-tour="spei-bank">
                    <SelectValue placeholder={banks.isLoading ? t('hub.spei.banksLoading') : t('hub.spei.fields.bankPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(banks.data ?? []).map(b => (
                      <SelectItem key={b.idBanco} value={String(b.idBanco)}>
                        {b.name ?? String(b.idBanco)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {banks.isError && (
                  <p className="text-xs text-destructive">
                    {t('hub.spei.banksLoadError')}{' '}
                    <button type="button" className="cursor-pointer underline" onClick={() => banks.refetch()}>
                      {t('hub.error.retry')}
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="spei-beneficiary">{t('hub.spei.fields.beneficiaryName')}</Label>
                <Input
                  id="spei-beneficiary"
                  data-tour="spei-beneficiary-name"
                  className="h-12 text-base"
                  value={beneficiaryName}
                  onChange={e => setBeneficiaryName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spei-amount">{t('hub.spei.fields.amount')}</Label>
                <Input
                  id="spei-amount"
                  data-tour="spei-amount"
                  inputMode="decimal"
                  className="h-12 text-base"
                  value={amount}
                  // Coma decimal → punto ("150,50" sería 15050 si solo se eliminara la coma).
                  onChange={e => setAmount(e.target.value.replace(/,/g, '.').replace(/[^\d.]/g, ''))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="spei-concept">{t('hub.spei.fields.concept')}</Label>
              <Input
                id="spei-concept"
                data-tour="spei-concept"
                className="h-12 text-base"
                maxLength={CONCEPT_MAX}
                value={concept}
                onChange={e => setConcept(e.target.value)}
              />
              <span className="text-right text-xs text-muted-foreground">
                {concept.length}/{CONCEPT_MAX}
              </span>
            </div>

            <Button type="submit" data-tour="spei-review-btn" disabled={!canReview} className="w-full sm:w-auto">
              <Send className="mr-1 h-4 w-4" />
              {t('hub.spei.review')}
            </Button>
          </form>
        )}

        {phase === 'confirm' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t('hub.spei.confirmLead')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{amountLabel}</p>
              <p className="mt-3 text-base font-medium">{beneficiaryName.trim()}</p>
              <p className="font-mono text-xs text-muted-foreground">CLABE {clabe}</p>
              {/* El banco SIEMPRE visible en la confirmación (fallback al código) — el usuario
                  debe poder cachar una autosugerencia equivocada antes de enviar. */}
              <p className="text-sm text-muted-foreground">{bankName ?? `${t('hub.spei.fields.bank')}: ${idBanco}`}</p>
              <p className="mt-3 text-xs font-medium text-destructive">{t('hub.spei.irreversibleWarning')}</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" disabled={send.isPending} onClick={() => setPhase('form')}>
                {t('hub.spei.back')}
              </Button>
              <Button data-tour="spei-send-btn" disabled={send.isPending} onClick={() => send.mutate()}>
                {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {send.isPending ? t('hub.spei.sending') : t('hub.spei.send')}
              </Button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {error || (result && !result.ok) ? (
              <>
                <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
                <p className="font-medium">{t('hub.spei.errorTitle')}</p>
                <p className="text-sm text-muted-foreground">{error ?? result?.message}</p>
                <p className="text-xs text-muted-foreground">{t('hub.spei.errorHint')}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <p className="font-medium">{t('hub.spei.successTitle')}</p>
                {result?.operationId && <p className="text-sm text-muted-foreground">{t('hub.spei.successBody', { id: result.operationId })}</p>}
              </>
            )}
            <Button className="w-full sm:w-auto" onClick={resetAll}>
              {t('hub.spei.newSend')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function BancosSpei() {
  const { t } = useTranslation('financialConnections')
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')
  const { venueId, accounts, hasConnection, hasPendingConnection, hasProviders, isLoading, isError, refetch } = useBancosData({
    enabled: hasAccess,
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader title={t('hub.spei.title')} description={t('hub.spei.description')} />
      <FeatureGate feature="BANKING_HUB">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : isError ? (
          <BancosErrorState onRetry={refetch} />
        ) : !hasConnection || !venueId ? (
          <BancosEmptyState venueId={venueId ?? ''} hasProviders={hasProviders} pendingReconnect={hasPendingConnection} />
        ) : (
          <SpeiForm venueId={venueId} accounts={accounts} />
        )}
      </FeatureGate>
    </div>
  )
}
