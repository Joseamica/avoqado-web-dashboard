import React from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

interface Step {
  number: number
  title: string
  description: string
  status: 'completed' | 'current' | 'upcoming'
}

interface StepIndicatorProps {
  steps: Step[]
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps }) => {
  const { t } = useTranslation('venuePricing')

  return (
    <nav aria-label={t('stepIndicator.progress')}>
      <ol className="flex items-center justify-between">
        {steps.map((step, stepIdx) => (
          <li
            key={step.number}
            className={`flex-1 ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}
          >
            <div className="flex items-center">
              <div className="flex flex-col items-center flex-1">
                {/* Step Circle */}
                <div className="relative flex items-center justify-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      step.status === 'completed'
                        ? 'border-primary bg-primary'
                        : step.status === 'current'
                        ? 'border-primary bg-background'
                        : 'border-muted bg-muted'
                    }`}
                  >
                    {step.status === 'completed' ? (
                      <Check className="h-5 w-5 text-primary-foreground" />
                    ) : (
                      <span
                        className={`text-sm font-semibold ${
                          step.status === 'current'
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {step.number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step Text */}
                <div className="mt-2 text-center">
                  <p
                    className={`text-sm font-medium ${
                      step.status === 'current'
                        ? 'text-foreground'
                        : step.status === 'completed'
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {stepIdx !== steps.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 h-0.5 w-full ${
                    step.status === 'completed' ? 'bg-primary' : 'bg-muted'
                  }`}
                  style={{ transform: 'translateX(50%)' }}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}
