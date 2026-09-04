import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cake, Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PermissionGate } from '@/components/PermissionGate'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import marketingService, { type CampaignBlock } from '@/services/marketing.service'

import { CampaignBlocksEditor } from './CampaignBlocksEditor'
import { TIPOS_DE_BLOQUE } from './campaignBlocks'

/**
 * La felicitación automática de cumpleaños.
 *
 * Va como TARJETA dentro de Campañas y no como entrada propia del menú: es una campaña más
 * a ojos del dueño, sólo que la dispara el calendario en vez de él. Ponerla en otro sitio
 * lo obligaría a recordar dónde vive cada tipo de correo.
 *
 * 🔴 Tres estados, no dos, y confundirlos desinforma: **sin configurar** (nunca la tocó),
 * **pausada** (la configuró y la apagó) y **encendida**. El servidor los distingue
 * devolviendo `null` cuando no existe la fila.
 */
export function BirthdayAutomationCard({ venueId }: { venueId: string }) {
	const { t } = useTranslation('customers')
	const { toast } = useToast()
	const queryClient = useQueryClient()

	const [abierto, setAbierto] = useState(false)
	const [subject, setSubject] = useState('')
	const [daysBefore, setDaysBefore] = useState(7)
	const [activa, setActiva] = useState(false)
	const [bloques, setBloques] = useState<CampaignBlock[]>([{ type: 'paragraph', text: '' }])
	const [cargado, setCargado] = useState(false)

	const { data, isLoading } = useQuery({
		queryKey: ['birthday-automation', venueId],
		queryFn: () => marketingService.getBirthdayAutomation(venueId),
		enabled: Boolean(venueId),
	})

	const automation = data?.automation ?? null

	useEffect(() => {
		if (!abierto) {
			setCargado(false)
			return
		}
		if (cargado || isLoading) return
		if (automation) {
			setSubject(automation.subject)
			setDaysBefore(automation.daysBefore)
			setActiva(automation.status === 'ACTIVE')
			const conocidos = (automation.contentBlocks ?? []).filter(b => TIPOS_DE_BLOQUE.includes(b?.type))
			setBloques(conocidos.length ? conocidos : [{ type: 'paragraph', text: '' }])
		} else {
			// Primera vez: se propone un texto, para que no arranque de una hoja en blanco.
			setSubject(t('birthday.defaults.subject'))
			setBloques([{ type: 'paragraph', text: t('birthday.defaults.body') }])
			setDaysBefore(7)
			setActiva(false)
		}
		setCargado(true)
	}, [abierto, isLoading, automation, cargado, t])

	const guardar = useMutation({
		mutationFn: () =>
			marketingService.saveBirthdayAutomation(venueId, { subject: subject.trim(), bloques, daysBefore, activa }),
		onSuccess: () => {
			toast({ title: activa ? t('birthday.savedOn') : t('birthday.savedOff') })
			queryClient.invalidateQueries({ queryKey: ['birthday-automation', venueId] })
			setAbierto(false)
		},
		onError: (e: any) => {
			toast({ title: t('birthday.saveError'), description: e?.response?.data?.message, variant: 'destructive' })
		},
	})

	const encendida = automation?.status === 'ACTIVE'
	const puedeGuardar = subject.trim().length > 0 && bloques.length > 0 && !guardar.isPending

	return (
		<>
			<div className="rounded-2xl border border-border/50 bg-card p-4 mb-6 flex items-start gap-4">
				<div className="rounded-full bg-muted p-2.5">
					<Cake className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h2 className="font-medium">{t('birthday.title')}</h2>
						{!isLoading && (
							<Badge variant={encendida ? 'default' : 'outline'} data-testid="birthday-status">
								{/* Tres estados: sin configurar ≠ pausada. */}
								{!automation ? t('birthday.notConfigured') : encendida ? t('birthday.on') : t('birthday.paused')}
							</Badge>
						)}
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						{encendida
							? t('birthday.onDescription', { count: automation!.daysBefore })
							: t('birthday.offDescription')}
					</p>
				</div>

				<PermissionGate permission="marketing:manage">
					<Button variant="outline" size="sm" onClick={() => setAbierto(true)} data-testid="birthday-configure">
						{automation ? t('birthday.edit') : t('birthday.configure')}
					</Button>
				</PermissionGate>
			</div>

			{abierto && (
				<FullScreenModal
					open
					onClose={() => setAbierto(false)}
					title={t('birthday.title')}
					actions={
						<Button onClick={() => guardar.mutate()} disabled={!puedeGuardar} data-testid="birthday-save">
							{guardar.isPending ? t('campaigns.saving') : t('birthday.save')}
						</Button>
					}
					contentClassName="bg-muted/30"
				>
					<div className="mx-auto max-w-2xl space-y-6 p-6">
						<Alert>
							<Info className="h-4 w-4" aria-hidden="true" />
							<AlertDescription>{t('birthday.howItWorks')}</AlertDescription>
						</Alert>

						<div className="space-y-2">
							<Label htmlFor="birthday-subject">{t('campaigns.fields.subject')}</Label>
							<Input id="birthday-subject" value={subject} onChange={e => setSubject(e.target.value)} />
						</div>

						<div className="space-y-2">
							<Label htmlFor="birthday-days">{t('birthday.daysBefore')}</Label>
							<Input
								id="birthday-days"
								type="number"
								min={0}
								max={30}
								value={daysBefore}
								onChange={e => setDaysBefore(Number(e.target.value))}
								className="w-32"
							/>
							<p className="text-xs text-muted-foreground">{t('birthday.daysBeforeHelp')}</p>
						</div>

						<CampaignBlocksEditor bloques={bloques} onChange={setBloques} label={t('birthday.content')} />

						{/* 🔴 ENCENDER exige `marketing:send` en el servidor: es autorizar envíos
						    recurrentes. Quien sólo puede redactar ve el interruptor deshabilitado con
						    el porqué — nunca desaparece en silencio. */}
						<div className="rounded-2xl border border-border/50 bg-card p-4">
							<PermissionGate
								permission="marketing:send"
								fallback={
									<div className="flex items-center gap-3 opacity-60">
										<Switch checked={activa} disabled aria-label={t('birthday.turnOn')} />
										<div>
											<div className="font-medium text-sm">{t('birthday.turnOn')}</div>
											<p className="text-xs text-muted-foreground">{t('birthday.turnOnNoPermission')}</p>
										</div>
									</div>
								}
							>
								<div className="flex items-center gap-3">
									<Switch checked={activa} onCheckedChange={setActiva} data-testid="birthday-switch" aria-label={t('birthday.turnOn')} />
									<div>
										<div className="font-medium text-sm">{t('birthday.turnOn')}</div>
										<p className="text-xs text-muted-foreground">{t('birthday.turnOnHelp')}</p>
									</div>
								</div>
							</PermissionGate>
						</div>
					</div>
				</FullScreenModal>
			)}
		</>
	)
}

export default BirthdayAutomationCard
