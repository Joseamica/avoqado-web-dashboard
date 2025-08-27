import React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Settings,
  DollarSign,
  TrendingUp,
  Users,
  Shield,
  Zap,
  BarChart3,
  AlertTriangle,
  FileText,
  Headphones
} from 'lucide-react'

import { useTranslation } from 'react-i18next'

const SuperadminSidebar: React.FC = () => {
  const { t } = useTranslation()
  const navigationItems = [
    {
      title: t('sidebar.summary'),
      items: [
        { name: t('sidebar.main'), href: '/superadmin', icon: LayoutDashboard },
        { name: t('sidebar.analytics'), href: '/superadmin/analytics', icon: BarChart3 },
        { name: t('sidebar.alerts'), href: '/superadmin/alerts', icon: AlertTriangle },
      ]
    },
    {
      title: t('sidebar.business'),
      items: [
        { name: t('sidebar.venues'), href: '/superadmin/venues', icon: Building2 },
        { name: t('sidebar.revenue'), href: '/superadmin/revenue', icon: DollarSign },
        { name: t('sidebar.customers'), href: '/superadmin/customers', icon: Users },
        { name: t('sidebar.growth'), href: '/superadmin/growth', icon: TrendingUp },
      ]
    },
    {
      title: t('sidebar.platform'),
      items: [
        { name: t('sidebar.features'), href: '/superadmin/features', icon: Zap },
        { name: t('sidebar.system'), href: '/superadmin/system', icon: Shield },
        { name: t('sidebar.reports'), href: '/superadmin/reports', icon: FileText },
        { name: t('sidebar.support'), href: '/superadmin/support', icon: Headphones },
      ]
    },
    {
      title: t('sidebar.admin'),
      items: [
        { name: t('sidebar.config'), href: '/superadmin/settings', icon: Settings },
      ]
    }
  ]

  return (
    <div className={cn('h-full border-r bg-card border-border')}>
      {/* Logo */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{t('header.brand')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('header.title')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6">
        {navigationItems.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.href === '/superadmin'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

export default SuperadminSidebar
