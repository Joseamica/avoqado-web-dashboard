import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Terms() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/login" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('legal.backToLogin')}
            </Link>
          </Button>
          
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {t('legal.terms.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('legal.terms.lastUpdated')}: {t('legal.terms.date')}
          </p>
        </div>

        <div className="bg-background rounded-lg shadow-lg p-8 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.introduction.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.terms.introduction.content')}
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.service.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t('legal.terms.service.description')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('legal.terms.service.features.pos')}</li>
              <li>{t('legal.terms.service.features.inventory')}</li>
              <li>{t('legal.terms.service.features.orders')}</li>
              <li>{t('legal.terms.service.features.payments')}</li>
              <li>{t('legal.terms.service.features.analytics')}</li>
              <li>{t('legal.terms.service.features.staff')}</li>
            </ul>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.responsibilities.title')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('legal.terms.responsibilities.intro')}</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>{t('legal.terms.responsibilities.account')}</li>
                <li>{t('legal.terms.responsibilities.accuracy')}</li>
                <li>{t('legal.terms.responsibilities.compliance')}</li>
                <li>{t('legal.terms.responsibilities.security')}</li>
                <li>{t('legal.terms.responsibilities.misuse')}</li>
              </ul>
            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.payment.title')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('legal.terms.payment.billing')}</p>
              <p>{t('legal.terms.payment.fees')}</p>
              <p>{t('legal.terms.payment.refunds')}</p>
            </div>
          </section>

          {/* Data and Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.privacy.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.terms.privacy.content')}{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                {t('legal.terms.privacy.policyLink')}
              </Link>
              .
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.liability.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.terms.liability.content')}
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.termination.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.terms.termination.content')}
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.changes.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.terms.changes.content')}
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.terms.contact.title')}
            </h2>
            <div className="text-muted-foreground space-y-2">
              <p>{t('legal.terms.contact.intro')}</p>
              <p>
                <strong>{t('legal.terms.contact.email')}:</strong> legal@avoqado.com
              </p>
              <p>
                <strong>{t('legal.terms.contact.address')}:</strong><br />
                Avoqado Technologies<br />
                {t('legal.terms.contact.addressLine')}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
