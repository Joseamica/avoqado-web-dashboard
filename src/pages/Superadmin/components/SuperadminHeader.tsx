import React, { useState, useEffect, useRef } from 'react'
import { Bell, Search, Settings, LogOut, Building2, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useSuperadminNotificationData, useMarkNotificationAsRead, useSuperadminDashboard } from '@/hooks/use-superadmin-queries'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/language-switcher'
import { useQuery } from '@tanstack/react-query'
import { superadminAPI } from '@/services/superadmin.service'
import { Badge } from '@/components/ui/badge'

// Helper function to format notification timestamps (i18n-aware)
const formatNotificationTime = (t: (key: string, opts?: any) => string, timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return t('dashboard.recentActivity.relative.lessThanMinute')
  if (diffInMinutes < 60) {
    const count = diffInMinutes
    return count === 1
      ? t('dashboard.recentActivity.relative.minutes', { count })
      : t('dashboard.recentActivity.relative.minutes_plural', { count })
  }
  if (diffInMinutes < 1440) {
    const count = Math.floor(diffInMinutes / 60)
    return count === 1
      ? t('dashboard.recentActivity.relative.hours', { count })
      : t('dashboard.recentActivity.relative.hours_plural', { count })
  }
  const count = Math.floor(diffInMinutes / 1440)
  return count === 1
    ? t('dashboard.recentActivity.relative.days', { count })
    : t('dashboard.recentActivity.relative.days_plural', { count })
}

