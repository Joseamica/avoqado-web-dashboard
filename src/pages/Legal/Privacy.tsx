import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Privacy() {
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
            {t('legal.privacy.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('legal.privacy.lastUpdated')}: {t('legal.privacy.date')}
          </p>
        </div>

        <div className="bg-background rounded-lg shadow-lg p-8 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.introduction.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.privacy.introduction.content')}
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.collection.title')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <h3 className="text-lg font-medium text-foreground">
                {t('legal.privacy.collection.personal.title')}
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('legal.privacy.collection.personal.name')}</li>
                <li>{t('legal.privacy.collection.personal.email')}</li>
                <li>{t('legal.privacy.collection.personal.phone')}</li>
                <li>{t('legal.privacy.collection.personal.business')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6">
                {t('legal.privacy.collection.business.title')}
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('legal.privacy.collection.business.sales')}</li>
                <li>{t('legal.privacy.collection.business.inventory')}</li>
                <li>{t('legal.privacy.collection.business.customers')}</li>
                <li>{t('legal.privacy.collection.business.staff')}</li>
                <li>{t('legal.privacy.collection.business.financial')}</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6">
                {t('legal.privacy.collection.technical.title')}
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('legal.privacy.collection.technical.ip')}</li>
                <li>{t('legal.privacy.collection.technical.device')}</li>
                <li>{t('legal.privacy.collection.technical.usage')}</li>
                <li>{t('legal.privacy.collection.technical.cookies')}</li>
              </ul>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.usage.title')}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('legal.privacy.usage.service')}</li>
              <li>{t('legal.privacy.usage.support')}</li>
              <li>{t('legal.privacy.usage.communication')}</li>
              <li>{t('legal.privacy.usage.improvement')}</li>
              <li>{t('legal.privacy.usage.analytics')}</li>
              <li>{t('legal.privacy.usage.compliance')}</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.sharing.title')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('legal.privacy.sharing.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('legal.privacy.sharing.consent')}</li>
                <li>{t('legal.privacy.sharing.providers')}</li>
                <li>{t('legal.privacy.sharing.legal')}</li>
                <li>{t('legal.privacy.sharing.business')}</li>
                <li>{t('legal.privacy.sharing.aggregated')}</li>
              </ul>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.security.title')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('legal.privacy.security.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('legal.privacy.security.encryption')}</li>
                <li>{t('legal.privacy.security.access')}</li>
                <li>{t('legal.privacy.security.monitoring')}</li>
                <li>{t('legal.privacy.security.updates')}</li>
                <li>{t('legal.privacy.security.backups')}</li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.retention.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.privacy.retention.content')}
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.rights.title')}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>{t('legal.privacy.rights.access')}</li>
              <li>{t('legal.privacy.rights.correction')}</li>
              <li>{t('legal.privacy.rights.deletion')}</li>
              <li>{t('legal.privacy.rights.portability')}</li>
              <li>{t('legal.privacy.rights.restriction')}</li>
              <li>{t('legal.privacy.rights.objection')}</li>
              <li>{t('legal.privacy.rights.withdraw')}</li>
            </ul>
          </section>

          {/* Cookies and Tracking */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.cookies.title')}
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>{t('legal.privacy.cookies.intro')}</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>{t('legal.privacy.cookies.essential')}</li>
                <li>{t('legal.privacy.cookies.functional')}</li>
                <li>{t('legal.privacy.cookies.analytics')}</li>
                <li>{t('legal.privacy.cookies.marketing')}</li>
              </ul>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.international.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.privacy.international.content')}
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.changes.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('legal.privacy.changes.content')}
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t('legal.privacy.contact.title')}
            </h2>
            <div className="text-muted-foreground space-y-2">
              <p>{t('legal.privacy.contact.intro')}</p>
              <p>
                <strong>{t('legal.privacy.contact.email')}:</strong> privacy@avoqado.com
              </p>
              <p>
                <strong>{t('legal.privacy.contact.dpo')}:</strong> dpo@avoqado.com
              </p>
              <p>
                <strong>{t('legal.privacy.contact.address')}:</strong><br />
                Avoqado Technologies - Privacy Officer<br />
                {t('legal.privacy.contact.addressLine')}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
