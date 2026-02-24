import { cn } from '@/lib/utils'

interface BookingStepIndicatorProps {
	currentStep: number
	totalSteps: number
	labels: string[]
}

export function BookingStepIndicator({ currentStep, totalSteps, labels }: BookingStepIndicatorProps) {
	return (
		<div className="flex items-center justify-center gap-2 py-4">
			{Array.from({ length: totalSteps }, (_, i) => {
				const step = i + 1
				const isActive = step === currentStep
				const isCompleted = step < currentStep

				return (
					<div key={step} className="flex items-center gap-2">
						<div className="flex flex-col items-center gap-1">
							<div
								className={cn(
									'h-2.5 w-2.5 rounded-full transition-all',
									isActive && 'h-3 w-3 bg-primary',
									isCompleted && 'bg-primary',
									!isActive && !isCompleted && 'bg-muted-foreground/30',
								)}
							/>
							<span
								className={cn(
									'text-[10px] leading-none',
									isActive && 'font-medium text-foreground',
									!isActive && 'text-muted-foreground',
								)}
							>
								{labels[i]}
							</span>
						</div>
						{i < totalSteps - 1 && (
							<div
								className={cn(
									'mb-4 h-px w-6',
									isCompleted ? 'bg-primary' : 'bg-muted-foreground/30',
								)}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}
