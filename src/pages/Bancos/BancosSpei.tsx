/**
 * Bancos → SPEI externo. Envía dinero a una CLABE de cualquier banco (no solo Moneygiver).
 * MUEVE DINERO y no tiene backend todavía (roadmap Fase B4 del plan) — el formulario es real
 * y se puede llenar para previsualizar el flujo, pero el submit queda deshabilitado con badge
 * "Muy pronto". bankingHub.service.speiService.send() SIEMPRE lanza si alguien la invocara
 * directo — nunca hay un envío que finja éxito.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { BancosEmptyState, BancosErrorState } from '@/pages/Bancos/BancosEmptyState'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { useBancosData, type BancosData } from '@/pages/Bancos/useBancosData'

const CONCEPT_MAX = 40

function SpeiForm({ accounts }: { accounts: BancosData['accounts'] }) {
  const { t } = useTranslation('financialConnections')
  const merchantAccounts = accounts.filter(a => a.connection.accountKind === 'MERCHANT')

  const [sourceAccountId, setSourceAccountId] = useState(merchantAccounts[0]?.account.id ?? '')
  const [clabe, setClabe] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [concept, setConcept] = useState('')
  const [code, setCode] = useState('')

  if (merchantAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        {t('hub.merchantOnly')}
      </div>
    )
  }

  return (
    <Card className="border-input">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{t('hub.spei.formTitle')}</CardTitle>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {t('hub.comingSoonBadge')}
          </Badge>
        </div>
        <CardDescription>{t('hub.spei.formDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="spei-source">{t('hub.spei.fields.sourceAccount')}</Label>
          <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
            <SelectTrigger id="spei-source" className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {merchantAccounts.map(({ account }) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.label ?? account.externalId}
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
              className="h-12 text-base font-mono"
              inputMode="numeric"
              maxLength={18}
              placeholder="000000000000000000"
              value={clabe}
              onChange={e => setClabe(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spei-beneficiary">{t('hub.spei.fields.beneficiaryName')}</Label>
            <Input id="spei-beneficiary" className="h-12 text-base" value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="spei-amount">{t('hub.spei.fields.amount')}</Label>
            <Input
              id="spei-amount"
              type="number"
              min={0}
              step="0.01"
              className="h-12 text-base"
              value={amount ?? ''}
              onChange={e => {
                const raw = e.target.value
                setAmount(raw === '' ? undefined : parseFloat(raw))
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="spei-code">{t('hub.spei.fields.twoFactorCode')}</Label>
            <Input
              id="spei-code"
              inputMode="numeric"
              maxLength={6}
              className="h-12 text-center text-lg tracking-[0.4em]"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="spei-concept">{t('hub.spei.fields.concept')}</Label>
          <Textarea
            id="spei-concept"
            maxLength={CONCEPT_MAX}
            rows={2}
            value={concept}
            onChange={e => setConcept(e.target.value)}
          />
          <span className="text-right text-xs text-muted-foreground">{concept.length}/{CONCEPT_MAX}</span>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">{t('hub.spei.previewNote')}</p>
          <Button disabled className="w-full sm:w-auto">
            <Send className="mr-1 h-4 w-4" />
            {t('hub.spei.submit')}
          </Button>
        </div>
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
      <BancosPageHeader
        title={
          <span className="flex items-center gap-2">
            {t('hub.spei.title')}
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {t('hub.comingSoonBadge')}
            </Badge>
          </span>
        }
        description={t('hub.spei.description')}
      />
      <FeatureGate feature="BANKING_HUB">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : isError ? (
          <BancosErrorState onRetry={refetch} />
        ) : !hasConnection || !venueId ? (
          <BancosEmptyState venueId={venueId ?? ''} hasProviders={hasProviders} pendingReconnect={hasPendingConnection} />
        ) : (
          <SpeiForm accounts={accounts} />
        )}
      </FeatureGate>
    </div>
  )
}
