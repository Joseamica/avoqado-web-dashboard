import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Trash2, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import {
  deleteAngelPayUserAccount,
  type AngelPayUserAccount,
} from '@/services/superadmin-angelpay-user-account.service'

/**
 * Compact details + delete dialog for an AngelPay account, used from the wizard's
 * Login step. Deliberately NOT the full AngelPayAccountManageSheet — PIN rotation
 * is an AngelPay-side concern, not something an operator does here. View + delete.
 */
interface AngelPayAccountDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AngelPayUserAccount
  /** Fired after a successful delete so the parent can refresh its list. */
  onDeleted?: () => void
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Activa', cls: 'bg-green-600 hover:bg-green-600' },
  PENDING_PIN: { label: 'PIN pendiente', cls: 'bg-amber-500/80 text-amber-950 hover:bg-amber-500/80' },
  PIN_ROTATION_REQUIRED: { label: 'Rotación requerida', cls: 'bg-amber-500/80 text-amber-950 hover:bg-amber-500/80' },
  SUSPENDED: { label: 'Suspendida', cls: 'bg-muted text-muted-foreground' },
  DELETED: { label: 'Eliminada', cls: 'bg-muted text-muted-foreground' },
}

export function AngelPayAccountDetailsDialog({
  open,
  onOpenChange,
  account,
  onDeleted,
}: AngelPayAccountDetailsDialogProps) {
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)

  // Merchant accounts routed through this AngelPay login. Filtered client-side
  // from the full list — there is no per-login merchant endpoint.
  const { data: allMerchants = [] } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: open,
    staleTime: 30_000,
  })
  const linkedMerchants = allMerchants.filter(m => m.angelpayUserAccountId === account.id)
  // A merchant is "complete" when it carries the AngelPay routing data.
  const merchantsComplete =
    linkedMerchants.length > 0 && linkedMerchants.every(m => !!m.externalMerchantId && !!m.angelpayAffiliation)
  const isConfigured = account.status === 'ACTIVE' && merchantsComplete
  const needsInfo = !merchantsComplete

  const deleteMutation = useMutation({
    mutationFn: () => deleteAngelPayUserAccount(account.id),
    onSuccess: () => {
      toast({ title: 'Cuenta eliminada', description: `${account.email} fue desvinculada` })
      onDeleted?.()
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'No se pudo eliminar la cuenta',
        variant: 'destructive',
      })
    },
  })

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('es-MX') : '—')
  const status = STATUS_META[account.status] ?? { label: account.status, cls: 'bg-muted text-muted-foreground' }

  const row = (label: string, value: ReactNode) => (
    <div className="flex items-center justify-between gap-4 border-b border-input py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) setConfirming(false)
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cuenta AngelPay</DialogTitle>
        </DialogHeader>

        {isConfigured ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Correctamente configurada
          </div>
        ) : needsInfo ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Falta información — sin merchant (ID/afiliación) configurado
          </div>
        ) : null}

        <div className="space-y-0.5">
          {row('Correo', account.email)}
          {row('Ambiente', <Badge variant="outline" className="text-[10px]">{account.environment}</Badge>)}
          {row('Estado', <Badge className={cn('text-[10px]', status.cls)}>{status.label}</Badge>)}
          {row('Creada', fmt(account.createdAt))}
          {row('Última validación', fmt(account.lastValidatedAt))}
        </div>

        {account.lastValidationErr && (
          <p className="flex items-start gap-1 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {account.lastValidationErr}
          </p>
        )}

        {/* Merchants routed through this login */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Merchants ({linkedMerchants.length})
          </p>
          {linkedMerchants.length === 0 ? (
            <p className="rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Esta cuenta aún no tiene un merchant configurado.
            </p>
          ) : (
            linkedMerchants.map(m => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border border-input px-3 py-2 text-xs">
                <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{m.displayName || m.angelpayMerchantName || 'Sin nombre'}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    ID {m.externalMerchantId}
                    {m.angelpayAffiliation ? ` · Afil. ${m.angelpayAffiliation}` : ''}
                  </p>
                </div>
                {!m.active && (
                  <Badge variant="secondary" className="text-[10px]">
                    Inactivo
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>

        {!confirming ? (
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar cuenta
          </Button>
        ) : (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs text-muted-foreground">
              Se desvincula <strong className="text-foreground">{account.email}</strong>. Las cuentas de comercio
              AngelPay ligadas a este login dejarán de autenticar en la TPV.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setConfirming(false)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sí, eliminar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
