import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="w-full">
      {/* Added py-2 to give vertical space for the scaled current step */}
      <div className="flex items-center justify-center px-2 py-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep

          return (
            <div key={stepNumber} className="flex items-center">
              {/* Step circle - compact sizes for 8 steps */}
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 font-semibold transition-all',
                  // Compact sizes to fit 8 steps
                  'h-7 w-7 text-xs sm:h-8 sm:w-8 sm:text-sm',
                  // States
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-background text-primary scale-110 shadow-lg ring-2 ring-primary/20',
                  isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : stepNumber}
              </div>

              {/* Connector line - shorter widths to fit 8 steps */}
              {stepNumber < totalSteps && (
                <div
                  className={cn(
                    'h-0.5 transition-all',
                    // Shorter widths: fits 8 steps without overflow
                    'w-4 sm:w-6 md:w-10 lg:w-14',
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
