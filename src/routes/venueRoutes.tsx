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
import { ManagerProtectedRoute } from './ManagerProtectedRoute'
import { PermissionProtectedRoute } from './PermissionProtectedRoute'

import {
  Account,
  AnalyticsLayout,
  AnalyticsOverview,
  AvailableBalance,
  BasicInfo,
  BillingHistory,
  BillingLayout,
  BillingPaymentMethods,
  BillingSubscriptions,
  BillingTokens,
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
  GoogleIntegration,
  Home,
  HomeDashboardCharts,
  InventoryLayout,
  InventorySummary,
  InventoryHistory,
  LoyaltySettings,
  ReferralsSettings,
  MenuId,
  MenuMakerLayout,
  MenuOverview,
  Menus,
  ModifierGroupId,
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
  ReservationsPage,
  ReservationDetail,
  ReservationCalendar,
  ReservationWaitlist,
  ReservationSettingsPage,
  OnlineBookingPage,
  Reviews,
  CfdiList,
  CfdiConfiguracion,
  RolePermissions,
  SalesByItem,
  SalesByCategory,
  PaymentMethods,
  Refunds,
  SalesSummary,
  IncomeStatement,
  BankReconciliation,
  BusinessSummary,
  BankAndCash,
  ChartOfAccounts,
  AccountMapping,
  Journal,
  TrialBalance,
  AccountingReports,
  CashBasisVat,
  Expenses,
  Isr,
  Nomina,
  FiscalReadiness,
  ShiftId,
  Shifts,
  SuppliersPage,
  PurchaseOrdersPage,
  PurchaseOrderDetailPage,
  StockCountsPage,
  StockCountDetailPage,
  InventoryTransfersPage,
  InventoryTransferDetailPage,
  AutoReorderSettings,
  TeamId,
  Teams,
  TerminalOrderDetail,
  Tpv,
  TpvId,
  VenueDocuments,
  VenueChat,
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

    // Account (no special permission)
    { path: 'account', element: <Account /> },

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
            { path: 'modifier-groups/:modifierGroupId', element: <ModifierGroupId /> },
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

    // Analytics (requires MANAGER+ or VIEWER role + KYC verification)
    {
      path: 'analytics',
      element: <ManagerProtectedRoute allowViewer={true} />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            {
              element: <AnalyticsLayout />,
              children: [{ index: true, element: <AnalyticsOverview /> }],
            },
          ],
        },
      ],
    },

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

    // Venue Edit (ADMIN only)
    {
      path: 'edit',
      element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
      children: [
        {
          element: <VenueEditLayout />,
          children: [
            { index: true, element: <Navigate to="basic-info" replace /> },
            { path: 'basic-info', element: <BasicInfo /> },
            { path: 'contact-images', element: <ContactImages /> },
            { path: 'general', element: <Navigate to="../basic-info" replace /> },
            { path: 'documents', element: <VenueDocuments /> },
            {
              path: 'integrations',
              children: [
                { index: true, element: <VenueIntegrations /> },
                { path: 'google', element: <GoogleIntegration /> },
              ],
            },
            { path: 'chat', element: <VenueChat /> },
          ],
        },
      ],
    },

    // TPV Management (requires tpv:read permission + KYC verification)
    {
      element: <PermissionProtectedRoute permission="tpv:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'tpv', element: <Tpv /> },
            // Order detail comes BEFORE :tpvId so it matches first
            // (otherwise `tpv/orders/:id` would be captured by `tpv/:tpvId`).
            { path: 'tpv/orders/:id', element: <TerminalOrderDetail /> },
            { path: 'tpv/:tpvId', element: <TpvId /> },
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
    {
      path: 'loyalty',
      element: <PermissionProtectedRoute permission="loyalty:read" />,
      children: [{ index: true, element: <LoyaltySettings /> }],
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

    // Activity Log (requires activity:read permission)
    // VISIBLE TEASER: page self-gates with <FeatureGate feature="VENUE_AUDIT_LOG"> (PRO)
    // so we use PermissionProtectedRoute only — no FeatureProtectedRoute wrapper.
    {
      element: <PermissionProtectedRoute permission="activity:read" />,
      children: [{ path: 'activity-log', element: <VenueActivityLog /> }],
    },

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


    // Notifications
    { path: 'notifications', element: <Notifications /> },
    { path: 'notifications/preferences', element: <NotificationPreferences /> },
    { path: 'notifications/preferences/1', element: <NotificationPreferences1 /> },
    { path: 'notifications/preferences/2', element: <NotificationPreferences2 /> },
    { path: 'notifications/preferences/3', element: <NotificationPreferences3 /> },
    { path: 'notifications/preferences/4', element: <NotificationPreferences4 /> },
    { path: 'notifications/preferences/5', element: <NotificationPreferences5 /> },

    // Role Permissions Management (OWNER and ADMIN only)
    {
      path: 'settings/role-permissions',
      element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
      children: [{ index: true, element: <RolePermissions /> }],
    },

    // Billing Management (requires billing:read permission + ADMIN role)
    {
      path: 'settings/billing',
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
