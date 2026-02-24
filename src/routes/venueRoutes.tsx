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
  CreateCategory,
  CreateMenu,
  CreateModifierGroup,
  CreateProduct,
  CustomerDetail,
  CustomerGroups,
  Customers,
  DiscountDetail,
  DiscountForm,
  Discounts,
  GoogleIntegration,
  Home,
  InventoryLayout,
  InventorySummary,
  InventoryHistory,
  LoyaltySettings,
  MenuId,
  MenuMakerLayout,
  MenuOverview,
  Menus,
  ModifierGroupId,
  ModifierGroups,
  ModifierInventory,
  ModifierAnalytics,
  NotificationPreferences,
  Notifications,
  OrderId,
  Orders,
  PayLaterAging,
  PaymentId,
  Payments,
  Pricing,
  ProductId,
  Products,
  ProductStock,
  RawMaterials,
  Services,
  Recipes,
  ReservationsPage,
  ReservationDetail,
  ReservationCalendar,
  ReservationWaitlist,
  ReservationSettingsPage,
  OnlineBookingPage,
  Reviews,
  RolePermissions,
  SalesByItem,
  SalesSummary,
  ShiftId,
  Shifts,
  SuppliersPage,
  PurchaseOrdersPage,
  PurchaseOrderDetailPage,
  TeamId,
  Teams,
  Tpv,
  TpvId,
  VenueDocuments,
  VenueEditLayout,
  VenueIntegrations,
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
            { path: 'products/create', element: <CreateProduct /> },
            { path: 'services', element: <Services /> },
            { path: 'modifier-groups', element: <ModifierGroups /> },
            { path: 'modifier-groups/:modifierGroupId', element: <ModifierGroupId /> },
            { path: 'modifier-groups/create', element: <CreateModifierGroup /> },
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
    {
      element: <PermissionProtectedRoute permission="payments:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'payments', element: <Payments /> },
            { path: 'payments/:paymentId', element: <PaymentId /> },
          ],
        },
      ],
    },

    // Orders (requires orders:read permission + KYC verification)
    {
      element: <PermissionProtectedRoute permission="orders:read" />,
      children: [
        {
          element: <KYCProtectedRoute />,
          children: [
            { path: 'orders', element: <Orders /> },
            { path: 'orders/:orderId', element: <OrderId /> },
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
        { path: ':reservationId', element: <ReservationDetail /> },
      ],
    },

    // Loyalty Settings (requires loyalty:read permission)
    {
      path: 'loyalty',
      element: <PermissionProtectedRoute permission="loyalty:read" />,
      children: [{ index: true, element: <LoyaltySettings /> }],
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

    // Inventory Management (ADMIN access + inventory:read permission + KYC verification)
    {
      path: 'inventory',
      element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
      children: [
        {
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
                    { path: 'counts', element: <div>Counts</div> }, // Placeholder
                    { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
                    { path: 'purchase-orders/:poId', element: <PurchaseOrderDetailPage /> },
                    { path: 'vendors', element: <div>Vendors</div> }, // Placeholder
                    { path: 'suppliers', element: <SuppliersPage /> },
                    { path: 'restocks', element: <div>Restocks</div> }, // Placeholder
                    { path: 'ingredients', element: <RawMaterials /> }, // Ingredients = Raw Materials
                    { path: 'product-stock', element: <ProductStock /> },
                    { path: 'recipes', element: <Recipes /> },
                    { path: 'pricing', element: <Pricing /> },
                    { path: 'modifiers', element: <ModifierInventory /> },
                    { path: 'modifier-analytics', element: <ModifierAnalytics /> },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}
