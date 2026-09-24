import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PrivacyDocument, TermsDocument } from '@/components/legal/LegalDocumentContent'
import type { StepProps } from '../types'

type SubStep = 'terms' | 'privacy'

export function TermsStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const [subStep, setSubStep] = useState<SubStep>('terms')
  const [termsAccepted, setTermsAccepted] = useState(data.termsAccepted || false)
  const [privacyAccepted, setPrivacyAccepted] = useState(data.privacyAccepted || false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset scroll state when switching sub-steps
  useEffect(() => {
    setHasScrolledToBottom(false)
    setScrollProgress(0)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [subStep])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) {
      setScrollProgress(1)
      setHasScrolledToBottom(true)
      return
    }
    const progress = el.scrollTop / maxScroll
    setScrollProgress(Math.min(progress, 1))

    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      setHasScrolledToBottom(true)
    }
  }, [])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }

  const handleAcceptTerms = () => {
    setTermsAccepted(true)
    setSubStep('privacy')
  }

  const handleAcceptPrivacy = () => {
    setPrivacyAccepted(true)
    onNext({
      termsAccepted: true,
      privacyAccepted: true,
    })
  }

  const isTermsSubStep = subStep === 'terms'
  const accepted = isTermsSubStep ? termsAccepted : privacyAccepted
  const checkboxLabel = isTermsSubStep ? t('step6.termsCheckbox') : t('step6.privacyCheckbox')
  const onAccept = isTermsSubStep ? handleAcceptTerms : handleAcceptPrivacy
  const buttonLabel = isTermsSubStep ? t('step6.acceptTerms') : t('wizard.accept')

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('step6.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('step6.subtitle')}</p>
      </div>

      {/* Sub-step indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
              termsAccepted
                ? 'bg-primary text-primary-foreground'
                : isTermsSubStep
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {termsAccepted ? '✓' : '1'}
          </div>
          <span
            className={cn(
              'text-xs sm:text-sm transition-colors truncate',
              isTermsSubStep ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {t('step6.termsTitle')}
          </span>
        </div>
        <div className="h-px w-4 shrink-0 bg-border sm:flex-1" />
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
              privacyAccepted
                ? 'bg-primary text-primary-foreground'
                : !isTermsSubStep
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {privacyAccepted ? '✓' : '2'}
          </div>
          <span
            className={cn(
              'text-xs sm:text-sm transition-colors truncate',
              !isTermsSubStep ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {t('step6.privacyTitle')}
          </span>
        </div>
      </div>

      {/* Scrollable document */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[240px] sm:h-[320px] overflow-y-auto rounded-xl border border-border bg-muted/30 p-4 sm:p-5 text-sm text-muted-foreground leading-relaxed"
        >
          {isTermsSubStep ? <TermsDocument /> : <PrivacyDocument />}
        </div>

        {/* Scroll progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              hasScrolledToBottom ? 'bg-primary' : 'bg-muted-foreground/40',
            )}
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>

        {/* Scroll hint - only shows when not yet scrolled to bottom */}
        {!hasScrolledToBottom && (
          <button
            onClick={scrollToBottom}
            className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground transition-opacity hover:text-foreground cursor-pointer"
          >
            <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
            {t('step6.scrollToRead')}
          </button>
        )}
      </div>

      {/* Checkbox + Accept button */}
      <div
        className={cn(
          'flex flex-col gap-4 transition-opacity duration-300',
          hasScrolledToBottom ? 'opacity-100' : 'opacity-40 pointer-events-none',
        )}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${subStep}Accepted`}
            checked={accepted}
            onCheckedChange={(checked) => {
              if (isTermsSubStep) setTermsAccepted(checked === true)
              else setPrivacyAccepted(checked === true)
            }}
            disabled={!hasScrolledToBottom}
          />
          <Label htmlFor={`${subStep}Accepted`} className="text-sm font-normal cursor-pointer">
            {checkboxLabel}
          </Label>
        </div>

        <Button
          onClick={onAccept}
          size="lg"
          className="w-full rounded-full h-12 text-base"
          disabled={!accepted}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
