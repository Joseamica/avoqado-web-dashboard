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
  Headphones,
  Calculator,
  CreditCard,
  Wallet,
  Receipt,
  Tags,
  Webhook,
  Smartphone,
} from 'lucide-react'

import { useTranslation } from 'react-i18next'

const SuperadminSidebar: React.FC = () => {
  const { t } = useTranslation('superadmin')
  const { t: tSidebar } = useTranslation('sidebar')
  const navigationItems = [
    {
      title: tSidebar('summary'),
      items: [
        { name: tSidebar('main'), href: '/superadmin', icon: LayoutDashboard },
        { name: tSidebar('analytics'), href: '/superadmin/analytics', icon: BarChart3 },
        { name: tSidebar('alerts'), href: '/superadmin/alerts', icon: AlertTriangle },
      ],
    },
    {
      title: tSidebar('business'),
      items: [
        { name: tSidebar('venues'), href: '/superadmin/venues', icon: Building2 },
        { name: tSidebar('terminals'), href: '/superadmin/terminals', icon: Smartphone },
        { name: tSidebar('revenue'), href: '/superadmin/revenue', icon: DollarSign },
        { name: 'Profit Analytics', href: '/superadmin/profit-analytics', icon: Calculator },
        { name: tSidebar('paymentProviders'), href: '/superadmin/payment-providers', icon: CreditCard },
        { name: tSidebar('merchantAccounts'), href: '/superadmin/merchant-accounts', icon: Wallet },
        { name: tSidebar('costStructures'), href: '/superadmin/cost-structures', icon: Receipt },
        { name: tSidebar('venuePricing'), href: '/superadmin/venue-pricing', icon: Tags },
        { name: tSidebar('paymentAnalytics'), href: '/superadmin/payment-analytics', icon: TrendingUp },
        { name: tSidebar('customers'), href: '/superadmin/customers', icon: Users },
        { name: tSidebar('growth'), href: '/superadmin/growth', icon: TrendingUp },
      ],
    },
    {
      title: tSidebar('platform'),
      items: [
        { name: tSidebar('features'), href: '/superadmin/features', icon: Zap },
        { name: tSidebar('system'), href: '/superadmin/system', icon: Shield },
        { name: tSidebar('webhooks'), href: '/superadmin/webhooks', icon: Webhook },
        { name: tSidebar('reports'), href: '/superadmin/reports', icon: FileText },
        { name: tSidebar('support'), href: '/superadmin/support', icon: Headphones },
      ],
    },
    {
      title: tSidebar('admin'),
      items: [{ name: tSidebar('config'), href: '/superadmin/settings', icon: Settings }],
    },
  ]

  return (
    <div className={cn('h-full border-r bg-card border-border flex flex-col')}>
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-linear-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-emerald-600">{t('header.brand')}</h1>
            <p className="text-xs text-muted-foreground">{t('header.title')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6 flex-1 overflow-y-auto">
        {navigationItems.map(section => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{section.title}</h2>
            <ul className="space-y-1">
              {section.items.map(item => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.href === '/superadmin'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-500'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
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
