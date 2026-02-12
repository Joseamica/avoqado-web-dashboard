import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepProps } from '../types'

type SubStep = 'terms' | 'privacy'

export function TermsStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const { t: tLegal } = useTranslation('legal')
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
          {isTermsSubStep ? (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.introduction.title')}</h3>
                <p>{tLegal('terms.introduction.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.service.title')}</h3>
                <p className="mb-2">{tLegal('terms.service.description')}</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('terms.service.features.pos')}</li>
                  <li>{tLegal('terms.service.features.inventory')}</li>
                  <li>{tLegal('terms.service.features.orders')}</li>
                  <li>{tLegal('terms.service.features.payments')}</li>
                  <li>{tLegal('terms.service.features.analytics')}</li>
                  <li>{tLegal('terms.service.features.staff')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.responsibilities.title')}</h3>
                <p className="mb-2">{tLegal('terms.responsibilities.intro')}</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('terms.responsibilities.account')}</li>
                  <li>{tLegal('terms.responsibilities.accuracy')}</li>
                  <li>{tLegal('terms.responsibilities.compliance')}</li>
                  <li>{tLegal('terms.responsibilities.security')}</li>
                  <li>{tLegal('terms.responsibilities.misuse')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.payment.title')}</h3>
                <p className="mb-1">{tLegal('terms.payment.billing')}</p>
                <p className="mb-1">{tLegal('terms.payment.fees')}</p>
                <p>{tLegal('terms.payment.refunds')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.privacy.title')}</h3>
                <p>{tLegal('terms.privacy.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.liability.title')}</h3>
                <p>{tLegal('terms.liability.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.termination.title')}</h3>
                <p>{tLegal('terms.termination.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.changes.title')}</h3>
                <p>{tLegal('terms.changes.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.chatbot.title')}</h3>
                <p className="mb-2">{tLegal('terms.chatbot.description')}</p>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('terms.chatbot.scope')}:</span> {tLegal('terms.chatbot.scopeContent')}</p>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('terms.chatbot.noExfil')}:</span> {tLegal('terms.chatbot.noExfilContent')}</p>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('terms.chatbot.outputs')}:</span> {tLegal('terms.chatbot.outputsContent')}</p>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('terms.chatbot.security')}:</span> {tLegal('terms.chatbot.securityContent')}</p>
                <p><span className="font-medium text-foreground">{tLegal('terms.chatbot.violations')}:</span> {tLegal('terms.chatbot.violationsContent')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('terms.contact.title')}</h3>
                <p>{tLegal('terms.contact.intro')}</p>
                <p className="mt-1">{tLegal('terms.contact.email')}: hola@avoqado.io</p>
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.introduction.title')}</h3>
                <p>{tLegal('privacy.introduction.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.collection.title')}</h3>
                <h4 className="mb-1 text-xs font-medium text-foreground/80">{tLegal('privacy.collection.personal.title')}</h4>
                <ul className="ml-4 list-disc space-y-1 mb-3">
                  <li>{tLegal('privacy.collection.personal.name')}</li>
                  <li>{tLegal('privacy.collection.personal.email')}</li>
                  <li>{tLegal('privacy.collection.personal.phone')}</li>
                  <li>{tLegal('privacy.collection.personal.business')}</li>
                </ul>
                <h4 className="mb-1 text-xs font-medium text-foreground/80">{tLegal('privacy.collection.business.title')}</h4>
                <ul className="ml-4 list-disc space-y-1 mb-3">
                  <li>{tLegal('privacy.collection.business.sales')}</li>
                  <li>{tLegal('privacy.collection.business.inventory')}</li>
                  <li>{tLegal('privacy.collection.business.customers')}</li>
                  <li>{tLegal('privacy.collection.business.staff')}</li>
                  <li>{tLegal('privacy.collection.business.financial')}</li>
                </ul>
                <h4 className="mb-1 text-xs font-medium text-foreground/80">{tLegal('privacy.collection.technical.title')}</h4>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('privacy.collection.technical.ip')}</li>
                  <li>{tLegal('privacy.collection.technical.device')}</li>
                  <li>{tLegal('privacy.collection.technical.usage')}</li>
                  <li>{tLegal('privacy.collection.technical.cookies')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.usage.title')}</h3>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('privacy.usage.service')}</li>
                  <li>{tLegal('privacy.usage.support')}</li>
                  <li>{tLegal('privacy.usage.communication')}</li>
                  <li>{tLegal('privacy.usage.improvement')}</li>
                  <li>{tLegal('privacy.usage.analytics')}</li>
                  <li>{tLegal('privacy.usage.compliance')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.sharing.title')}</h3>
                <p className="mb-2">{tLegal('privacy.sharing.intro')}</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('privacy.sharing.consent')}</li>
                  <li>{tLegal('privacy.sharing.providers')}</li>
                  <li>{tLegal('privacy.sharing.legal')}</li>
                  <li>{tLegal('privacy.sharing.business')}</li>
                  <li>{tLegal('privacy.sharing.aggregated')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.ai.title')}</h3>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('privacy.ai.what')}:</span> {tLegal('privacy.ai.whatContent')}</p>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('privacy.ai.purpose')}:</span> {tLegal('privacy.ai.purposeContent')}</p>
                <p className="mb-1"><span className="font-medium text-foreground">{tLegal('privacy.ai.training')}:</span> {tLegal('privacy.ai.trainingContent')}</p>
                <p><span className="font-medium text-foreground">{tLegal('privacy.ai.retention')}:</span> {tLegal('privacy.ai.retentionContent')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.security.title')}</h3>
                <p className="mb-2">{tLegal('privacy.security.intro')}</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('privacy.security.encryption')}</li>
                  <li>{tLegal('privacy.security.access')}</li>
                  <li>{tLegal('privacy.security.monitoring')}</li>
                  <li>{tLegal('privacy.security.updates')}</li>
                  <li>{tLegal('privacy.security.backups')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.rights.title')}</h3>
                <ul className="ml-4 list-disc space-y-1">
                  <li>{tLegal('privacy.rights.access')}</li>
                  <li>{tLegal('privacy.rights.correction')}</li>
                  <li>{tLegal('privacy.rights.deletion')}</li>
                  <li>{tLegal('privacy.rights.portability')}</li>
                  <li>{tLegal('privacy.rights.restriction')}</li>
                  <li>{tLegal('privacy.rights.objection')}</li>
                  <li>{tLegal('privacy.rights.withdraw')}</li>
                </ul>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.retention.title')}</h3>
                <p>{tLegal('privacy.retention.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.changes.title')}</h3>
                <p>{tLegal('privacy.changes.content')}</p>
              </section>
              <section>
                <h3 className="mb-2 font-medium text-foreground">{tLegal('privacy.contact.title')}</h3>
                <p>{tLegal('privacy.contact.intro')}</p>
                <p className="mt-1">{tLegal('privacy.contact.email')}: hola@avoqado.io</p>
              </section>
            </div>
          )}
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
