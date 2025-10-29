// Theme-Aware Component Templates
// Copy these templates when creating new components to ensure proper theming

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ============================================================================
// 1. BASIC CARD TEMPLATE
// ============================================================================
export function ThemeAwareCard() {
  const { t } = useTranslation()
  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-card-foreground">{t('templates.card.title')}</CardTitle>
        <CardDescription className="text-muted-foreground">{t('templates.card.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground">{t('templates.card.main')}</p>
        <p className="text-muted-foreground">{t('templates.card.secondary')}</p>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// 2. FORM TEMPLATE
// ============================================================================
export function ThemeAwareForm() {
  const { t } = useTranslation()
  return (
    <form className="space-y-6">
      {/* Form Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{t('templates.form.title')}</h2>
        <p className="text-muted-foreground">{t('templates.form.description')}</p>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground">{t('templates.form.email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t('templates.form.emailPlaceholder')}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">{t('templates.form.name')}</Label>
          <Input
            id="name"
            type="text"
            placeholder={t('templates.form.namePlaceholder')}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" className="border-border">{t('cancel')}</Button>
        <Button type="submit">{t('common.submit')}</Button>
      </div>
    </form>
  )
}

// ============================================================================
// 3. LIST/TABLE TEMPLATE
// ============================================================================
export function ThemeAwareList() {
  const { t } = useTranslation()
  const items = [
    { id: 1, name: 'Item 1', status: 'active', description: 'Description 1' },
    { id: 2, name: 'Item 2', status: 'inactive', description: 'Description 2' },
  ]

  return (
    <div className="space-y-4">
      {/* List Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t('templates.list.title')}</h3>
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          {items.length} items
        </Badge>
      </div>

      {/* List Items */}
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors"
          >
            <div className="space-y-1">
              <h4 className="font-medium text-foreground">{item.name}</h4>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <Badge
              variant={item.status === 'active' ? 'default' : 'secondary'}
              className={item.status === 'active' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : ''}
            >
              {item.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// 4. ALERT/NOTIFICATION TEMPLATE
// ============================================================================
export function ThemeAwareAlerts() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Success Alert */}
      <Alert className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
        <AlertDescription className="text-green-800 dark:text-green-200">{t('templates.alerts.success')}</AlertDescription>
      </Alert>

      {/* Error Alert */}
      <Alert className="bg-destructive/10 border-destructive/20">
        <AlertDescription className="text-destructive">{t('templates.alerts.error')}</AlertDescription>
      </Alert>

      {/* Warning Alert */}
      <Alert className="bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800">
        <AlertDescription className="text-orange-800 dark:text-orange-200">{t('templates.alerts.warning')}</AlertDescription>
      </Alert>

      {/* Info Alert */}
      <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
        <AlertDescription className="text-blue-800 dark:text-blue-200">{t('templates.alerts.info')}</AlertDescription>
      </Alert>
    </div>
  )
}

// ============================================================================
// 5. MODAL/DIALOG TEMPLATE
// ============================================================================
export function ThemeAwareModal() {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative z-50 w-full max-w-md">
        <div className="bg-background border border-border rounded-lg shadow-lg">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{t('templates.modal.title')}</h2>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              ×
            </Button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4">
            <p className="text-foreground">{t('templates.modal.main')}</p>
            <p className="text-muted-foreground">{t('templates.modal.secondary')}</p>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 p-6 border-t border-border">
            <Button variant="outline">{t('cancel')}</Button>
            <Button>{t('common.confirm')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 6. STATS/METRICS TEMPLATE
// ============================================================================
export function ThemeAwareStats() {
  const stats = [
    { label: 'Total Users', value: '1,234', change: '+12%', trend: 'up' },
    { label: 'Revenue', value: '$45,678', change: '+8%', trend: 'up' },
    { label: 'Orders', value: '890', change: '-2%', trend: 'down' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map(stat => (
        <Card key={stat.label} className="bg-card border-border">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
                <Badge
                  variant="outline"
                  className={
                    stat.trend === 'up'
                      ? 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                      : 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                  }
                >
                  {stat.change}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================================
// 7. SIDEBAR/NAVIGATION TEMPLATE
// ============================================================================
export function ThemeAwareNavigation() {
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', active: true },
    { name: 'Users', href: '/users', active: false },
    { name: 'Settings', href: '/settings', active: false },
  ]

  return (
    <nav className="space-y-2">
      {navItems.map(item => (
        <a
          key={item.name}
          href={item.href}
          className={`
            block px-3 py-2 rounded-md text-sm font-medium transition-colors
            ${item.active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
          `}
        >
          {item.name}
        </a>
      ))}
    </nav>
  )
}

// ============================================================================
// EXPORT ALL TEMPLATES
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeTemplates = {
  Card: ThemeAwareCard,
  Form: ThemeAwareForm,
  List: ThemeAwareList,
  Alerts: ThemeAwareAlerts,
  Modal: ThemeAwareModal,
  Stats: ThemeAwareStats,
  Navigation: ThemeAwareNavigation,
}
