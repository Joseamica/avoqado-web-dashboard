import React from 'react'
import { Bell, Search, Settings, LogOut, Building2, ArrowRight } from 'lucide-react'
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
import { useSuperadminNotificationData } from '@/hooks/use-superadmin-queries'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/language-switcher'

// Helper function to format notification timestamps
const formatNotificationTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'hace menos de un minuto'
  if (diffInMinutes < 60) return `hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`
  if (diffInMinutes < 1440) return `hace ${Math.floor(diffInMinutes / 60)} hora${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''}`
  return `hace ${Math.floor(diffInMinutes / 1440)} día${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''}`
}

const SuperadminHeader: React.FC = () => {
  const { user, logout, allVenues } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  // Usar TanStack Query para las notificaciones
  const { 
    notifications, 
    unreadCount, 
    isLoading: isLoadingNotifications, 
    isError,
    refetch 
  } = useSuperadminNotificationData(5)

  const goToVenueDashboard = () => {
    if (allVenues && allVenues.length > 0) {
      // Navigate to the first available venue
      navigate(`/venues/${allVenues[0].slug}/home`)
    }
  }

  return (
    <header className="border-b border-border px-6 py-4 bg-card shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left side - Title and System Status */}
        <div className="flex items-center space-x-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('header.title')}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600 dark:text-slate-400">{t('header.systemOperational')}</span>
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
            <Input
              placeholder={t('header.searchPlaceholder')}
              className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400"
            />
          </div>
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">{unreadCount}</span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-50">{t('header.notifications')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {unreadCount > 0 
                    ? `Tienes ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
                    : 'No hay notificaciones sin leer'
                  }
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
                    <p className="text-slate-500 dark:text-slate-400 mb-2">{t('header.notificationsError')}</p>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs">
                      {t('header.retry')}
                    </Button>
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notification, index) => (
                    <div key={notification.id} className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-800 ${index < notifications.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
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
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{notification.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{notification.message}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{formatNotificationTime(notification.createdAt)}</p>
                        </div>
                        {!notification.isRead && <div className="w-2 h-2 bg-red-500 rounded-full" title={t('header.unreadTooltip')}></div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400">{t('header.noNotifications')}</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                <Button variant="ghost" className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50">
                  {t('header.seeAllNotifications')}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">
                    {user?.firstName?.charAt(0) || 'A'}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('header.superadmin')}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-slate-700 dark:text-slate-300">{t('header.accountSettings')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50">
                <Settings className="mr-2 h-4 w-4" />
                {t('header.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
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
