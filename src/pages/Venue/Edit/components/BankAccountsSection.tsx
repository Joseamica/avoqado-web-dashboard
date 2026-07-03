/**
 * BankAccountsSection — "Cuentas de banco" dentro de Integraciones.
 * Lista las conexiones bancarias de la sucursal con saldo en vivo.
 * Visible solo con financialConnections:manage (OWNER). El gate es UX;
 * la seguridad real la pone el backend (403/404).
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Landmark, Plus, RefreshCw, Unlink } from 'lucide-react'

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
import { BankConnectWizard, type WizardResume } from '@/pages/Venue/components/BankConnectWizard'
import { BankAccountMovementsSheet } from './BankAccountMovementsSheet'
import { BankInternalTransferDialog } from './BankInternalTransferDialog'

// Estados a mitad de flujo: la conexión existe pero aún no está lista para usarse.
// Se pueden RETOMAR (botón "Continuar") reabriendo el wizard en el paso que les toca.
const RESUMABLE_STATUS: ReadonlySet<FinancialConnectionStatus> = new Set([
  'PENDING_TWO_FACTOR_AUTH',
  'PENDING_DEVICE_VALIDATION',
  'PENDING_ACCOUNT_SELECTION',
])

const STATUS_BADGE: Record<FinancialConnectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONNECTED: 'default',
  // NEEDS_REAUTH es recuperable y ya trae botón "Reconectar" al lado: badge sobrio (outline),
  // no el rojo destructivo que gritaba y se veía mal al partirse en dos líneas.
  NEEDS_REAUTH: 'outline',
  PENDING_DEVICE_VALIDATION: 'secondary',
  PENDING_TWO_FACTOR_AUTH: 'secondary',
  PENDING_ACCOUNT_SELECTION: 'secondary',
  REVOKED: 'outline',
  ERROR: 'destructive',
}

function AccountRow({
  venueId,
  account,
  canTransfer,
  onOpen,
}: {
  venueId: string
  account: FinancialAccountSummary
  canTransfer: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [transferOpen, setTransferOpen] = useState(false)

  const refresh = useMutation({
    mutationFn: () => financialConnectionAPI.getBalance(venueId, account.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] }),
    onError: () => toast({ title: t('account.balanceError'), variant: 'destructive' }),
  })

  const synced = account.lastSyncedAt
    ? t('account.lastSynced', { when: new Date(account.lastSyncedAt).toLocaleString() })
    : t('account.neverSynced')

  return (
    <div className="flex items-center justify-between rounded-lg border border-input p-3">
      <button type="button" onClick={onOpen} aria-label={t('movements.openAria')} className="flex min-w-0 flex-1 flex-col text-left cursor-pointer">
        <span className="text-sm font-medium">{account.label ?? account.externalId}</span>
        {account.clabe && <span className="text-xs text-muted-foreground">CLABE {account.clabe}</span>}
        <span className="text-xs text-muted-foreground">{synced}</span>
      </button>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tabular-nums">
          {account.lastBalance != null ? Currency(account.lastBalance) : t('account.noBalance')}
        </span>
        {account.balanceState !== 'OK' && <Badge variant="destructive">{t(`account.balanceState.${account.balanceState}`)}</Badge>}
        {canTransfer && (
          <Button variant="ghost" size="icon" aria-label={t('transfer.button')} onClick={() => setTransferOpen(true)}>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        )}
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
      {canTransfer && (
        <BankInternalTransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} venueId={venueId} account={account} />
      )}
    </div>
  )
}

function ConnectionCard({
  venueId,
  connection,
  onReconnect,
  onContinue,
}: {
  venueId: string
  connection: FinancialConnectionSummary
  onReconnect: () => void
  onContinue: (resume: WizardResume) => void
}) {
  const { t } = useTranslation('financialConnections')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [movementsAccount, setMovementsAccount] = useState<FinancialAccountSummary | null>(null)

  const disconnect = useMutation({
    mutationFn: () => financialConnectionAPI.disconnect(venueId, connection.id),
    onSuccess: () => {
      toast({ title: t('actions.disconnected') })
      queryClient.invalidateQueries({ queryKey: ['financial-connections', venueId] })
    },
  })

  const resumable = RESUMABLE_STATUS.has(connection.status)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-input p-4">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Landmark className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-medium">{connection.provider.name}</span>
          <Badge variant={STATUS_BADGE[connection.status]} className="shrink-0 whitespace-nowrap">
            {t(`status.${connection.status}`)}
          </Badge>
          {connection.accountKind === 'CLIENT' && (
            <Badge variant="outline" className="shrink-0 whitespace-nowrap">
              {t('wizard.step2.kind.badge')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connection.status === 'NEEDS_REAUTH' && (
            <Button variant="outline" size="sm" onClick={onReconnect}>
              {t('actions.reconnect')}
            </Button>
          )}
          {resumable && (
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                onContinue({
                  connectionId: connection.id,
                  status: connection.status,
                  // Para la reanudación de selección de cuenta, las cuentas ya están persistidas.
                  accountOptions:
                    connection.status === 'PENDING_ACCOUNT_SELECTION'
                      ? connection.accounts.map(a => ({ externalId: a.externalId, label: a.label, clabe: a.clabe, balance: a.lastBalance }))
                      : undefined,
                })
              }
            >
              {t('actions.continue')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <Unlink className="mr-1 h-4 w-4" />
            {t('actions.disconnect')}
          </Button>
        </div>
      </div>
      {connection.accounts.map(a => (
        <AccountRow
          key={a.id}
          venueId={venueId}
          account={a}
          canTransfer={connection.status === 'CONNECTED' && connection.accountKind !== 'CLIENT'}
          onOpen={() => setMovementsAccount(a)}
        />
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
      {movementsAccount && (
        <BankAccountMovementsSheet
          open={!!movementsAccount}
          onClose={() => setMovementsAccount(null)}
          venueId={venueId}
          account={movementsAccount}
        />
      )}
    </div>
  )
}

/**
 * `enabled` gatea la query: cuando el hub Bancos lo monta detrás del FeatureGate PRO para un
 * venue sin acceso, no debe golpear el backend bancario ni exponer datos reales tras el blur.
 * `hideHeader` oculta el CardHeader propio (título + botón "Conectar banco") cuando la página
 * del hub ya provee su propio encabezado y CTA (evita el doble header). Default: uso directo.
 */
