import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Send } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import marketingService from '@/services/marketing.service'

interface Props {
	venueId: string
	campaignId: string
	onClose: () => void
	onSent: () => void
}

/**
 * Confirmación de envío, en DOS pasos, porque mandar es irreversible y le llega a los
 * clientes del negocio.
 *
 * Paso 1 — `preview`: el SERVIDOR cuenta a cuántos les llegaría y firma un token que ata
 * el contenido, la audiencia y ese conteo.
 * Paso 2 — `publish` con ese token: si algo cambió entre medias, el servidor lo rechaza.
 *
 * 🔴 El conteo se pide al abrir el diálogo, SIEMPRE fresco. Nunca se reusa uno anterior:
 * el punto entero del token es que lo que se confirma sea lo que se manda.
 *
 * 🔴 Y la confirmación dice el NÚMERO. «¿Seguro que quieres enviar?» no le dice a nadie
 * lo que está a punto de pasar; «Enviar a 3,412 clientes» sí.
 */
export function SendCampaignDialog({ venueId, campaignId, onClose, onSent }: Props) {
	const { t } = useTranslation('customers')
	const { toast } = useToast()
	const queryClient = useQueryClient()

	const preview = useQuery({
		queryKey: ['campaign-preview', venueId, campaignId],
		queryFn: () => marketingService.previewCampaign(venueId, campaignId),
		// Sin caché: un token viejo es justo lo que este flujo existe para evitar.
		gcTime: 0,
		staleTime: 0,
		retry: false,
	})

	const enviar = useMutation({
		mutationFn: () => marketingService.publishCampaign(venueId, campaignId, preview.data!.token),
		onSuccess: () => {
			toast({ title: t('campaigns.sent', { count: preview.data?.totalDestinatarios ?? 0 }) })
			queryClient.invalidateQueries({ queryKey: ['campaigns', venueId] })
			queryClient.invalidateQueries({ queryKey: ['campaign', venueId, campaignId] })
			onClose()
			onSent()
		},
		onError: (e: any) => {
			// El servidor distingue "el contenido cambió" de un fallo cualquiera; su mensaje
			// es más útil que uno genérico nuestro, así que se muestra tal cual.
			toast({
				title: t('campaigns.sendError'),
				description: e?.response?.data?.message,
				variant: 'destructive',
			})
			// Y se pide un token nuevo: el anterior ya no vale para nada.
			preview.refetch()
		},
	})

	const total = preview.data?.totalDestinatarios ?? 0
	const sinDestinatarios = preview.isSuccess && total === 0

	return (
		<Dialog open onOpenChange={abierto => !abierto && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t('campaigns.sendDialog.title')}</DialogTitle>
					<DialogDescription>{t('campaigns.sendDialog.description')}</DialogDescription>
				</DialogHeader>

				<div className="py-2">
					{preview.isLoading && (
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
							{t('campaigns.sendDialog.counting')}
						</div>
					)}

					{preview.isError && (
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" aria-hidden="true" />
							<AlertDescription>
								{(preview.error as any)?.response?.data?.message ?? t('campaigns.sendDialog.countError')}
							</AlertDescription>
						</Alert>
					)}

					{preview.isSuccess && !sinDestinatarios && (
						<div className="rounded-2xl border border-border/50 bg-card p-4 text-center">
							<div className="text-3xl font-bold" data-testid="send-recipient-count">
								{total.toLocaleString('es-MX')}
							</div>
							<div className="text-sm text-muted-foreground mt-1">{t('campaigns.sendDialog.recipients', { count: total })}</div>
						</div>
					)}

					{sinDestinatarios && (
						<Alert>
							<AlertTriangle className="h-4 w-4" aria-hidden="true" />
							{/* Cero no es un error del sistema: es que nadie ha dado permiso todavía.
							    Decirlo así es lo que le dice al dueño qué hacer. */}
							<AlertDescription>{t('campaigns.sendDialog.noRecipients')}</AlertDescription>
						</Alert>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={enviar.isPending}>
						{t('campaigns.sendDialog.cancel')}
					</Button>
					<Button
						onClick={() => enviar.mutate()}
						disabled={!preview.isSuccess || sinDestinatarios || enviar.isPending}
						data-testid="send-confirm"
					>
						{enviar.isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
								{t('campaigns.sendDialog.sending')}
							</>
						) : (
							<>
								<Send className="h-4 w-4 mr-2" aria-hidden="true" />
								{t('campaigns.sendDialog.confirm', { count: total })}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default SendCampaignDialog
