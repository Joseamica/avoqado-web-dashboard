/**
 * Shared venue routes used by both /venues/:slug and /wl/venues/:slug
 *
 * This file eliminates route duplication between the two route families.
 * Any changes to venue-level routes should be made here, NOT in router.tsx.
 *
 * Usage:
 *   { path: '/venues/:slug', element: <Dashboard />, children: createVenueRoutes() }
 *   { path: '/wl/venues/:slug', element: <Dashboard />, children: createVenueRoutes() }
 */

import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { KYCSetupRequired } from '@/pages/KYCSetupRequired'

import { AdminAccessLevel, AdminProtectedRoute } from './AdminProtectedRoute'
import { KYCProtectedRoute } from './KYCProtectedRoute'
import { PermissionProtectedRoute } from './PermissionProtectedRoute'
import { NotWhiteLabelRoute } from './NotWhiteLabelRoute'
import LegacyRedirect from './LegacyRedirect'
import SettingsIndexRedirect from './SettingsIndexRedirect'

import {
  AvailableBalance,
  BasicInfo,
  BillingHistory,
  BillingLayout,
  BillingPaymentMethods,
  BillingSubscriptions,
  BillingTokens,
  Bundles,
  Categories,
  CategoryId,
  CommissionConfigDetailPage,
  CommissionsPage,
  ContactImages,
  CouponForm,
  Coupons,
  CreditPacks,
  CreateCategory,
  CreateMenu,
  CreateModifierGroup,
  CustomerDetail,
  CustomerGroups,
  Customers,
  DiscountDetail,
  DiscountForm,
  Discounts,
  Upsell,
  GoogleIntegration,
  Home,
  HomeDashboardCharts,
  InventoryLayout,
  InventorySummary,
  InventoryHistory,
  LoyaltySettings,
  WalletCardDesigner,
  ReferralsSettings,
  MenuId,
  MenuMakerLayout,
  MenuOverview,
  Menus,
  ModifierGroups,
  ModifierInventory,
  ModifierAnalytics,
  NotificationPreferences,
  NotificationPreferences1,
  NotificationPreferences2,
  NotificationPreferences3,
  NotificationPreferences4,
  NotificationPreferences5,
  Notifications,
  Orders,
  PayLaterAging,
  PaymentLinkBranding,
  PaymentLinks,
  Ecommerce,
  PaymentLinkSettings,
  ReservationBranding,
  Payments,
  ProductId,
  Products,
  ProductStock,
  RawMaterials,
  Services,
  Recipes,
  Profitability,
  ProfileSettings,
  SecuritySettings,
  PreferenceSettings,
  SettingsLayout,
  ReservationsPage,
  ReservationDetail,
  ReservationCalendar,
  ReservationWaitlist,
  ReservationSettingsPage,
  OnlineBookingPage,
  Reviews,
  CfdiList,
  CfdiConfiguracion,
  DeliveryPage,
  RolePermissions,
  PrintStations,
  TenderTypes,
  AreaTickets,
  ExternalSettlements,
  SalesByItem,
  SalesByCategory,
  PaymentMethods,
  Refunds,
  PromotionSales,
  SalesSummary,
  IncomeStatement,
  BankReconciliation,
  BusinessSummary,
  BankAndCash,
  BancosResumen,
  BancosMovimientos,
  BancosTransferencias,
  BancosBeneficiarios,
  BancosReportes,
  BancosSpei,
  BancosDispersiones,
  ChartOfAccounts,
  AccountMapping,
  Journal,
  TrialBalance,
  AccountingReports,
  CashBasisVat,
  Expenses,
  Isr,
  FixedAssets,
  Nomina,
  FiscalReadiness,
  AccountsPayable,
  ShiftId,
  Shifts,
  SuppliersPage,
  PurchaseOrdersPage,
  PurchaseOrderDetailPage,
  StockCountsPage,
  StockCountDetailPage,
  InventoryTransfersPage,
  InventoryTransferDetailPage,
  InterVenueTransfersPage,
  InterVenueTransferDetailPage,
  AutoReorderSettings,
  MerchantRoutingRules,
  TeamId,
  Teams,
  Attendance,
  TerminalOrderDetail,
  Tpv,
  TpvId,
  VenueDocuments,
  VenueFiscalProfile,
  VenueActivityLog,
  VenueEditLayout,
  VenueIntegrations,
  Disputes,
  Subscriptions,
  VirtualTerminal,
} from './lazyComponents'

