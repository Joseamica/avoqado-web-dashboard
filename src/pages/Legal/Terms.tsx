import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Terms() {
  const { t } = useTranslation('legal')

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/login" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('backToLogin')}
            </Link>
          </Button>

          <h1 className="text-4xl font-bold text-foreground mb-2">{t('terms.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('terms.lastUpdated')}: {t('terms.date')}
          </p>
        </div>

        <div className="bg-background rounded-lg shadow-lg p-8 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.introduction.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('terms.introduction.content')}</p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.service.title')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t('terms.service.description')}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('terms.service.features.pos')}</li>
              <li>{t('terms.service.features.inventory')}</li>
              <li>{t('terms.service.features.orders')}</li>
              <li>{t('terms.service.features.payments')}</li>
              <li>{t('terms.service.features.analytics')}</li>
              <li>{t('terms.service.features.staff')}</li>
            </ul>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.responsibilities.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('terms.responsibilities.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('terms.responsibilities.account')}</li>
                <li>{t('terms.responsibilities.accuracy')}</li>
                <li>{t('terms.responsibilities.compliance')}</li>
                <li>{t('terms.responsibilities.security')}</li>
                <li>{t('terms.responsibilities.misuse')}</li>
              </ul>
            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.payment.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('terms.payment.billing')}</p>
              <p>{t('terms.payment.fees')}</p>
              <p>{t('terms.payment.refunds')}</p>
            </div>
          </section>

          {/* Data and Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.privacy.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('terms.privacy.content')}{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                {t('terms.privacy.policyLink')}
              </Link>
              .
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.liability.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('terms.liability.content')}</p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.termination.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('terms.termination.content')}</p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.changes.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('terms.changes.content')}</p>
          </section>
          {/* AI Chatbot Feature */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.chatbot.title')}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t('terms.chatbot.description')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.scope')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.scopeContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.noExfil')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.noExfilContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.useLimits')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.useLimitsContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.outputs')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.outputsContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.security')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.securityContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.thirdParty')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.thirdPartyContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.ownership')}</h3>
            <p className="text-muted-foreground mb-4">{t('terms.chatbot.ownershipContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('terms.chatbot.violations')}</h3>
            <p className="text-muted-foreground">{t('terms.chatbot.violationsContent')}</p>
          </section>

          {/* Acceptable Use—AI Chatbot */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.acceptableUse.title')}</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('terms.acceptableUse.bullets.a')}</li>
              <li>{t('terms.acceptableUse.bullets.b')}</li>
              <li>{t('terms.acceptableUse.bullets.c')}</li>
              <li>{t('terms.acceptableUse.bullets.d')}</li>
              <li>{t('terms.acceptableUse.bullets.e')}</li>
            </ul>
          </section>

          {/* Specific AI and Data Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.aiLiability.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('terms.aiLiability.content')}</p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('terms.contact.title')}</h2>
            <div className="text-muted-foreground space-y-2">
              <p>{t('terms.contact.intro')}</p>
              <p>
                <strong>{t('terms.contact.email')}:</strong> legal@avoqado.com
              </p>
              <p>
                <strong>{t('terms.contact.address')}:</strong>
                <br />
                Avoqado Technologies
                <br />
                {t('terms.contact.addressLine')}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
