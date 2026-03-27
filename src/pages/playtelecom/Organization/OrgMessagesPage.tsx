import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { OrgMessagesSection } from '../TpvConfig/components/OrgMessagesSection'

export default function OrgMessagesPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Mensajes Organizacionales" />
      <OrgMessagesSection />
    </div>
  )
}
