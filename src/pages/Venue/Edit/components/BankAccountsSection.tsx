/**
 * BankAccountsSection — "Cuentas de banco" dentro de Integraciones.
 * Lista las conexiones bancarias de la sucursal con saldo en vivo.
 * Visible solo con financialConnections:manage (OWNER). El gate es UX;
 * la seguridad real la pone el backend (403/404).
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Landmark, Plus, RefreshCw, Unlink } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type FinancialAccountSummary,
  type FinancialConnectionSummary,
  type FinancialConnectionStatus,
} from '@/services/financialConnection.service'
import { BankConnectWizard } from '@/pages/Venue/components/BankConnectWizard'

const STATUS_BADGE: Record<FinancialConnectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONNECTED: 'default',
  NEEDS_REAUTH: 'destructive',
  PENDING_DEVICE_VALIDATION: 'secondary',
  PENDING_TWO_FACTOR_AUTH: 'secondary',
  PENDING_ACCOUNT_SELECTION: 'secondary',
  REVOKED: 'outline',
  ERROR: 'destructive',
}

function AccountRow({ venueId, account }: { venueId: string; account: FinancialAccountSummary }) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const refresh = useMutation({
    mutationFn: () => financialConnectionAPI.getBalance(venueId, account.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] }),
    onError: () => toast({ title: t('account.balanceError'), variant: 'destructive' }),
  })

  const synced = account.lastSyncedAt
    ? t('account.lastSynced', { when: new Date(account.lastSyncedAt).toLocaleString() })
    : t('account.neverSynced')

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{account.label ?? account.externalId}</span>
        {account.clabe && <span className="text-xs text-muted-foreground">CLABE {account.clabe}</span>}
        <span className="text-xs text-muted-foreground">{synced}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tabular-nums">
          {account.lastBalance != null ? Currency(account.lastBalance) : t('account.noBalance')}
        </span>
        {account.balanceState !== 'OK' && <Badge variant="destructive">{t(`account.balanceState.${account.balanceState}`)}</Badge>}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('account.refresh')}
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )
}

function ConnectionCard({
  venueId,
  connection,
  onReconnect,
}: {
  venueId: string
  connection: FinancialConnectionSummary
  onReconnect: () => void
}) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const disconnect = useMutation({
    mutationFn: () => financialConnectionAPI.disconnect(venueId, connection.id),
    onSuccess: () => {
      toast({ title: t('actions.disconnected') })
      queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] })
    },
  })

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="font-medium">{connection.provider.name}</span>
          <Badge variant={STATUS_BADGE[connection.status]}>{t(`status.${connection.status}`)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {connection.status === 'NEEDS_REAUTH' && (
            <Button variant="outline" size="sm" onClick={onReconnect}>
              {t('actions.reconnect')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <Unlink className="mr-1 h-4 w-4" />
            {t('actions.disconnect')}
          </Button>
        </div>
      </div>
      {connection.accounts.map(a => (
        <AccountRow key={a.id} venueId={venueId} account={a} />
      ))}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.disconnectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('actions.disconnectDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate()}>{t('actions.disconnectConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function BankAccountsSection() {
  const { t } = useTranslation('financialConnections')
  const { venueId } = useCurrentVenue()
  const [wizardOpen, setWizardOpen] = useState(false)

  const {
    data: connections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['financial-connections', venueId],
    queryFn: () => financialConnectionAPI.listConnections(venueId!),
    enabled: !!venueId,
  })

  // Filas REVOKED/ERROR son residuos operativos (intentos fallidos, cuentas
  // desconectadas): no se listan — el dueño solo ve conexiones vivas o accionables.
  const visible = (connections ?? []).filter(c => c.status !== 'REVOKED' && c.status !== 'ERROR')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('section.title')}</CardTitle>
            <CardDescription>{t('section.description')}</CardDescription>
          </div>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('section.connectCta')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {isError && <p className="text-sm text-destructive">{t('section.loadError')}</p>}
        {!isLoading && !isError && visible.length === 0 && <p className="text-sm text-muted-foreground">{t('section.empty')}</p>}
        {visible.map(c => (
          <ConnectionCard key={c.id} venueId={venueId!} connection={c} onReconnect={() => setWizardOpen(true)} />
        ))}
      </CardContent>
      {venueId && <BankConnectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} venueId={venueId} />}
    </Card>
  )
}
