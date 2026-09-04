import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PermissionGate } from '@/components/PermissionGate'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import marketingService, {
	type CampaignAudience,
	type CampaignBlock,
	type UpsertCampaignRequest,
} from '@/services/marketing.service'

import { CampaignBlocksEditor } from './CampaignBlocksEditor'
import { TIPOS_DE_BLOQUE } from './campaignBlocks'
import { SendCampaignDialog } from './SendCampaignDialog'

interface Props {
	venueId: string
	/** `null` = campaña nueva. */
	campaignId: string | null
	open: boolean
	onClose: () => void
}

/**
 * Editor de una campaña. El contenido se arma por BLOQUES y el SERVIDOR los renderiza a
 * HTML — aquí no se escribe HTML en ningún punto, así que no hay nada que sanitizar.
 *
 * 🔴 Enviar NO vive en este modal: vive en `SendCampaignDialog`, detrás de
 * `marketing:send`, que NO se hereda de `marketing:manage`. Quien puede escribir la
 * campaña no necesariamente puede mandársela a los clientes del negocio.
 */
export function CampaignEditorModal({ venueId, campaignId, open, onClose }: Props) {
	const { t } = useTranslation('customers')
	const { toast } = useToast()
	const queryClient = useQueryClient()

	const [name, setName] = useState('')
	const [subject, setSubject] = useState('')
	const [audience, setAudience] = useState<CampaignAudience>('ALL_CONSENTED')
	const [bloques, setBloques] = useState<CampaignBlock[]>([{ type: 'paragraph', text: '' }])
	const [mandando, setMandando] = useState(false)
	const [cargado, setCargado] = useState(false)

	const { data: campana, isLoading } = useQuery({
		queryKey: ['campaign', venueId, campaignId],
		queryFn: () => marketingService.getCampaign(venueId, campaignId!),
		enabled: open && Boolean(campaignId),
	})

	useEffect(() => {
		if (!open) {
			setCargado(false)
			return
		}
		if (cargado || isLoading) return
		if (campana) {
			setName(campana.name)
			setSubject(campana.subject)
			setAudience(campana.audience)
			// Un bloque de un tipo que esta versión no conoce se IGNORA, nunca revienta la
			// pantalla: es la misma postura que los anuncios, y lo que deja publicar tipos
			// nuevos sin romper a quien todavía no recargó.
			const conocidos = (campana.contentBlocks ?? []).filter(b => TIPOS_DE_BLOQUE.includes(b?.type))
			setBloques(conocidos.length ? conocidos : [{ type: 'paragraph', text: '' }])
		}
		setCargado(true)
	}, [open, isLoading, campana, cargado])

	const guardar = useMutation({
		mutationFn: () => {
			const cuerpo: UpsertCampaignRequest = { name: name.trim(), subject: subject.trim(), bloques, audience }
			return campaignId
				? marketingService.updateCampaign(venueId, campaignId, cuerpo)
				: marketingService.createCampaign(venueId, cuerpo)
		},
		onSuccess: () => {
			toast({ title: t('campaigns.saved') })
			queryClient.invalidateQueries({ queryKey: ['campaigns', venueId] })
			if (campaignId) queryClient.invalidateQueries({ queryKey: ['campaign', venueId, campaignId] })
			onClose()
		},
		onError: (e: any) => {
			toast({ title: t('campaigns.saveError'), description: e?.response?.data?.message, variant: 'destructive' })
		},
	})

	const sePuedeGuardar =
		name.trim().length > 0 && subject.trim().length > 0 && bloques.length > 0 && !guardar.isPending

	// Ya enviada: se puede abrir para ver, no para editar.
	const soloLectura = Boolean(campana && campana.status !== 'DRAFT' && campana.status !== 'SCHEDULED')

	return (
		<FullScreenModal
			open={open}
			onClose={onClose}
			title={campaignId ? t('campaigns.editTitle') : t('campaigns.newTitle')}
			actions={
				soloLectura ? null : (
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={() => guardar.mutate()} disabled={!sePuedeGuardar}>
							{guardar.isPending ? t('campaigns.saving') : t('campaigns.saveDraft')}
						</Button>
						{/* 🔴 Mandar exige su PROPIO permiso, y sólo sobre una campaña ya guardada:
						    el servidor firma el token contra lo que tiene almacenado. */}
						<PermissionGate permission="marketing:send">
							<Button onClick={() => setMandando(true)} disabled={!campaignId || guardar.isPending}>
								<Send className="h-4 w-4 mr-2" />
								{t('campaigns.send')}
							</Button>
						</PermissionGate>
					</div>
				)
			}
			contentClassName="bg-muted/30"
		>
			<div className="mx-auto max-w-2xl space-y-6 p-6">
				<div className="space-y-2">
					<Label htmlFor="campaign-name">{t('campaigns.fields.name')}</Label>
					<Input
						id="campaign-name"
						value={name}
						onChange={e => setName(e.target.value)}
						placeholder={t('campaigns.fields.namePlaceholder')}
						disabled={soloLectura}
					/>
					<p className="text-xs text-muted-foreground">{t('campaigns.fields.nameHelp')}</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="campaign-subject">{t('campaigns.fields.subject')}</Label>
					<Input
						id="campaign-subject"
						value={subject}
						onChange={e => setSubject(e.target.value)}
						placeholder={t('campaigns.fields.subjectPlaceholder')}
						disabled={soloLectura}
					/>
					<p className="text-xs text-muted-foreground">{t('campaigns.fields.subjectHelp')}</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="campaign-audience">{t('campaigns.fields.audience')}</Label>
					<Select value={audience} onValueChange={v => setAudience(v as CampaignAudience)} disabled={soloLectura}>
						<SelectTrigger id="campaign-audience">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{/* GROUP y TAGS necesitan un selector propio: quedan fuera hasta que exista. */}
							<SelectItem value="ALL_CONSENTED">{t('campaigns.audience.ALL_CONSENTED')}</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">{t('campaigns.fields.audienceHelp')}</p>
				</div>

				<CampaignBlocksEditor bloques={bloques} onChange={setBloques} soloLectura={soloLectura} />
			</div>

			{mandando && campaignId && (
				<SendCampaignDialog venueId={venueId} campaignId={campaignId} onClose={() => setMandando(false)} onSent={onClose} />
			)}
		</FullScreenModal>
	)
}

export default CampaignEditorModal