const SuperadminHeader: React.FC = () => {
  const { user, logout, allVenues } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('superadmin')

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)

  // Usar TanStack Query para las notificaciones
  const { notifications, unreadCount, isLoading: isLoadingNotifications, isError, refetch } = useSuperadminNotificationData(5)

  // Mutation para marcar notificación como leída
  const { mutateAsync: markAsRead } = useMarkNotificationAsRead()

  // Fetch all venues for search
  const { data: allVenuesData = [] } = useQuery({
    queryKey: ['superadmin-venues'],
    queryFn: superadminAPI.getAllVenues,
  })

  // Fetch dashboard data for recent activity and alerts
  const { data: dashboardData } = useSuperadminDashboard()

  const goToVenueDashboard = () => {
    if (allVenues && allVenues.length > 0) {
      // Navigate to the first available venue
      navigate(`/venues/${allVenues[0].slug}/home`)
    }
  }

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    await markAsRead(notificationId)

    if (actionUrl) {
      // Handle absolute URLs (http/https or paths starting with /) and relative URLs differently
      if (actionUrl.startsWith('http') || actionUrl.startsWith('/')) {
        // Absolute URL or absolute path - use navigate for SPA navigation
        navigate(actionUrl)
      }
    }
  }

  // Search filtering
  const searchResults = React.useMemo(() => {
    if (!searchTerm.trim()) return { venues: [], activities: [], alerts: [] }

    const term = searchTerm.toLowerCase()

    // Search venues
    const venues = allVenuesData
      .filter(
        venue =>
          venue.name.toLowerCase().includes(term) ||
          venue.owner.email.toLowerCase().includes(term) ||
          venue.organization.name.toLowerCase().includes(term) ||
          venue.slug.toLowerCase().includes(term),
      )
      .slice(0, 5) // Limit to 5 results

    // Search recent activities
    const activities = (dashboardData?.recentActivity || [])
      .filter(activity => activity.description.toLowerCase().includes(term) || activity.venueName?.toLowerCase().includes(term))
      .slice(0, 5)

    // Search alerts
    const alerts = (dashboardData?.alerts || [])
      .filter(alert => alert.title.toLowerCase().includes(term) || alert.message.toLowerCase().includes(term))
      .slice(0, 5)

    return { venues, activities, alerts }
  }, [searchTerm, allVenuesData, dashboardData])

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (e.target.value.trim()) {
      setShowSearchResults(true)
    } else {
      setShowSearchResults(false)
    }
  }

  // Handle search result click
  const handleResultClick = (path: string) => {
    navigate(path)
    setSearchTerm('')
    setShowSearchResults(false)
  }

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('')
    setShowSearchResults(false)
  }

  const hasResults = searchResults.venues.length > 0 || searchResults.activities.length > 0 || searchResults.alerts.length > 0

  return (
    <header className="border-b border-border px-6 py-4 bg-card shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left side - Title and System Status */}
        <div className="flex items-center space-x-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('header.title')}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">{t('header.systemOperational')}</span>
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-8 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              ref={searchInputRef}
              placeholder={t('header.searchPlaceholder')}
              className="pl-10 pr-8"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => searchTerm.trim() && setShowSearchResults(true)}
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div
              ref={searchResultsRef}
              className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50"
            >
              {!hasResults && searchTerm.trim() ? (
                <div className="p-4 text-center text-muted-foreground text-sm">{t('header.noSearchResults')}</div>
              ) : (
                <div className="py-2">
                  {/* Venues */}
                  {searchResults.venues.length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t('header.searchSections.venues')}
                      </div>
                      {searchResults.venues.map(venue => (
                        <div
                          key={venue.id}
                          onClick={() => handleResultClick(`/superadmin/kyc/${venue.id}`)}
                          className="px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{venue.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{venue.owner.email}</p>
                            </div>
                            <Badge
                              className={`ml-2 ${
                                venue.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
                                  : venue.status === 'PENDING'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                              }`}
                            >
                              {venue.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Activities */}
                  {searchResults.activities.length > 0 && (
                    <div className="mb-2">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t border-border">
                        {t('header.searchSections.activities')}
                      </div>
                      {searchResults.activities.map(activity => (
                        <div
                          key={activity.id}
                          onClick={() => handleResultClick('/superadmin')}
                          className="px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                        >
                          <p className="text-sm text-foreground">{activity.description}</p>
                          {activity.venueName && <p className="text-xs text-muted-foreground mt-1">{activity.venueName}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{formatNotificationTime(t, activity.timestamp)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Alerts */}
                  {searchResults.alerts.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t border-border">
                        {t('header.searchSections.alerts')}
                      </div>
                      {searchResults.alerts.map(alert => (
                        <div
                          key={alert.id}
                          onClick={() => handleResultClick('/superadmin')}
                          className="px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                        >
                          <div className="flex items-start space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full mt-1.5 ${
                                alert.type === 'error' ? 'bg-red-500' : alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                            ></div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{alert.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side - Actions and User */}
        <div className="flex items-center space-x-3">
          {/* Go to Venue Dashboard Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToVenueDashboard}
            className="flex items-center space-x-2 border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-300"
            disabled={!allVenues || allVenues.length === 0}
          >
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t('header.venuePanel')}</span>
            <ArrowRight className="w-3 h-3" />
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative p-2 hover:bg-accent rounded-full">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">{unreadCount}</span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">{t('header.notifications')}</h3>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0 ? t('header.notificationsSummary', { count: unreadCount }) : t('header.noNotifications')}
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {isLoadingNotifications ? (
                  <div className="p-3 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start space-x-3">
                        <Skeleton className="w-2 h-2 rounded-full mt-2" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-2">{t('header.notificationsError')}</p>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs">
                      {t('header.retry')}
                    </Button>
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-accent cursor-pointer ${index < notifications.length - 1 ? 'border-b border-border' : ''}`}
                      onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 ${
                            notification.priority === 'HIGH'
                              ? 'bg-red-500'
                              : notification.priority === 'NORMAL'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                        ></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatNotificationTime(t, notification.createdAt)}</p>
                          {notification.actionLabel && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">{notification.actionLabel}</p>
                          )}
                        </div>
                        {!notification.isRead && <div className="w-2 h-2 bg-red-500 rounded-full" title={t('header.unreadTooltip')}></div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t('header.noNotifications')}</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-border">
                <Button variant="ghost" className="w-full text-sm text-muted-foreground hover:text-foreground">
                  {t('header.seeAllNotifications')}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-2 hover:bg-accent rounded-lg">
                <div className="w-8 h-8 bg-linear-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">{user?.firstName?.charAt(0) || 'A'}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('header.superadmin')}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-foreground">{t('header.accountSettings')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                {t('header.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 hover:text-red-700">
                <LogOut className="mr-2 h-4 w-4" />
                {t('header.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export default SuperadminHeader
