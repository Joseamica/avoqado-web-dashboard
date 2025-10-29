import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="w-full overflow-x-auto">
      {/* Added py-2 to give vertical space for the scaled current step */}
      <div className="flex items-center justify-center min-w-fit px-4 py-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep

          return (
            <div key={stepNumber} className="flex items-center">
              {/* Step circle - responsive sizes */}
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 font-semibold transition-all',
                  // Responsive sizes: smaller on mobile, larger on desktop
                  'h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm md:h-10 md:w-10 md:text-base',
                  // States
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-background text-primary scale-110 shadow-lg ring-2 ring-primary/20',
                  isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" /> : stepNumber}
              </div>

              {/* Connector line - responsive widths */}
              {stepNumber < totalSteps && (
                <div
                  className={cn(
                    'h-0.5 transition-all',
                    // Responsive widths: shorter on mobile, longer on desktop
                    'w-6 sm:w-10 md:w-16 lg:w-24',
                    stepNumber < currentStep ? 'bg-primary' : 'bg-muted-foreground/30',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
