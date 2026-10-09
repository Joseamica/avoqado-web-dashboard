import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { ServiceCoursesContent } from '@/pages/Settings/ServiceCourses'
import { canManageOrganizationCourses } from '@/services/serviceCourses.service'

export default function OrganizationServiceCourses() {
  const { orgId } = useCurrentOrganization({ includeVenues: false, fetchStats: false })
  const { user, allVenues } = useAuth()
  const { t } = useTranslation('serviceCourses')
  const location = useLocation()
  const requestedReturn = new URLSearchParams(location.search).get('returnTo')
  // Only an authenticated branch of THIS organization can be a return target.
  const returnHref = allVenues.some(
    v =>
      v.organizationId === orgId &&
      [`/venues/${v.slug}/settings/service-courses`, `/wl/venues/${v.slug}/settings/service-courses`].includes(requestedReturn ?? ''),
  )
    ? requestedReturn!
    : undefined
  if (!orgId || !canManageOrganizationCourses(user, orgId))
    return (
      <p role="alert" className="p-6">
        {t('organizationOwnerOnly')}
      </p>
    )
  return <ServiceCoursesContent key={orgId} scope={{ kind: 'organization', id: orgId }} canManage returnHref={returnHref} />
}
