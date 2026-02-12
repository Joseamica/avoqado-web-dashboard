import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LanguageSwitcher from '@/components/language-switcher'

export default function Privacy() {
  const { t } = useTranslation('legal')

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="ghost" asChild className="mb-4">
              <Link to="/login" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('backToLogin')}
              </Link>
            </Button>

            <h1 className="text-4xl font-bold text-foreground mb-2">{t('privacy.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {t('privacy.lastUpdated')}: {t('privacy.date')}
            </p>
          </div>
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="bg-background rounded-lg shadow-lg p-8 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.introduction.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.introduction.content')}</p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.collection.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-lg font-medium text-foreground">{t('privacy.collection.personal.title')}</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.collection.personal.name')}</li>
                <li>{t('privacy.collection.personal.email')}</li>
                <li>{t('privacy.collection.personal.phone')}</li>
                <li>{t('privacy.collection.personal.business')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6">{t('privacy.collection.business.title')}</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.collection.business.sales')}</li>
                <li>{t('privacy.collection.business.inventory')}</li>
                <li>{t('privacy.collection.business.customers')}</li>
                <li>{t('privacy.collection.business.staff')}</li>
                <li>{t('privacy.collection.business.financial')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6">{t('privacy.collection.technical.title')}</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.collection.technical.ip')}</li>
                <li>{t('privacy.collection.technical.device')}</li>
                <li>{t('privacy.collection.technical.usage')}</li>
                <li>{t('privacy.collection.technical.cookies')}</li>
              </ul>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.usage.title')}</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('privacy.usage.service')}</li>
              <li>{t('privacy.usage.support')}</li>
              <li>{t('privacy.usage.communication')}</li>
              <li>{t('privacy.usage.improvement')}</li>
              <li>{t('privacy.usage.analytics')}</li>
              <li>{t('privacy.usage.compliance')}</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.sharing.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('privacy.sharing.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.sharing.consent')}</li>
                <li>{t('privacy.sharing.providers')}</li>
                <li>{t('privacy.sharing.legal')}</li>
                <li>{t('privacy.sharing.business')}</li>
                <li>{t('privacy.sharing.aggregated')}</li>
              </ul>
            </div>
          </section>
          {/* AI Chatbot Data Processing */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.ai.title')}</h2>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.what')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.whatContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.purpose')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.purposeContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.legalBasis')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.legalBasisContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.sharing')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.sharingContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.training')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.trainingContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.retention')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.retentionContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.transfers')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.transfersContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.sensitive')}</h3>
            <p className="text-muted-foreground mb-4">{t('privacy.ai.sensitiveContent')}</p>

            <h3 className="text-lg font-medium text-foreground">{t('privacy.ai.rightsNote')}</h3>
            <p className="text-muted-foreground">{t('privacy.ai.rightsNoteContent')}</p>
          </section>

          {/* Tenant/Venue Segregation */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.venueSegregation.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.venueSegregation.content')}</p>
          </section>

          {/* AI Transparency */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.disclosureAI.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.disclosureAI.content')}</p>
          </section>
          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.security.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('privacy.security.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.security.encryption')}</li>
                <li>{t('privacy.security.access')}</li>
                <li>{t('privacy.security.monitoring')}</li>
                <li>{t('privacy.security.updates')}</li>
                <li>{t('privacy.security.backups')}</li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.retention.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.retention.content')}</p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.rights.title')}</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('privacy.rights.access')}</li>
              <li>{t('privacy.rights.correction')}</li>
              <li>{t('privacy.rights.deletion')}</li>
              <li>{t('privacy.rights.portability')}</li>
              <li>{t('privacy.rights.restriction')}</li>
              <li>{t('privacy.rights.objection')}</li>
              <li>{t('privacy.rights.withdraw')}</li>
            </ul>
          </section>

          {/* Cookies and Tracking */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.cookies.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('privacy.cookies.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('privacy.cookies.essential')}</li>
                <li>{t('privacy.cookies.functional')}</li>
                <li>{t('privacy.cookies.analytics')}</li>
                <li>{t('privacy.cookies.marketing')}</li>
              </ul>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.international.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.international.content')}</p>
          </section>

          {/* Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.changes.title')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('privacy.changes.content')}</p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t('privacy.contact.title')}</h2>
            <div className="text-muted-foreground space-y-2">
              <p>{t('privacy.contact.intro')}</p>
              <p>
                <strong>{t('privacy.contact.email')}:</strong> hola@avoqado.io
              </p>
              <p>
                <strong>{t('privacy.contact.address')}:</strong>
                <br />
                {t('privacy.contact.organization')}
                <br />
                {t('privacy.contact.addressLine')}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
