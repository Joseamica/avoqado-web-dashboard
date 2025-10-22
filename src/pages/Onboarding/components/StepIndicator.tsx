import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep
        const isUpcoming = stepNumber > currentStep

        return (
          <div key={stepNumber} className="flex items-center">
            {/* Step circle */}
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all',
                isCompleted && 'border-primary bg-primary text-primary-foreground',
                isCurrent && 'border-primary bg-background text-primary scale-110',
                isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground',
              )}
            >
              {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
            </div>

            {/* Connector line */}
            {stepNumber < totalSteps && (
              <div
                className={cn(
                  'h-0.5 w-12 transition-all md:w-24',
                  stepNumber < currentStep ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
