import { type TFunction } from 'i18next'
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
  Clock,
  Banknote,
  Boxes,
  Landmark,
  KeyRound,
  Upload,
  Bell,
  Wand2,
  Mail,
  type LucideIcon,
} from 'lucide-react'

export interface SuperadminNavItem {
  name: string
  href: string
  icon: LucideIcon
  keywords: string[]
}

export interface SuperadminNavSection {
  title: string
  items: SuperadminNavItem[]
}

export function getSuperadminNavigation(tSidebar: TFunction): SuperadminNavSection[] {
  return [
    {
      title: tSidebar('summary'),
      items: [
        { name: tSidebar('main'), href: '/superadmin', icon: LayoutDashboard, keywords: ['dashboard', 'inicio', 'home'] },
        { name: tSidebar('analytics'), href: '/superadmin/analytics', icon: BarChart3, keywords: ['analytics', 'analiticas'] },
        { name: tSidebar('alerts'), href: '/superadmin/alerts', icon: AlertTriangle, keywords: ['alerts', 'alertas'] },
      ],
    },
    {
      title: tSidebar('business'),
      items: [
        { name: tSidebar('venues'), href: '/superadmin/venues', icon: Building2, keywords: ['venues', 'tiendas', 'locales'] },
        { name: 'Onboarding', href: '/superadmin/onboarding', icon: Wand2, keywords: ['onboarding', 'wizard', 'alta'] },
        { name: tSidebar('terminals'), href: '/superadmin/terminals', icon: Smartphone, keywords: ['terminals', 'terminales', 'tpv'] },
        { name: tSidebar('revenue'), href: '/superadmin/revenue', icon: DollarSign, keywords: ['revenue', 'ingresos'] },
        { name: 'Profit Analytics', href: '/superadmin/profit-analytics', icon: Calculator, keywords: ['profit', 'ganancia'] },
        { name: tSidebar('paymentProviders'), href: '/superadmin/payment-providers', icon: CreditCard, keywords: ['payment', 'providers', 'pagos'] },
        { name: tSidebar('merchantAccounts'), href: '/superadmin/merchant-accounts', icon: Wallet, keywords: ['merchant', 'cuentas'] },
        { name: tSidebar('costStructures'), href: '/superadmin/cost-structures', icon: Receipt, keywords: ['cost', 'costos'] },
        { name: tSidebar('settlementTerms'), href: '/superadmin/settlement-terms', icon: Clock, keywords: ['settlement', 'liquidacion'] },
        { name: tSidebar('venuePricing'), href: '/superadmin/venue-pricing', icon: Tags, keywords: ['pricing', 'precios'] },
        { name: tSidebar('paymentAnalytics'), href: '/superadmin/payment-analytics', icon: TrendingUp, keywords: ['payment', 'analytics'] },
        { name: tSidebar('creditAssessment'), href: '/superadmin/credit-assessment', icon: Banknote, keywords: ['credit', 'credito'] },
        { name: tSidebar('customers'), href: '/superadmin/customers', icon: Users, keywords: ['customers', 'clientes'] },
        { name: tSidebar('growth'), href: '/superadmin/growth', icon: TrendingUp, keywords: ['growth', 'crecimiento'] },
      ],
    },
    {
      title: tSidebar('platform'),
      items: [
        { name: tSidebar('features'), href: '/superadmin/features', icon: Zap, keywords: ['features', 'funciones'] },
        { name: tSidebar('modules'), href: '/superadmin/modules', icon: Boxes, keywords: ['modules', 'modulos'] },
        { name: 'Organizaciones', href: '/superadmin/organizations', icon: Landmark, keywords: ['organizations', 'organizaciones'] },
        { name: 'Usuarios', href: '/superadmin/staff', icon: Users, keywords: ['users', 'usuarios', 'staff', 'personal'] },
        { name: tSidebar('system'), href: '/superadmin/system', icon: Shield, keywords: ['system', 'sistema'] },
        { name: tSidebar('webhooks'), href: '/superadmin/webhooks', icon: Webhook, keywords: ['webhooks', 'integraciones'] },
        { name: 'Push Notifications', href: '/superadmin/push-notifications', icon: Bell, keywords: ['push', 'notifications'] },
        { name: 'Marketing', href: '/superadmin/marketing', icon: Mail, keywords: ['marketing', 'campañas'] },
        { name: tSidebar('reports'), href: '/superadmin/reports', icon: FileText, keywords: ['reports', 'reportes'] },
        { name: tSidebar('support'), href: '/superadmin/support', icon: Headphones, keywords: ['support', 'soporte'] },
      ],
    },
    {
      title: tSidebar('admin'),
      items: [
        { name: tSidebar('config'), href: '/superadmin/settings', icon: Settings, keywords: ['config', 'configuracion'] },
        { name: 'Master TOTP', href: '/superadmin/master-totp', icon: KeyRound, keywords: ['totp', 'master', '2fa'] },
        { name: 'TPV Updates', href: '/superadmin/tpv-updates', icon: Upload, keywords: ['tpv', 'updates', 'firmware'] },
      ],
    },
  ]
}
