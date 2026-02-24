import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CircleHelp, Star, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

const STORAGE_KEY = 'avoqado:calendar-attributes'

export interface CalendarAttributes {
	showConfirmed: boolean
	showPending: boolean
	showCancelled: boolean
	showNewCustomer: boolean
	colorByService: boolean
}

const DEFAULTS: CalendarAttributes = {
	showConfirmed: true,
	showPending: true,
	showCancelled: false,
	showNewCustomer: false,
	colorByService: false,
}

function loadAttributes(): CalendarAttributes {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored) return { ...DEFAULTS, ...JSON.parse(stored) }
	} catch { /* ignore */ }
	return DEFAULTS
}

function saveAttributes(attrs: CalendarAttributes) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(attrs))
}

interface CalendarAttributesDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (attrs: CalendarAttributes) => void
}

export function CalendarAttributesDialog({ open, onOpenChange, onSave }: CalendarAttributesDialogProps) {
	const { t } = useTranslation('reservations')

	const [attrs, setAttrs] = useState<CalendarAttributes>(DEFAULTS)

	useEffect(() => {
		if (open) setAttrs(loadAttributes())
	}, [open])

	const toggle = useCallback((key: keyof CalendarAttributes) => {
		setAttrs(prev => ({ ...prev, [key]: !prev[key] }))
	}, [])

	const handleSave = () => {
		saveAttributes(attrs)
		onSave(attrs)
		onOpenChange(false)
	}

	const attributeRows: { key: keyof CalendarAttributes; icon: React.ReactNode; label: string; description?: string; comingSoon?: boolean }[] = [
		{
			key: 'showConfirmed',
			icon: <Check className="h-4 w-4" />,
			label: t('calendarAttributes.confirmed', { defaultValue: 'Confirmada' }),
		},
		{
			key: 'showPending',
			icon: <CircleHelp className="h-4 w-4" />,
			label: t('calendarAttributes.pending', { defaultValue: 'Sin confirmar' }),
		},
		{
			key: 'showNewCustomer',
			icon: <Star className="h-4 w-4" />,
			label: t('calendarAttributes.newCustomer', { defaultValue: 'Nuevo cliente' }),
			comingSoon: true,
		},
		{
			key: 'showCancelled',
			icon: <XCircle className="h-4 w-4" />,
			label: t('calendarAttributes.showCancelled', { defaultValue: 'Consultar citas canceladas' }),
		},
		{
			key: 'colorByService',
			icon: null,
			label: t('calendarAttributes.colorByService', { defaultValue: 'Ver el calendario por servicio' }),
			description: t('calendarAttributes.colorByServiceHelp', { defaultValue: 'Asigna colores a cada servicio en el calendario.' }),
			comingSoon: true,
		},
	]

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t('calendarAttributes.title', { defaultValue: 'Atributos de la cita' })}</DialogTitle>
				</DialogHeader>

				<p className="text-sm text-muted-foreground">
					{t('calendarAttributes.subtitle', { defaultValue: '¿Qué atributos te gustaría ver en el calendario?' })}
				</p>

				<div className="divide-y divide-border">
					{attributeRows.map(row => (
						<div key={row.key} className={`flex items-center justify-between py-3 gap-3 ${row.comingSoon ? 'opacity-60' : ''}`}>
							<div className="flex items-center gap-3">
								{row.icon && (
									<span className="text-muted-foreground">{row.icon}</span>
								)}
								<div>
									<div className="flex items-center gap-2">
										<span className="text-sm">{row.label}</span>
										{row.comingSoon && (
											<Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground">
												{t('calendarAttributes.comingSoon', { defaultValue: 'Muy pronto' })}
											</Badge>
										)}
									</div>
									{row.description && (
										<p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
									)}
								</div>
							</div>
							<Switch
								checked={attrs[row.key]}
								onCheckedChange={() => toggle(row.key)}
								disabled={row.comingSoon}
							/>
						</div>
					))}
				</div>

				<DialogFooter className="pt-2">
					<Button onClick={handleSave}>
						{t('calendarAttributes.save', { defaultValue: 'Guardar' })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export { loadAttributes }
