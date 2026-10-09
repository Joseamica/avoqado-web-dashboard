import api from '@/api'
import type { User } from '@/types'

export function canManageOrganizationCourses(user: User | null | undefined, organizationId: string): boolean {
  return (
    user?.role === 'SUPERADMIN' || !!user?.organizationMemberships?.some(m => m.organizationId === organizationId && m.role === 'OWNER')
  )
}

/** Mirrors service-courses/serviceCourseContract.ts in avoqado-server. */
export interface ServiceCourse {
  id: string
  label: string
  kind: 'IMMEDIATE' | 'STANDARD'
}
export interface ServiceCoursesRead {
  schemaVersion: number
  organizationId: string
  organizationName: string
  venueId?: string
  venueName?: string
  source: 'DEFAULT' | 'ORGANIZATION' | 'VENUE'
  revision: string
  enabled: boolean
  hasOwnConfiguration?: boolean
  totalVenues?: number
  inheritingVenues?: number
  courses: ServiceCourse[]
  limits: { maxCourses: number; maxLabelLength: number }
}
export type ServiceCourseScope = { kind: 'venue' | 'organization'; id: string }
export const serviceCourseKey = (scope: ServiceCourseScope) => ['service-courses', scope.kind, scope.id] as const
const endpoint = (scope: ServiceCourseScope) =>
  `/api/v1/dashboard/${scope.kind === 'venue' ? 'venues' : 'organizations'}/${scope.id}/service-courses`
export async function getServiceCourses(scope: ServiceCourseScope): Promise<ServiceCoursesRead> {
  return (await api.get(endpoint(scope))).data.data
}
export async function saveServiceCourses(
  scope: ServiceCourseScope,
  expectedRevision: string,
  courses: ServiceCourse[] | null,
): Promise<ServiceCoursesRead> {
  return (await api.put(endpoint(scope), { expectedRevision, courses })).data.data
}
export function normalizeCourses(courses: ServiceCourse[]): ServiceCourse[] {
  return courses.map(c => ({ ...c, label: c.label.normalize('NFKC').trim().replace(/\s+/gu, ' ') }))
}
export function courseValidation(courses: ServiceCourse[], limits: ServiceCoursesRead['limits']): string | null {
  if (courses.length < 1 || courses.length > limits.maxCourses) return 'validation.count'
  if (courses[0].id !== 'immediate' || courses[0].kind !== 'IMMEDIATE' || courses.filter(c => c.kind === 'IMMEDIATE').length !== 1)
    return 'validation.immediate'
  if (courses.some(c => Array.from(c.label).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) return 'validation.name'
  const normalized = normalizeCourses(courses)
  if (normalized.some(c => !c.label || c.label.length > limits.maxLabelLength)) return 'validation.name'
  if (new Set(normalized.map(c => c.label.toLocaleLowerCase('es'))).size !== courses.length) return 'validation.duplicate'
  if (new Set(courses.map(c => c.id)).size !== courses.length) return 'validation.duplicate'
  return null
}
