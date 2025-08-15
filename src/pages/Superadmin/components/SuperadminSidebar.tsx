import React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { themeClasses } from '@/lib/theme-utils'
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

const SuperadminSidebar: React.FC = () => {
  const navigationItems = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/superadmin', icon: LayoutDashboard },
        { name: 'Analytics', href: '/superadmin/analytics', icon: BarChart3 },
        { name: 'Alerts', href: '/superadmin/alerts', icon: AlertTriangle },
      ]
    },
    {
      title: 'Business Management',
      items: [
        { name: 'Venues', href: '/superadmin/venues', icon: Building2 },
        { name: 'Revenue', href: '/superadmin/revenue', icon: DollarSign },
        { name: 'Customers', href: '/superadmin/customers', icon: Users },
        { name: 'Growth', href: '/superadmin/growth', icon: TrendingUp },
      ]
    },
    {
      title: 'Platform',
      items: [
        { name: 'Features', href: '/superadmin/features', icon: Zap },
        { name: 'System Health', href: '/superadmin/system', icon: Shield },
        { name: 'Reports', href: '/superadmin/reports', icon: FileText },
        { name: 'Support', href: '/superadmin/support', icon: Headphones },
      ]
    },
    {
      title: 'Administration',
      items: [
        { name: 'Settings', href: '/superadmin/settings', icon: Settings },
      ]
    }
  ]

  return (
    <div className={cn('h-full border-r', themeClasses.cardBg, themeClasses.border)}>
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-green-600">Avoqado</h1>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6">
        {navigationItems.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
                        'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4" />
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