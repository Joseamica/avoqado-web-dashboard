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

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  keywords: string[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export function getSuperadminV2Navigation(
  tSidebar: TFunction,
): NavSection[] {
  return [
    {
      title: tSidebar('summary'),
      items: [
        {
          name: tSidebar('main'),
          href: '/superadmin-v2',
          icon: LayoutDashboard,
          keywords: ['dashboard', 'inicio', 'principal', 'home'],
        },
        {
          name: tSidebar('analytics'),
          href: '/superadmin-v2/analytics',
          icon: BarChart3,
          keywords: ['analytics', 'analiticas', 'graficas', 'charts'],
        },
        {
          name: tSidebar('alerts'),
          href: '/superadmin-v2/alerts',
          icon: AlertTriangle,
          keywords: ['alerts', 'alertas', 'warnings'],
        },
      ],
    },
    {
      title: 'Operaciones',
      items: [
        {
          name: tSidebar('venues'),
          href: '/superadmin-v2/venues',
          icon: Building2,
          keywords: ['venues', 'tiendas', 'locales', 'restaurantes'],
        },
        {
          name: 'Onboarding',
          href: '/superadmin-v2/onboarding',
          icon: Wand2,
          keywords: ['onboarding', 'wizard', 'alta', 'registro'],
        },
        {
          name: tSidebar('terminals'),
          href: '/superadmin-v2/terminals',
          icon: Smartphone,
          keywords: ['terminals', 'terminales', 'tpv', 'pos'],
        },
        {
          name: tSidebar('customers'),
          href: '/superadmin-v2/customers',
          icon: Users,
          keywords: ['customers', 'clientes', 'usuarios'],
        },
        {
          name: tSidebar('growth'),
          href: '/superadmin-v2/growth',
          icon: TrendingUp,
          keywords: ['growth', 'crecimiento', 'métricas'],
        },
      ],
    },
    {
      title: 'Ingresos',
      items: [
        {
          name: tSidebar('revenue'),
          href: '/superadmin-v2/revenue',
          icon: DollarSign,
          keywords: ['revenue', 'ingresos', 'dinero', 'facturacion'],
        },
        {
          name: 'Profit Analytics',
          href: '/superadmin-v2/profit-analytics',
          icon: Calculator,
          keywords: ['profit', 'ganancia', 'margen', 'utilidad'],
        },
        {
          name: tSidebar('paymentProviders'),
          href: '/superadmin-v2/payment-providers',
          icon: CreditCard,
          keywords: ['payment', 'providers', 'pagos', 'stripe', 'adyen'],
        },
        {
          name: tSidebar('merchantAccounts'),
          href: '/superadmin-v2/merchant-accounts',
          icon: Wallet,
          keywords: ['merchant', 'accounts', 'cuentas', 'comercio'],
        },
        {
          name: tSidebar('costStructures'),
          href: '/superadmin-v2/cost-structures',
          icon: Receipt,
          keywords: ['cost', 'costos', 'estructura', 'comisiones'],
        },
        {
          name: tSidebar('settlementTerms'),
          href: '/superadmin-v2/settlement-terms',
          icon: Clock,
          keywords: ['settlement', 'liquidacion', 'plazos'],
        },
        {
          name: tSidebar('venuePricing'),
          href: '/superadmin-v2/venue-pricing',
          icon: Tags,
          keywords: ['pricing', 'precios', 'planes', 'tarifas'],
        },
        {
          name: tSidebar('paymentAnalytics'),
          href: '/superadmin-v2/payment-analytics',
          icon: TrendingUp,
          keywords: ['payment', 'analytics', 'pagos', 'analiticas'],
        },
        {
          name: tSidebar('creditAssessment'),
          href: '/superadmin-v2/credit-assessment',
          icon: Banknote,
          keywords: ['credit', 'credito', 'evaluacion', 'riesgo'],
        },
      ],
    },
    {
      title: 'Plataforma',
      items: [
        {
          name: tSidebar('features'),
          href: '/superadmin-v2/features',
          icon: Zap,
          keywords: ['features', 'funciones', 'caracteristicas'],
        },
        {
          name: tSidebar('modules'),
          href: '/superadmin-v2/modules',
          icon: Boxes,
          keywords: ['modules', 'modulos'],
        },
        {
          name: 'Organizaciones',
          href: '/superadmin-v2/organizations',
          icon: Landmark,
          keywords: ['organizations', 'organizaciones', 'orgs'],
        },
        {
          name: tSidebar('system'),
          href: '/superadmin-v2/system',
          icon: Shield,
          keywords: ['system', 'sistema', 'salud', 'health'],
        },
        {
          name: tSidebar('webhooks'),
          href: '/superadmin-v2/webhooks',
          icon: Webhook,
          keywords: ['webhooks', 'integraciones'],
        },
        {
          name: 'Push Notifications',
          href: '/superadmin-v2/push-notifications',
          icon: Bell,
          keywords: ['push', 'notifications', 'notificaciones'],
        },
        {
          name: 'Marketing',
          href: '/superadmin-v2/marketing',
          icon: Mail,
          keywords: ['marketing', 'campañas', 'email', 'campaigns'],
        },
        {
          name: tSidebar('reports'),
          href: '/superadmin-v2/reports',
          icon: FileText,
          keywords: ['reports', 'reportes', 'informes'],
        },
        {
          name: tSidebar('support'),
          href: '/superadmin-v2/support',
          icon: Headphones,
          keywords: ['support', 'soporte', 'tickets', 'ayuda'],
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          name: tSidebar('config'),
          href: '/superadmin-v2/settings',
          icon: Settings,
          keywords: ['config', 'configuracion', 'ajustes', 'settings'],
        },
        {
          name: 'Master TOTP',
          href: '/superadmin-v2/master-totp',
          icon: KeyRound,
          keywords: ['totp', 'master', '2fa', 'autenticacion'],
        },
        {
          name: 'TPV Updates',
          href: '/superadmin-v2/tpv-updates',
          icon: Upload,
          keywords: ['tpv', 'updates', 'actualizaciones', 'firmware'],
        },
      ],
    },
  ]
}
