/**
 * El TEXTO de los documentos legales, en un solo sitio.
 *
 * Vivía dentro de `TermsStep` del asistente largo. El alta corta enseña los mismos documentos
 * desde una hoja que se abre con un enlace junto a la casilla (§4.1), y duplicar el texto legal
 * sería la forma más segura de que las dos copias se separen. Aquí no hay lógica: solo el
 * contenido, que sale del namespace `legal` de i18n.
 */
import { useTranslation } from 'react-i18next'

export function TermsDocument() {
  const { t: tLegal } = useTranslation('legal')
  return (
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
  )
}

export function PrivacyDocument() {
  const { t: tLegal } = useTranslation('legal')
  return (
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
  )
}