/**
 * Creates the shared route children for venue-level dashboards.
 * These routes are used in both /venues/:slug/* and /wl/venues/:slug/* paths.
 */
export function createVenueRoutes(): RouteObject[] {
  return [
    // KYC setup page (used by KYCProtectedRoute redirects)
    { path: 'kyc-required', element: <KYCSetupRequired /> },

    // Home Dashboard (requires home:read permission)
    {
      element: <PermissionProtectedRoute permission="home:read" />,
      children: [
        { index: true, element: <Home /> },
        { path: 'home', element: <Home /> },
      ],
    },

    // Legacy: account page moved into the Settings Hub
    { path: 'account', element: <LegacyRedirect to="settings/profile" /> },

    // Menu Management (requires menu:read permission)
    {
      path: 'menumaker',
      element: <PermissionProtectedRoute permission="menu:read" />,
      children: [
        {
          element: <MenuMakerLayout />,
          children: [
            { index: true, element: <MenuOverview /> },
            { path: 'overview', element: <MenuOverview /> },
            { path: 'menus', element: <Menus /> },
            { path: 'menus/:menuId', element: <MenuId /> },
            { path: 'menus/create', element: <CreateMenu /> },
            { path: 'categories', element: <Categories /> },
            { path: 'categories/:categoryId', element: <CategoryId /> },
            { path: 'categories/create', element: <CreateCategory /> },
            { path: 'products', element: <Products /> },
            { path: 'products/:productId', element: <ProductId /> },
            { path: 'products/create', element: <Navigate to="../products" replace /> },
            { path: 'services', element: <Services /> },
            { path: 'modifier-groups', element: <ModifierGroups /> },
            { path: 'modifier-groups/create', element: <CreateModifierGroup /> },
            { path: 'credit-packs', element: <CreditPacks /> },
          ],
        },
      ],
    },

    // Shifts Management (requires shifts:read permission + KYC verification)
    {
      element: <PermissionProtectedRoute permission="shifts:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'shifts', element: <Shifts /> },
            { path: 'shifts/:shiftId', element: <ShiftId /> },
          ],
        },
      ],
    },

    // Payments (requires payments:read permission + KYC verification)
    // Both /payments and /payments/:paymentId render the same <Payments /> component.
    // When :paymentId is present the component opens an inline drawer over its list
    // (Square-style). The full-page <PaymentId /> is kept @deprecated.
    {
      element: <PermissionProtectedRoute permission="payments:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'payments', element: <Payments /> },
            // Reglas de cuentas de cobro — self-gates con <FeatureGate feature="MERCHANT_ROUTING_RULES"> (PREMIUM)
            { path: 'payments/routing-rules', element: <MerchantRoutingRules /> },
            { path: 'payments/:paymentId', element: <Payments /> },
          ],
        },
      ],
    },

    // Orders (requires orders:read permission + KYC verification)
    // Both /orders and /orders/:orderId render the same <Orders /> component.
    // When :orderId is present the component opens an inline drawer over its list
    // (Square-style OrderDrawerContent).
    {
      element: <PermissionProtectedRoute permission="orders:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'orders', element: <Orders /> },
            { path: 'orders/:orderId', element: <Orders /> },
          ],
        },
      ],
    },

    // (removed 2026-08-17) La ruta 'analytics' servía `/api/v1/analytics/overview`, que era un MOCK
    // con `Math.random()`: ARR/MRR/NPS/churn inventados —métricas de SaaS, ni siquiera de un venue—
    // que cambiaban en cada recarga y cualquier MANAGER/OWNER/VIEWER podía abrir como si fueran suyos.
    // No estaba enlazada en ningún lado. Los reportes REALES viven en /reports y /command-center.

    // Reports
    {
      path: 'reports/pay-later-aging',
      element: <PermissionProtectedRoute permission="tpv-reports:pay-later-aging" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [{ index: true, element: <PayLaterAging /> }],
        },
      ],
    },
    {
      path: 'reports/sales-summary',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <SalesSummary /> }],
    },
    {
      path: 'reports/sales-by-item',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <SalesByItem /> }],
    },
    {
      path: 'reports/sales-by-category',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <SalesByCategory /> }],
    },
    {
      path: 'reports/payment-methods',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <PaymentMethods /> }],
    },
    {
      path: 'reports/refunds',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <Refunds /> }],
    },
    // Promociones: el COMBO como renglón. Complemento de reports/sales-by-item,
    // que muestra los componentes marcados "dentro de «Combo X»".
    {
      path: 'reports/promotions',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <PromotionSales /> }],
    },
    // Bancos — hub de banca en vivo (PRO, teaser visible). Permiso financialConnections:manage;
    // el FeatureGate PRO vive dentro de cada página. Distinto de contabilidad/bancos (conciliación).
    {
      path: 'bancos',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosResumen /> }],
    },
    {
      path: 'bancos/movimientos',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosMovimientos /> }],
    },
    {
      path: 'bancos/transferencias',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosTransferencias /> }],
    },
    {
      path: 'bancos/beneficiarios',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosBeneficiarios /> }],
    },
    {
      path: 'bancos/reportes',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosReportes /> }],
    },
    {
      // SPEI externo: LIVE — envío real a cualquier banco (backend con idempotencia + auditoría).
      path: 'bancos/spei',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosSpei /> }],
    },
    {
      // Dispersiones: ruta viva (por si alguien llega por URL directa), pero el sidebar la
      // mantiene comingSoon — la página deja el submit deshabilitado (sin backend de lote aún).
      path: 'bancos/dispersiones',
      element: <PermissionProtectedRoute permission="financialConnections:manage" />,
      children: [{ index: true, element: <BancosDispersiones /> }],
    },
    {
      // Contabilidad → ¿Cuánto gané? (Capa A, gerencial). Incluido, gateado por accounting:read.
      path: 'contabilidad/ingresos',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <IncomeStatement /> }],
    },
    {
      // Contabilidad → Conciliación con IA (Bancos). Gateado por permiso + FeatureGate PRO en la página.
      path: 'contabilidad/conciliacion',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <BankReconciliation /> }],
    },
    {
      // Contabilidad → Resumen del negocio (Capa A, portada). Incluido, gateado por accounting:read.
      path: 'contabilidad/resumen',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <BusinessSummary /> }],
    },
    {
      // Contabilidad → Bancos y cajas (Capa A, cuentas de dinero). Incluido, gateado por accounting:read.
      path: 'contabilidad/bancos',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <BankAndCash /> }],
    },
    {
      // Contabilidad → Buzón de CFDIs / Gastos (Capa B fiscal). Permiso accounting:read +
      // FeatureGate CFDI (PREMIUM) en la página. CFDIs recibidos → IVA acreditable + DIOT.
      path: 'contabilidad/buzon',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <Expenses /> }],
    },
    {
      // Contabilidad → Preparación fiscal (onboarding, Capa B). Permiso accounting:read +
      // FeatureGate CFDI (PREMIUM) en la página. Checklist read-only de qué falta para operar.
      path: 'contabilidad/preparacion',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <FiscalReadiness /> }],
    },
    {
      // Contabilidad → ISR · Pago provisional (Capa B fiscal). Permiso accounting:read +
      // FeatureGate CFDI (PREMIUM) en la página. Estimación RESICO / régimen general.
      path: 'contabilidad/isr',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <Isr /> }],
    },
    {
      // Contabilidad → Activos fijos · depreciación (Capa B fiscal). Permiso accounting:read +
      // FeatureGate CFDI (PREMIUM) en la página. Deducción de inversiones (LISR 34-35), opt-in.
      path: 'contabilidad/activos-fijos',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <FixedAssets /> }],
    },
    {
      // Contabilidad → Nómina (Capa B fiscal). Permiso accounting:read + FeatureGate CFDI (PREMIUM)
      // en la página. Empleados + corrida de nómina (ISR/IMSS) + póliza.
      path: 'contabilidad/nomina',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <Nomina /> }],
    },
    {
      // Contabilidad → Catálogo de cuentas (Capa B fiscal). Permiso accounting:read + FeatureGate
      // CFDI (PREMIUM, bundle con facturación) en la página.
      path: 'contabilidad/catalogo',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <ChartOfAccounts /> }],
    },
    {
      // Contabilidad → Configuración contable (AccountMapping, Capa B). Permiso accounting:read +
      // FeatureGate CFDI (PREMIUM) en la página.
      path: 'contabilidad/configuracion',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <AccountMapping /> }],
    },
    {
      // Contabilidad → Libro diario · Pólizas (motor de doble partida, Capa B). Permiso
      // accounting:read + FeatureGate CFDI (PREMIUM) en la página.
      path: 'contabilidad/libro-diario',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <Journal /> }],
    },
    {
      // Contabilidad → Balanza de comprobación (read-model sobre pólizas, Capa B). Permiso
      // accounting:read + FeatureGate CFDI (PREMIUM) en la página.
      path: 'contabilidad/balanza',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <TrialBalance /> }],
    },
    {
      // Contabilidad → Reportes contables (Estado de resultados + Balance general, Capa B).
      // Permiso accounting:read + FeatureGate CFDI (PREMIUM) en la página.
      path: 'contabilidad/reportes',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <AccountingReports /> }],
    },
    {
      // Contabilidad → IVA en flujo de efectivo · DIOT (read-model honesto sobre lo cobrado, Capa B).
      // Permiso accounting:read + FeatureGate CFDI (PREMIUM) en la página.
      path: 'contabilidad/impuestos',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <CashBasisVat /> }],
    },
    {
      // Contabilidad → Cuentas por pagar (antigüedad de saldos a proveedores, Capa B). Permiso
      // accounting:read + FeatureGate CFDI (PREMIUM) en la página. Read-only sobre el Buzón.
      path: 'contabilidad/cuentas-por-pagar',
      element: <PermissionProtectedRoute permission="accounting:read" />,
      children: [{ index: true, element: <AccountsPayable /> }],
    },
    {
      path: 'reports/home-charts',
      element: <KYCProtectedRoute />,
      children: [{ index: true, element: <HomeDashboardCharts /> }],
    },

    // Available Balance (requires settlements:read permission + KYC verification)
    {
      element: <PermissionProtectedRoute permission="settlements:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [{ path: 'available-balance', element: <AvailableBalance /> }],
        },
      ],
    },

    // Legacy: venue edit moved into the Settings Hub (settings/local + settings/integrations)
    {
      path: 'edit',
      children: [
        { index: true, element: <LegacyRedirect to="settings/local/basic-info" /> },
        { path: 'basic-info', element: <LegacyRedirect to="settings/local/basic-info" /> },
        { path: 'general', element: <LegacyRedirect to="settings/local/basic-info" /> },
        { path: 'contact-images', element: <LegacyRedirect to="settings/local/contact-images" /> },
        { path: 'documents', element: <LegacyRedirect to="settings/local/documents" /> },
        { path: 'chat', element: <LegacyRedirect to="settings/integrations" /> },
        { path: 'integrations', element: <LegacyRedirect to="settings/integrations" /> },
        { path: 'integrations/google', element: <LegacyRedirect to="settings/integrations/google" /> },
      ],
    },

    // Device Management (requires tpv:read permission + KYC verification)
    {
      element: <PermissionProtectedRoute permission="tpv:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'devices', element: <Tpv /> },
            // Order detail comes BEFORE :tpvId so it matches first
            // (otherwise `devices/orders/:id` would be captured by `devices/:tpvId`).
            { path: 'devices/orders/:id', element: <TerminalOrderDetail /> },
            { path: 'devices/:tpvId', element: <TpvId /> },

            // Legacy aliases preserve bookmarks while canonical navigation moves to /devices.
            { path: 'tpv', element: <LegacyRedirect to="devices" preserveSearchAndHash /> },
            {
              path: 'tpv/orders/:id',
              element: (
                <LegacyRedirect to={({ fullBasePath, params }) => `${fullBasePath}/devices/orders/${params.id}`} preserveSearchAndHash />
              ),
            },
            {
              path: 'tpv/:tpvId',
              element: (
                <LegacyRedirect to={({ fullBasePath, params }) => `${fullBasePath}/devices/${params.tpvId}`} preserveSearchAndHash />
              ),
            },
          ],
        },
      ],
    },

    // Reviews (requires reviews:read permission)
    {
      element: <PermissionProtectedRoute permission="reviews:read" />,
      children: [{ path: 'reviews', element: <Reviews /> }],
    },

    // Team Management (requires teams:read permission)
    {
      path: 'team',
      element: <PermissionProtectedRoute permission="teams:read" />,
      children: [
        { index: true, element: <Teams /> },
        { path: ':memberId', element: <TeamId /> },
      ],
    },

    // Asistencia — revisar checadas. Marcar entrada/salida NO vive aqui: eso pasa en la
    // terminal y en la app. 🔴 Bloqueada en white-label: PlayTelecom tiene su propia pantalla
    // de asistencia y el sidebar ya la oculta, pero `createVenueRoutes()` se monta entero bajo
    // /wl/venues/:slug, así que sin este guard era alcanzable por URL (auditoría Codex, P1).
    {
      element: <NotWhiteLabelRoute />,
      children: [
        {
          element: <PermissionProtectedRoute permission="attendance:read" />,
          children: [{ path: 'asistencia', element: <Attendance /> }],
        },
      ],
    },

    // Commission Management (requires commissions:read permission)
    {
      path: 'commissions',
      element: <PermissionProtectedRoute permission="commissions:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { index: true, element: <CommissionsPage /> },
            { path: 'config/:configId', element: <CommissionConfigDetailPage /> },
          ],
        },
      ],
    },

    // Customer Management (requires customers:read permission)
    {
      path: 'customers',
      element: <PermissionProtectedRoute permission="customers:read" />,
      children: [
        { index: true, element: <Customers /> },
        { path: 'groups', element: <CustomerGroups /> },
        { path: ':customerId', element: <CustomerDetail /> },
      ],
    },

    // Reservation Management (core feature — permission-gated only)
    {
      path: 'reservations',
      element: <PermissionProtectedRoute permission="reservations:read" />,
      children: [
        { index: true, element: <ReservationsPage /> },
        { path: 'calendar', element: <ReservationCalendar /> },
        { path: 'waitlist', element: <ReservationWaitlist /> },
        {
          path: 'settings',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [{ index: true, element: <ReservationSettingsPage /> }],
        },
        {
          path: 'online-booking',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [{ index: true, element: <OnlineBookingPage /> }],
        },
        { path: 'branding', element: <ReservationBranding /> },
        { path: ':reservationId', element: <ReservationDetail /> },
      ],
    },

    // Payment Links
    {
      path: 'payment-links',
      element: <PermissionProtectedRoute permission="payment-link:read" />,
      children: [
        { index: true, element: <PaymentLinks /> },
        { path: 'settings', element: <PaymentLinkSettings /> },
        { path: 'branding', element: <PaymentLinkBranding /> },
      ],
    },

    // E-commerce (connected processors + embeddable checkout widget)
    {
      path: 'ecommerce',
      element: <PermissionProtectedRoute permission="payment-link:read" />,
      children: [{ index: true, element: <Ecommerce /> }],
    },

    // Disputes (Coming Soon)
    {
      path: 'disputes',
      element: <PermissionProtectedRoute permission="payments:read" />,
      children: [{ index: true, element: <Disputes /> }],
    },

    // Subscriptions (Coming Soon)
    {
      path: 'subscriptions',
      element: <PermissionProtectedRoute permission="payments:read" />,
      children: [{ index: true, element: <Subscriptions /> }],
    },

    // Virtual Terminal (Coming Soon)
    {
      path: 'virtual-terminal',
      element: <PermissionProtectedRoute permission="payments:read" />,
      children: [{ index: true, element: <VirtualTerminal /> }],
    },

    // Loyalty Settings (requires loyalty:read permission)
    // El diseñador de la credencial cuelga de aquí a propósito: hereda el mismo
    // permiso y, en el backend, el mismo candado de plan PRO que el resto de
    // `/loyalty/*` — sin declarar un segundo gate que se pueda desincronizar.
    {
      path: 'loyalty',
      element: <PermissionProtectedRoute permission="loyalty:read" />,
      children: [
        { index: true, element: <LoyaltySettings /> },
        { path: 'card', element: <WalletCardDesigner /> },
      ],
    },

    // Referrals Program (requires referral:read permission)
    {
      path: 'referrals',
      element: <PermissionProtectedRoute permission="referral:read" />,
      children: [{ index: true, element: <ReferralsSettings /> }],
    },

    // Facturación (CFDI) — VISIBLE TEASER, no FeatureProtectedRoute wrapper.
    // The pages always render so the feature stays discoverable; when the venue
    // lacks the CFDI VenueFeature the page shows an upsell teaser (FeatureTeaser)
    // instead of redirecting away. Still gated by granular permissions:
    // cfdi:view to read the list, cfdi:configure to manage emisores / CSD /
    // merchant config.
    {
      path: 'cfdi',
      element: <PermissionProtectedRoute permission="cfdi:view" />,
      children: [{ index: true, element: <CfdiList /> }],
    },
    {
      path: 'cfdi/configuracion',
      element: <PermissionProtectedRoute permission="cfdi:configure" />,
      children: [{ index: true, element: <CfdiConfiguracion /> }],
    },

    // Delivery — VISIBLE TEASER (Premium feature DELIVERY_CHANNELS, plan-catalog.ts), same pattern
    // as CFDI above: no FeatureProtectedRoute wrapper, the page always renders so it stays
    // discoverable and the <FeatureGate> INSIDE DeliveryPage handles the paywall for venues that
    // lack the feature. Gated by the delivery-channels:read permission only.
    {
      path: 'delivery',
      element: <PermissionProtectedRoute permission="delivery-channels:read" />,
      children: [{ index: true, element: <DeliveryPage /> }],
    },

    // Legacy: activity log moved into the Settings Hub
    { path: 'activity-log', element: <LegacyRedirect to="settings/activity-log" /> },

    // La miga de pan enlaza CADA segmento, así que "Promociones" era un enlace
    // que llevaba a un 404 — en Descuentos, Cupones y Sugerencias por igual.
    // Cae en la primera página del grupo, como hace Configuración con su índice.
    { path: 'promotions', element: <LegacyRedirect to="promotions/discounts" /> },

    // Promotions - Discounts (requires discounts:read permission)
    {
      path: 'promotions/discounts',
      element: <PermissionProtectedRoute permission="discounts:read" />,
      children: [
        { index: true, element: <Discounts /> },
        { path: 'create', element: <DiscountForm /> },
        { path: ':discountId', element: <DiscountDetail /> },
      ],
    },

    // Promotions - Upsell "¿Algo más?" (requiere upsells:read; la página se auto-gatea
    // con <FeatureGate feature="UPSELL"> para que PRO lo vea y FREE reciba el upsell)
    {
      path: 'promotions/upsell',
      element: <PermissionProtectedRoute permission="upsells:read" />,
      children: [{ index: true, element: <Upsell /> }],
    },

    // Promotions - Coupons (requires coupons:read permission)
    {
      path: 'promotions/coupons',
      element: <PermissionProtectedRoute permission="coupons:read" />,
      children: [
        { index: true, element: <Coupons /> },
        { path: 'create', element: <CouponForm /> },
        { path: ':couponId', element: <CouponForm /> },
      ],
    },

    // Promotions - Combos y paquetes (BUNDLE/COMBO/2x1). Teaser visible: el
    // permiso protege la ruta; el tier lo gatea <FeatureGate> DENTRO de la
    // página para que FREE vea el candado y el upsell, no un redirect.
    {
      path: 'promotions/bundles',
      element: <PermissionProtectedRoute permission="discounts:read" />,
      children: [{ index: true, element: <Bundles /> }],
    },

    // Notifications
    { path: 'notifications', element: <Notifications /> },
    { path: 'notifications/preferences', element: <NotificationPreferences /> },
    { path: 'notifications/preferences/1', element: <NotificationPreferences1 /> },
    { path: 'notifications/preferences/2', element: <NotificationPreferences2 /> },
    { path: 'notifications/preferences/3', element: <NotificationPreferences3 /> },
    { path: 'notifications/preferences/4', element: <NotificationPreferences4 /> },
    { path: 'notifications/preferences/5', element: <NotificationPreferences5 /> },

    // ── Settings Hub — "Tu cuenta" + "Este local" in one two-pane layout ──
    {
      path: 'settings',
      element: <SettingsLayout />,
      children: [
        { index: true, element: <SettingsIndexRedirect /> },

        // Tu cuenta (no special permission — mirrors the old /account route)
        { path: 'profile', element: <ProfileSettings /> },
        { path: 'security', element: <SecuritySettings /> },
        { path: 'preferences', element: <PreferenceSettings /> },
        { path: 'notifications', element: <NotificationPreferences /> },

        // Este local — venue information (ex /edit, minus integrations)
        {
          path: 'local',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [
            {
              element: <VenueEditLayout />,
              children: [
                { index: true, element: <Navigate to="basic-info" replace /> },
                { path: 'basic-info', element: <BasicInfo /> },
                { path: 'contact-images', element: <ContactImages /> },
                { path: 'documents', element: <VenueDocuments /> },
                // Datos fiscales del venue como receptor de las facturas de Avoqado — más
                // estricto que el resto de "local" (ADMIN): sólo OWNER captura estos datos.
                {
                  path: 'fiscal',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.OWNER} />,
                  children: [{ index: true, element: <VenueFiscalProfile /> }],
                },
              ],
            },
            // Legacy: WhatsApp chat moved into the Integrations catalog
            { path: 'chat', element: <LegacyRedirect to="settings/integrations" /> },
          ],
        },

        // Este local — integrations, promoted to its own section
        {
          path: 'integrations',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [
            { index: true, element: <VenueIntegrations /> },
            { path: 'google', element: <GoogleIntegration /> },
          ],
        },

        // Este local — roles (URL unchanged: settings/role-permissions)
        {
          path: 'role-permissions',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [{ index: true, element: <RolePermissions /> }],
        },

        // Este local — billing (URL unchanged: settings/billing/*) — inner block moved VERBATIM from the old settings/billing route
        {
          path: 'billing',
          element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
          children: [
            {
              element: <PermissionProtectedRoute permission="billing:read" />,
              children: [
                {
                  element: <BillingLayout />,
                  children: [
                    { index: true, element: <Navigate to="subscriptions" replace /> },
                    {
                      path: 'subscriptions',
                      element: <PermissionProtectedRoute permission="billing:subscriptions:read" />,
                      children: [{ index: true, element: <BillingSubscriptions /> }],
                    },
                    {
                      path: 'history',
                      element: <PermissionProtectedRoute permission="billing:history:read" />,
                      children: [{ index: true, element: <BillingHistory /> }],
                    },
                    {
                      path: 'payment-methods',
                      element: <PermissionProtectedRoute permission="billing:payment-methods:read" />,
                      children: [{ index: true, element: <BillingPaymentMethods /> }],
                    },
                    {
                      path: 'tokens',
                      element: <PermissionProtectedRoute permission="billing:tokens:read" />,
                      children: [{ index: true, element: <BillingTokens /> }],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Este local — activity log (page self-gates with FeatureGate VENUE_AUDIT_LOG)
        {
          path: 'activity-log',
          element: <PermissionProtectedRoute permission="activity:read" />,
          children: [{ index: true, element: <VenueActivityLog /> }],
        },

        // Este local — impresoras y estaciones (FREE; ruteo de comandas cocina/barra)
        {
          path: 'print-stations',
          element: <PermissionProtectedRoute permission="printers:read" />,
          children: [{ index: true, element: <PrintStations /> }],
        },
        // Este local — tipos de pago personalizados (VenueTenderType, core/FREE; el POS
        // los consumirá en la slice B — mientras tanto la pantalla lo dice con un badge)
        {
          path: 'tender-types',
          element: <PermissionProtectedRoute permission="tender-types:read" />,
          children: [{ index: true, element: <TenderTypes /> }],
        },
        {
          path: 'area-tickets',
          element: <PermissionProtectedRoute permission="area-tickets:configure" />,
          children: [{ index: true, element: <AreaTickets /> }],
        },
        // Cobros por confirmar + incidencias de la ruta externa (§caja externa fase 1,
        // Task 15) — misma permiso que la configuración de arriba: quien puede
        // encender la ruta externa puede ver su cola de trabajo. Sólo lectura.
        {
          path: 'area-tickets/external-settlements',
          element: <PermissionProtectedRoute permission="area-tickets:configure" />,
          children: [{ index: true, element: <ExternalSettlements /> }],
        },
      ],
    },

    // Inventory Management (inventory:read permission + KYC verification)
    // Granular permission only — venue admins can grant `inventory:read` to MANAGER
    // (or any other role) via the per-venue role customization editor and have it
    // actually take effect. The legacy `AdminProtectedRoute` was removed because it
    // bypassed the customization system: even after granting the permission,
    // non-ADMIN roles were redirected back to home.
    {
      path: 'inventory',
      element: <PermissionProtectedRoute permission="inventory:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            {
              element: <InventoryLayout />,
              children: [
                { index: true, element: <Navigate to="stock-overview" replace /> },
                { path: 'stock-overview', element: <InventorySummary /> },
                { path: 'raw-materials', element: <RawMaterials /> },
                { path: 'history', element: <InventoryHistory /> },
                // Stock counts — READ-ONLY audit view. Counts are created in the mobile POS apps.
                { path: 'stock-counts', element: <StockCountsPage /> },
                { path: 'stock-counts/:countId', element: <StockCountDetailPage /> },
                { path: 'counts', element: <Navigate to="../stock-counts" replace /> },
                // Inventory transfers — READ-ONLY audit view. Transfers are created in the mobile POS apps.
                { path: 'transfers', element: <InventoryTransfersPage /> },
                { path: 'transfers/:transferId', element: <InventoryTransferDetailPage /> },
                {
                  element: <PermissionProtectedRoute permission="inventory-transfers:read" />,
                  children: [
                    { path: 'inter-venue-transfers', element: <InterVenueTransfersPage /> },
                    { path: 'inter-venue-transfers/:transferId', element: <InterVenueTransferDetailPage /> },
                  ],
                },
                { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
                { path: 'purchase-orders/:poId', element: <PurchaseOrderDetailPage /> },
                { path: 'vendors', element: <div>Vendors</div> }, // Placeholder
                { path: 'suppliers', element: <SuppliersPage /> },
                { path: 'restocks', element: <div>Restocks</div> }, // Placeholder
                { path: 'ingredients', element: <RawMaterials /> }, // Ingredients = Raw Materials
                { path: 'product-stock', element: <ProductStock /> },
                { path: 'recipes', element: <Recipes /> },
                { path: 'profitability', element: <Profitability /> },
                { path: 'pricing', element: <Navigate to="../recipes" replace /> },
                { path: 'modifiers', element: <ModifierInventory /> },
                { path: 'modifier-analytics', element: <ModifierAnalytics /> },
                // Auto-reorder settings — page self-gates with <FeatureGate feature="AUTO_REORDER"> (PREMIUM)
                { path: 'auto-reorder', element: <AutoReorderSettings /> },
              ],
            },
          ],
        },
      ],
    },
  ]
}
