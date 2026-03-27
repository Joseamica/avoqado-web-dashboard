import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import OrgCategoryConfigSection from '../TpvConfig/components/OrgCategoryConfigSection'

export default function OrgCategoriesPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Categorías Organizacionales" />
      <OrgCategoryConfigSection />
    </div>
  )
}
