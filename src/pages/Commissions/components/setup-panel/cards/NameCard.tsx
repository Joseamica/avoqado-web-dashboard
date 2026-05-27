import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parse, isValid as isValidDate } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { Tag, CalendarIcon, Infinity } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { CommissionSetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'
import { isCardValid } from '../useSetupReducer'
import SetupCard from '../SetupCard'

function toDate(isoStr: string): Date | undefined {
	if (!isoStr) return undefined
	const d = parse(isoStr, 'yyyy-MM-dd', new Date())
	return isValidDate(d) ? d : undefined
}

function toISO(date: Date | undefined): string {
	return date ? format(date, 'yyyy-MM-dd') : ''
}

interface NameCardProps {
	state: CommissionSetupState
	dispatch: (action: SetupAction) => void
}

export default function NameCard({ state, dispatch }: NameCardProps) {
	const { t, i18n } = useTranslation('commissions')
	const [open, setOpen] = useState(false)
	const [localName, setLocalName] = useState(state.name.value)
	const [localFrom, setLocalFrom] = useState<Date | undefined>(
		toDate(state.name.effectiveFrom ?? '')
	)
	const [localTo, setLocalTo] = useState<Date | undefined>(
		toDate(state.name.effectiveTo ?? '')
	)
	const [indefinite, setIndefinite] = useState(!state.name.effectiveTo)

	const locale = i18n.language === 'es' ? es : enUS

	const valid = isCardValid(state, 'name')
	const description = valid ? state.name.value : t('setup.name.pending')

	const handleOpen = () => {
		setLocalName(state.name.value)
		setLocalFrom(toDate(state.name.effectiveFrom ?? ''))
		const to = toDate(state.name.effectiveTo ?? '')
		setLocalTo(to)
		setIndefinite(!state.name.effectiveTo)
		setOpen(true)
	}

	const handleSave = () => {
		dispatch({
			type: 'SET_NAME',
			data: {
				value: localName.trim(),
				effectiveFrom: toISO(localFrom) || null,
				effectiveTo: indefinite ? null : toISO(localTo) || null,
			},
		})
		setOpen(false)
	}

	const formatDisplay = (date: Date | undefined) => {
		if (!date) return null
		return format(date, 'd MMM yyyy', { locale })
	}

	return (
		<>
			<SetupCard
				icon={Tag}
				title={t('setup.name.title')}
				description={description}
				isValid={valid}
				isRequired
				dataTour="commission-setup-name"
				onClick={handleOpen}
			/>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>{t('setup.name.title')}</DialogTitle>
					</DialogHeader>

					<div className="space-y-5 py-2">
						{/* Name */}
						<div className="space-y-2">
							<Label>{t('setup.name.label')}</Label>
							<Input
								value={localName}
								onChange={(e) => setLocalName(e.target.value)}
								placeholder={t('setup.name.placeholder')}
								autoFocus
							/>
						</div>

						{/* Dates section */}
						<div className="space-y-3">
							<Label className="text-sm font-medium">
								{t('setup.name.validitySection')}
							</Label>

							<div className="grid grid-cols-2 gap-3">
								{/* From */}
								<div className="space-y-1.5">
									<Label className="text-xs text-muted-foreground">
										{t('setup.name.from')}
									</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												className={cn(
													'w-full justify-start text-left font-normal h-10',
													!localFrom && 'text-muted-foreground'
												)}
											>
												<CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
												<span className="truncate text-sm">
													{formatDisplay(localFrom) ||
														t('setup.name.pickDate')}
												</span>
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="w-auto p-0"
											align="start"
											sideOffset={4}
										>
											<Calendar
												mode="single"
												selected={localFrom}
												onSelect={setLocalFrom}
												locale={locale}
												initialFocus
											/>
											{localFrom && (
												<div className="border-t border-border px-3 py-2">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-7 text-xs w-full"
														onClick={() => setLocalFrom(undefined)}
													>
														{t('setup.name.clearDate')}
													</Button>
												</div>
											)}
										</PopoverContent>
									</Popover>
								</div>

								{/* To */}
								<div className="space-y-1.5">
									<Label className="text-xs text-muted-foreground">
										{t('setup.name.to')}
									</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												disabled={indefinite}
												className={cn(
													'w-full justify-start text-left font-normal h-10',
													indefinite && 'opacity-50',
													!localTo &&
														!indefinite &&
														'text-muted-foreground'
												)}
											>
												<CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
												<span className="truncate text-sm">
													{indefinite
														? t('setup.name.indefiniteShort')
														: formatDisplay(localTo) ||
															t('setup.name.pickDate')}
												</span>
											</Button>
										</PopoverTrigger>
										<PopoverContent
											className="w-auto p-0"
											align="start"
											sideOffset={4}
										>
											<Calendar
												mode="single"
												selected={localTo}
												onSelect={setLocalTo}
												disabled={(date) =>
													localFrom ? date < localFrom : false
												}
												locale={locale}
												initialFocus
											/>
											{localTo && (
												<div className="border-t border-border px-3 py-2">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-7 text-xs w-full"
														onClick={() => setLocalTo(undefined)}
													>
														{t('setup.name.clearDate')}
													</Button>
												</div>
											)}
										</PopoverContent>
									</Popover>
								</div>
							</div>

							{/* Indefinite checkbox */}
							<label className="flex items-center gap-2 cursor-pointer group">
								<Checkbox
									checked={indefinite}
									onCheckedChange={(checked) => {
										setIndefinite(!!checked)
										if (checked) setLocalTo(undefined)
									}}
								/>
								<Infinity className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
								<span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
									{t('setup.name.indefiniteLabel')}
								</span>
							</label>

							<p className="text-xs text-muted-foreground">
								{t('setup.name.datesHint')}
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							{t('actions.cancel')}
						</Button>
						<Button onClick={handleSave} disabled={!localName.trim()}>
							{t('actions.save')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
