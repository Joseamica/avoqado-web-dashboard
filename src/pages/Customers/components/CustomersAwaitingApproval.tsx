import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, UserCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PermissionGate } from '@/components/PermissionGate'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import customerService from '@/services/customer.service'
import type { CustomerAwaitingApproval } from '@/types/customer'

/**
 * Bandeja "En espera de aprobación".
 *
 * Aparece SOLO cuando hay alguien esperando: una pestaña permanente que casi siempre está
 * vacía se vuelve invisible por costumbre, y este aviso es justo el que no puede pasarse por
 * alto — mientras nadie revise, esa persona no puede reservar.
 *
 * Del más antiguo al más reciente, que es el orden en que hay que atender: en un día ocupado,
 * ordenar al revés sepulta a quien pidió en la mañana.
 */
export function CustomersAwaitingApproval({ venueId }: { venueId: string }) {
  const { t } = useTranslation('customers')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = useAccess()
  const { formatDate } = useVenueDateTime()

  const [rejecting, setRejecting] = useState<CustomerAwaitingApproval | null>(null)
  const [reason, setReason] = useState('')

  const canApprove = can('customers:approve')

  // Sin el permiso no se consulta siquiera: el endpoint respondería 403 y el error saldría en
  // una pantalla donde el usuario no puede hacer nada al respecto.
  const { data } = useQuery({
    queryKey: ['customers-awaiting-approval', venueId],
    queryFn: () => customerService.getCustomersAwaitingApproval(venueId, { pageSize: 20 }),
    enabled: Boolean(venueId) && canApprove,
  })

  const decideMutation = useMutation({
    mutationFn: (vars: { customer: CustomerAwaitingApproval; decision: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      customerService.decideCustomerApproval(venueId, vars.customer.id, {
        decision: vars.decision,
        reason: vars.reason,
        // Write-CAS: la versión que este usuario tiene EN PANTALLA. Si alguien decidió
        // mientras tanto, el server responde 409 y no se pisa su decisión.
        expectedVersion: vars.customer.approvalVersion,
      }),
    onSuccess: (_res, vars) => {
      toast({ title: vars.decision === 'APPROVED' ? t('approval.toasts.approved') : t('approval.toasts.rejected') })
      queryClient.invalidateQueries({ queryKey: ['customers-awaiting-approval', venueId] })
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      setRejecting(null)
      setReason('')
    },
    onError: (error: any) => {
      // 🔴 El 409 no es un error del usuario: alguien más ya decidió. Decirle "algo salió mal"
      // lo dejaría reintentando sobre datos viejos.
      const isConflict = error?.response?.status === 409
      toast({
        title: isConflict ? t('approval.toasts.conflict') : tCommon('error'),
        description: isConflict ? t('approval.toasts.conflictHelp') : error?.response?.data?.message || t('toasts.error'),
        variant: 'destructive',
      })
      if (isConflict) {
        // La decisión ajena ya es la buena: se cierra el diálogo y se limpia el motivo, o el
        // usuario se queda mirando un formulario de rechazo que ya no aplica a nadie.
        setRejecting(null)
        setReason('')
        queryClient.invalidateQueries({ queryKey: ['customers-awaiting-approval', venueId] })
      }
    },
  })

  const pending = data?.data ?? []
  // Nada que revisar (o el negocio no tiene la aprobación prendida) ⇒ no se pinta nada.
  if (!canApprove || pending.length === 0) return null

  const displayName = (c: CustomerAwaitingApproval) =>
    [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.phone || t('approval.unnamed')

  return (
    <>
      <Card className="mb-6 border-input" data-tour="customers-awaiting-approval">
        <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('approval.title')}</h2>
          <Badge variant="secondary">{data?.meta.total ?? pending.length}</Badge>
        </div>
        <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-6">{t('approval.description')}</p>

        <div className="divide-y divide-input border-t border-input">
          {pending.map(customer => (
            <div key={customer.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName(customer)}</p>
                <p className="truncate text-xs text-muted-foreground">{customer.email ?? customer.phone ?? '—'}</p>
              </div>

              {customer.approvalRequestedAt ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(customer.approvalRequestedAt)}
                </span>
              ) : null}

              <div className="flex shrink-0 gap-2 sm:ml-auto">
                <Button
                  size="sm"
                  onClick={() => decideMutation.mutate({ customer, decision: 'APPROVED' })}
                  disabled={decideMutation.isPending}
                >
                  {t('approval.actions.approve')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(customer)} disabled={decideMutation.isPending}>
                  {t('approval.actions.reject')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {rejecting && (
        <Dialog
          open={!!rejecting}
          onOpenChange={open => {
            // Cerrar con Escape, con la X o con clic fuera NO cancela la petición: el correo
            // saldría igual y el usuario creería que se arrepintió a tiempo. Mientras vuela,
            // el diálogo no se cierra.
            if (!open && !decideMutation.isPending) {
              setRejecting(null)
              setReason('')
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('approval.reject.title', { name: displayName(rejecting) })}</DialogTitle>
              {/* El motivo NO es una nota interna: es literalmente el texto que le llega a la
                  persona por correo. Decirlo aquí evita que alguien escriba algo que no querría
                  que el cliente leyera. */}
              {/* 🔴 Una cuenta creada por WhatsApp puede no tener correo. Prometer "se le
                  enviará por correo" a esa persona es mentira: hoy el aviso sólo sale por
                  email. Se dice lo que de verdad va a pasar. */}
              <DialogDescription>
                {rejecting.email ? t('approval.reject.description') : t('approval.reject.descriptionNoEmail')}
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('approval.reject.placeholder')}
              maxLength={500}
              rows={3}
            />

            <DialogFooter>
              <Button variant="outline" disabled={decideMutation.isPending} onClick={() => { setRejecting(null); setReason('') }}>
                {tCommon('cancel')}
              </Button>
              <PermissionGate permission="customers:approve">
                <Button
                  variant="destructive"
                  onClick={() => decideMutation.mutate({ customer: rejecting, decision: 'REJECTED', reason: reason.trim() || undefined })}
                  disabled={decideMutation.isPending}
                >
                  {decideMutation.isPending ? t('approval.reject.pending') : t('approval.actions.reject')}
                </Button>
              </PermissionGate>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default CustomersAwaitingApproval