export function BankAccountsSection({ enabled = true, hideHeader = false }: { enabled?: boolean; hideHeader?: boolean } = {}) {
  const { t } = useTranslation('financialConnections')
  const { venueId } = useCurrentVenue()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [resume, setResume] = useState<WizardResume | null>(null)

  const {
    data: connections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['financial-connections', venueId],
    queryFn: () => financialConnectionAPI.listConnections(venueId!),
    enabled: enabled && !!venueId,
  })

  // Filas REVOKED/ERROR son residuos operativos (intentos fallidos, cuentas
  // desconectadas): no se listan — el dueño solo ve conexiones vivas o accionables.
  const visible = (connections ?? []).filter(c => c.status !== 'REVOKED' && c.status !== 'ERROR')

  return (
    <Card>
      {!hideHeader && (
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
      )}
      <CardContent className={hideHeader ? 'flex flex-col gap-3 pt-6' : 'flex flex-col gap-3'}>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {isError && <p className="text-sm text-destructive">{t('section.loadError')}</p>}
        {!isLoading && !isError && visible.length === 0 && <p className="text-sm text-muted-foreground">{t('section.empty')}</p>}
        {visible.map(c => (
          <ConnectionCard
            key={c.id}
            venueId={venueId!}
            connection={c}
            onReconnect={() => {
              setResume(null)
              setWizardOpen(true)
            }}
            onContinue={r => {
              setResume(r)
              setWizardOpen(true)
            }}
          />
        ))}
      </CardContent>
      {venueId && (
        <BankConnectWizard
          open={wizardOpen}
          onClose={() => {
            setWizardOpen(false)
            setResume(null)
          }}
          venueId={venueId}
          resume={resume}
        />
      )}
    </Card>
  )
}
