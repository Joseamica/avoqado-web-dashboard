import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import OrgTpvConfigSection from '../TpvConfig/components/OrgTpvConfigSection'

export default function OrgConfigPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Configuración TPV Organizacional" />
      <OrgTpvConfigSection />
    </div>
  )
}
