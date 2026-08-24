import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, UserCheck } from 'lucide-react'
import { DateTime } from 'luxon'

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
  const { t, i18n } = useTranslation('customers')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can } = useAccess()
  const { formatDate } = useVenueDateTime()

  /**
   * "hace 5 minutos" / "hace 3 días". Se pasa el idioma ACTIVO de la interfaz a propósito:
   * Luxon, sin locale explícito, cae al del navegador — que es justo el defecto por el que
   * esta fila mostraba "Aug 24, 2026" en una pantalla en español.
   */
  const waitingFor = (iso: string) => DateTime.fromISO(iso).setLocale(i18n.language).toRelative() ?? ''

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
                {/* Correo Y teléfono, no el primero que exista: quien aprueba tiene que reconocer
                    a la persona, y en un gimnasio o estética se identifica por teléfono. Con
                    `email ?? phone` una fila con correo escondía el único dato reconocible. */}
                <p className="truncate text-xs text-muted-foreground">
                  {[customer.email, customer.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>

              {customer.approvalRequestedAt ? (
                /* Antigüedad, no fecha absoluta. Lo accionable en una fila de espera es cuánto
                   lleva aguardando —"hace 5 min" contra "hace 3 días" cambia la urgencia—, no el
                   día del calendario, que dentro del mismo día es idéntico para todos.
                   De paso esquiva un defecto de plataforma: `formatDate` no fija idioma y cae al
                   del navegador, así que en una pantalla toda en español salía "Aug 24, 2026".
                   La fecha exacta sigue disponible en el `title`. */
                <span
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  title={formatDate(customer.approvalRequestedAt)}
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  {waitingFor(customer.approvalRequestedAt)}
                </span>
              ) : null}

              {/* Móvil: 44 px de alto y separación amplia. Medido antes del cambio, 32 px de alto
                  y 8 px entre "Aprobar" y "Rechazar" — un destructivo pegado al primario, al
                  alcance de un pulgar torpe, en la pantalla donde se decide si alguien puede
                  comprar. En escritorio vuelven a ser compactos. */}
              <div className="flex shrink-0 gap-3 sm:ml-auto sm:gap-2">
                <Button
                  size="sm"
                  className="h-11 flex-1 sm:h-8 sm:flex-none"
                  onClick={() => decideMutation.mutate({ customer, decision: 'APPROVED' })}
                  disabled={decideMutation.isPending}
                >
                  {t('approval.actions.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 flex-1 sm:h-8 sm:flex-none"
                  onClick={() => setRejecting(customer)}
                  disabled={decideMutation.isPending}
                >
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

            {/* 🔴 Qué le pasa a la persona. El diálogo pedía confirmar un acto destructivo sin
                decir qué destruye: sólo explicaba a dónde iba el motivo. Y lo que más pesa: el
                backend SÍ admite volver a aprobar, pero la bandeja lista únicamente a los
                PENDING — al rechazar, la persona desaparece y hoy no hay camino de regreso desde
                el dashboard. Callarlo volvería definitivo un clic accidental, sin aviso. */}
            <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t('approval.reject.consequence', { name: displayName(rejecting) })}
            </p>

            {/* Rótulo VISIBLE, no sólo el placeholder: al escribir la primera letra el
                placeholder se va y con él la única pista de que el motivo es opcional. */}
            <div className="space-y-1.5">
              <label htmlFor="approval-reject-reason" className="text-xs font-medium text-foreground">
                {t('approval.reject.reasonLabel')}
              </label>
              <Textarea
                id="approval-reject-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t('approval.reject.placeholder')}
                maxLength={500}
                rows={3}
              />
            </div>

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
