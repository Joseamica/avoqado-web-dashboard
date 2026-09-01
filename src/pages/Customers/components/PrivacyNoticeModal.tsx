import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import marketingService, { type PrivacyNoticeLanguage } from '@/services/marketing.service'
import { useVenueDateTime } from '@/utils/datetime'

interface PrivacyNoticeModalProps {
	venueId: string
	open: boolean
	onClose: () => void
}

const LANGUAGES: PrivacyNoticeLanguage[] = ['es', 'en', 'fr']

/**
 * Editor del aviso de privacidad (fase 0 de campañas de correo a clientes).
 *
 * 🔴 El GET nunca trae el TEXTO de la versión vigente — sólo sus metadatos
 * (`id`, `contentHash`, `language`, `createdAt`). El servidor lo diseñó así a
 * propósito: `getCurrentPrivacyNotice` es un `select` sin `content`. Por eso este
 * editor no puede "precargar" el aviso guardado — se enseña CUÁNDO se guardó la
 * versión vigente y en qué idioma, y se pide el texto COMPLETO de nuevo. Cada
 * guardado crea una versión nueva; las anteriores no se pueden editar.
 */
export function PrivacyNoticeModal({ venueId, open, onClose }: PrivacyNoticeModalProps) {
	const { t } = useTranslation('customers')
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const { formatDate } = useVenueDateTime()

	const [content, setContent] = useState('')
	const [language, setLanguage] = useState<PrivacyNoticeLanguage>('es')
	// Se re-arma cada vez que el modal se abre, para no pisar lo que el usuario ya
	// escribió si la consulta tarda en resolver (ver el efecto de abajo).
	const initializedRef = useRef(false)

	const { data, isLoading } = useQuery({
		queryKey: ['privacy-notice', venueId],
		queryFn: () => marketingService.getPrivacyNotice(venueId),
		enabled: open && Boolean(venueId),
	})

	const notice = data?.notice ?? null

	useEffect(() => {
		if (!open) {
			initializedRef.current = false
			return
		}
		if (initializedRef.current || isLoading) return
		setContent('')
		setLanguage((notice?.language as PrivacyNoticeLanguage) || 'es')
		initializedRef.current = true
	}, [open, isLoading, notice?.language])

	const saveMutation = useMutation({
		mutationFn: () => marketingService.updatePrivacyNotice(venueId, { content: content.trim(), language }),
		onSuccess: () => {
			toast({ title: t('privacyNotice.saveSuccess') })
			// 🔴 MISMA llave que la query de arriba y que la de CustomerForm — si
			// difieren, "guardar" no invalida nada y el checkbox se queda apagado
			// en silencio (la trampa de caché ya documentada en el repo).
			queryClient.invalidateQueries({ queryKey: ['privacy-notice', venueId] })
			setContent('')
		},
		onError: (error: any) => {
			toast({
				title: t('privacyNotice.saveError'),
				description: error.response?.data?.message,
				variant: 'destructive',
			})
		},
	})

	const canSave = content.trim().length > 0 && !saveMutation.isPending

	return (
		<FullScreenModal
			open={open}
			onClose={onClose}
			title={t('privacyNotice.title')}
			actions={
				<Button onClick={() => saveMutation.mutate()} disabled={!canSave} data-testid="privacy-notice-save">
					{saveMutation.isPending ? t('privacyNotice.saving') : t('privacyNotice.save')}
				</Button>
			}
			contentClassName="bg-muted/30"
		>
			<div className="mx-auto max-w-2xl space-y-4 p-6">
				<p className="text-sm text-muted-foreground">{t('privacyNotice.description')}</p>

				<div className="rounded-2xl border border-border/50 bg-card p-4 text-sm" data-testid="privacy-notice-current-version">
					{isLoading ? (
						<span className="text-muted-foreground">{t('privacyNotice.loadingCurrent')}</span>
					) : notice ? (
						<span>
							{t('privacyNotice.currentVersion', {
								date: formatDate(notice.createdAt),
								language: t(`privacyNotice.languages.${notice.language}`, { defaultValue: notice.language }),
							})}
						</span>
					) : (
						<span className="text-muted-foreground">{t('privacyNotice.noVersion')}</span>
					)}
				</div>

				<Alert>
					<Info className="h-4 w-4" aria-hidden="true" />
					<AlertDescription>{t('privacyNotice.versionWarning')}</AlertDescription>
				</Alert>

				<div className="space-y-2">
					<Label htmlFor="privacy-notice-language">{t('privacyNotice.languageLabel')}</Label>
					<Select value={language} onValueChange={value => setLanguage(value as PrivacyNoticeLanguage)}>
						<SelectTrigger id="privacy-notice-language" className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LANGUAGES.map(lang => (
								<SelectItem key={lang} value={lang}>
									{t(`privacyNotice.languages.${lang}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label htmlFor="privacy-notice-content">{t('privacyNotice.contentLabel')}</Label>
					<Textarea
						id="privacy-notice-content"
						value={content}
						onChange={e => setContent(e.target.value)}
						placeholder={t('privacyNotice.contentPlaceholder')}
						rows={16}
						className="min-h-[320px] font-mono text-sm"
						data-testid="privacy-notice-textarea"
					/>
					<p className="text-xs text-muted-foreground">{t('privacyNotice.contentHelp')}</p>
				</div>
			</div>
		</FullScreenModal>
	)
}

export default PrivacyNoticeModal
