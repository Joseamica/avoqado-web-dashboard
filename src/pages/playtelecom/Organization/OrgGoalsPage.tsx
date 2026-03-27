import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import OrgGoalConfigSection from '../Supervisor/OrgGoalConfigSection'

export default function OrgGoalsPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Metas Organizacionales" />
      <OrgGoalConfigSection />
    </div>
  )
}
