/**
 * PlayTelecomLayout - Shared layout for all PlayTelecom dashboard pages
 *
 * Provides:
 * - Consistent header with title and breadcrumbs
 * - Common styling and spacing
 * - Outlet for nested routes
 */

import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useAuth } from '@/context/AuthContext'

// Map route paths to translation keys
const ROUTE_TITLE_MAP: Record<string, string> = {
  '': 'commandCenter',
  stock: 'stock',
  sales: 'sales',
  stores: 'stores',
  managers: 'managers',
  promoters: 'promoters',
  users: 'users',
  'tpv-config': 'tpvConfig',
}

export default function PlayTelecomLayout() {
  const { t } = useTranslation(['playtelecom', 'sidebar'])
  const location = useLocation()
  const { activeVenue } = useAuth()

  // Parse current path to determine breadcrumb
  const currentSection = useMemo(() => {
    const pathParts = location.pathname.split('/')
    const playtelecomIndex = pathParts.findIndex(p => p === 'playtelecom')
    if (playtelecomIndex === -1) return ''
    return pathParts[playtelecomIndex + 1] || ''
  }, [location.pathname])

  // Get translated title for current section
  const sectionTitle = useMemo(() => {
    const titleKey = ROUTE_TITLE_MAP[currentSection] || 'commandCenter'
    return t(`playtelecom:${titleKey}.title`, { defaultValue: t(`sidebar:playtelecom.${titleKey}`) })
  }, [currentSection, t])

  return (
    <div className="flex flex-col h-full">
      {/* Header with breadcrumbs */}
      <div className="flex-shrink-0 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href={`/venues/${activeVenue?.slug}/home`}>
                  {activeVenue?.name || 'Venue'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/venues/${activeVenue?.slug}/playtelecom`}>
                  {t('sidebar:playtelecom.title', { defaultValue: 'PlayTelecom' })}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {currentSection && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{sectionTitle}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {currentSection ? sectionTitle : t('playtelecom:commandCenter.title', { defaultValue: 'Centro de Comando' })}
          </h1>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
