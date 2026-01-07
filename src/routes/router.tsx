// src/router.tsx

import { ComingSoon } from '@/components/ComingSoon'
import { StaffRole } from '@/types'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import {
  AcceptAdminInvitation,
  Account,
  AdminDashboard,
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
  ContactImages,
  CostStructures,
  CreateCategory,
  CreateMenu,
  CreateModifierGroup,
  CreateProduct,
  CouponForm,
  Coupons,
  CustomerDetail,
  CustomerGroups,
  Customers,
  Dashboard,
  DiscountDetail,
  DiscountForm,
  Discounts,
  EmailVerification,
  ErrorPage,
  ForgotPassword,
  GlobalConfig,
  GoogleIntegration,
  GoogleOAuthCallback,
  Home,
  InventoryLayout,
  InviteAccept,
  KYCReview,
  Login,
  LoyaltySettings,
  MenuId,
  MenuMakerLayout,
  MenuOverview,
  Menus,
  MerchantAccounts,
  ModifierGroupId,
  ModifierGroups,
  ModifierInventory,
  NotificationPreferences,
  Notifications,
  OnboardingWizard,
  OrderId,
  Orders,
  OrganizationDashboard,
  OrganizationLayout,
  OrganizationSettings,
  OrganizationTeam,
  OrganizationVenues,
  PaymentAnalytics,
  PaymentId,
  PaymentProviders,
  Payments,
  Pricing,
  Privacy,
  ProductId,
  Products,
  ProductStock,
  ProfitAnalyticsDashboard,
  RawMaterials,
  ReceiptViewer,
  Recipes,
  ResetPassword,
  RevenueDashboard,
  Reviews,
  RolePermissions,
  SettlementConfigurations,
  // WaiterId,
  ShiftId,
  Shifts,
  Signup,
  SuperadminDashboard,
  SuperadminFeatureManagement,
  SuperadminLayout,
  SuperAdminManagement,
  SuperAdminVenueEdit,
  SuperadminVenueManagement,
  SystemSettings,
  TeamMemberDetails,
  Teams,
  Terms,
  TestingPayments,
  Tpv,
  TpvId,
  UserManagement,
  VenueDocuments,
  VenueEditLayout,
  VenueIntegrations,
  VenueManagement,
  VenuePaymentConfig,
  VenueMerchantAccounts,
  EcommerceMerchants,
  VenuePricing,
  Venues,
  Webhooks,
  Terminals,
  CreditAssessment,
  ModuleManagement,
  PayLaterAging,
  SalesSummary,
} from './lazyComponents'

import Root from '@/root'
import { EmailVerifiedRoute } from './EmailVerifiedRoute'
import { ProtectedRoute } from './ProtectedRoute'

import { Layout } from '@/Layout'
import { KYCSetupRequired } from '@/pages/KYCSetupRequired'
import { AdminAccessLevel, AdminProtectedRoute } from './AdminProtectedRoute'
import { FeatureProtectedRoute } from './FeatureProtectedRoute'
import { KYCProtectedRoute } from './KYCProtectedRoute'
import { ManagerProtectedRoute } from './ManagerProtectedRoute'
import { OwnerProtectedRoute } from './OwnerProtectedRoute'
import { PermissionProtectedRoute } from './PermissionProtectedRoute'
import { SuperProtectedRoute } from './SuperProtectedRoute'

const router = createBrowserRouter(
  [
    {
      element: <Root />, // Root element wraps all routes
      children: [
        {
          path: '/login',
          element: <Login />,
        },
        {
          path: '/signup',
          element: <Signup />,
        },
        {
          path: '/auth/forgot-password',
          element: <ForgotPassword />,
        },
        {
          path: '/auth/reset-password/:token',
          element: <ResetPassword />,
        },
        {
          path: '/auth/verify-email',
          element: <EmailVerification />,
        },
        {
          element: <EmailVerifiedRoute />,
          children: [
            {
              path: '/onboarding',
              element: <OnboardingWizard />,
            },
          ],
        },
        {
          path: '/terms',
          element: <Terms />,
        },
        {
          path: '/privacy',
          element: <Privacy />,
        },
        {
          path: '/auth/google/callback',
          element: <GoogleOAuthCallback />,
        },
        {
          path: '/admin/accept-invitation',
          element: <AcceptAdminInvitation />,
        },
        {
          path: '/invite/:token',
          element: <InviteAccept />,
        },
        {
          element: <ProtectedRoute />, // Protected routes
          children: [
            // Executive Analytics (org/venue scoped via backend auth)
            // Requires MANAGER+ or VIEWER role
            {
              path: '/analytics',
              element: <ManagerProtectedRoute allowViewer={true} />,
              children: [
                {
                  element: <AnalyticsLayout />,
                  children: [{ index: true, element: <AnalyticsOverview /> }],
                },
              ],
            },
            // Add venues route before venues/:slug
            {
              path: '/venues',
              element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
              children: [
                {
                  index: true,
                  element: <Venues />,
                },
              ],
            },

            // Nueva sección de administración
            {
              path: '/admin',
              element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />, // Protegido para ADMIN y SUPERADMIN
              children: [
                {
                  index: true,
                  element: <AdminDashboard />,
                },
                {
                  path: 'general',
                  element: <AdminDashboard />,
                },
                {
                  path: 'users',
                  element: <UserManagement />,
                },
                {
                  path: 'venues',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [
                    {
                      index: true,
                      element: <VenueManagement />,
                    },
                    {
                      path: ':slug',
                      element: <SuperAdminVenueEdit />,
                    },
                  ],
                },
                {
                  path: 'settings',
                  element: <ComingSoon feature="Admin Account Settings" />,
                },
                // Rutas solo para superadmin
                {
                  path: 'system',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [
                    {
                      index: true,
                      element: <SystemSettings />,
                    },
                  ],
                },
                {
                  path: 'global',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [
                    {
                      index: true,
                      element: <GlobalConfig />,
                    },
                  ],
                },
                {
                  path: 'superadmins',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [
                    {
                      index: true,
                      element: <SuperAdminManagement />,
                    },
                  ],
                },
              ],
            },

            // New Superadmin System Routes
            {
              path: '/superadmin',
              element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
              children: [
                {
                  element: <SuperadminLayout />,
                  children: [
                    {
                      index: true,
                      element: <SuperadminDashboard />,
                    },
                    {
                      path: 'venues',
                      element: <SuperadminVenueManagement />,
                    },
                    {
                      path: 'kyc/:venueId',
                      element: <KYCReview />,
                    },
                    {
                      path: 'features',
                      element: <SuperadminFeatureManagement />,
                    },
                    {
                      path: 'analytics',
                      element: <ComingSoon feature="Analytics Dashboard" />,
                    },
                    {
                      path: 'alerts',
                      element: <ComingSoon feature="Alerts Dashboard" />,
                    },
                    {
                      path: 'revenue',
                      element: <RevenueDashboard />,
                    },
                    {
                      path: 'profit-analytics',
                      element: <ProfitAnalyticsDashboard />,
                    },
                    {
                      path: 'customers',
                      element: <ComingSoon feature="Customer Management" />,
                    },
                    {
                      path: 'growth',
                      element: <ComingSoon feature="Growth Analytics" />,
                    },
                    {
                      path: 'system',
                      element: <ComingSoon feature="System Health" />,
                    },
                    {
                      path: 'reports',
                      element: <ComingSoon feature="Reports" />,
                    },
                    {
                      path: 'support',
                      element: <ComingSoon feature="Support Dashboard" />,
                    },
                    {
                      path: 'settings',
                      element: <ComingSoon feature="Superadmin Settings" />,
                    },
                    {
                      path: 'payment-providers',
                      element: <PaymentProviders />,
                    },
                    {
                      path: 'merchant-accounts',
                      element: <MerchantAccounts />,
                    },
                    {
                      path: 'terminals',
                      element: <Terminals />,
                    },
                    {
                      path: 'payment-analytics',
                      element: <PaymentAnalytics />,
                    },
                    {
                      path: 'cost-structures',
                      element: <CostStructures />,
                    },
                    {
                      path: 'settlement-terms',
                      element: <SettlementConfigurations />,
                    },
                    {
                      path: 'venue-pricing',
                      element: <VenuePricing />,
                    },
                    {
                      path: 'testing',
                      element: <TestingPayments />,
                    },
                    {
                      path: 'webhooks',
                      element: <Webhooks />,
                    },
                    {
                      path: 'credit-assessment',
                      element: <CreditAssessment />,
                    },
                    {
                      path: 'modules',
                      element: <ModuleManagement />,
                    },
                  ],
                },
              ],
            },

            // Organization routes (OWNER dashboard for multi-venue management)
            {
              path: '/organizations/:orgId',
              element: <OwnerProtectedRoute />,
              children: [
                {
                  element: <OrganizationLayout />,
                  children: [
                    { index: true, element: <OrganizationDashboard /> },
                    { path: 'dashboard', element: <OrganizationDashboard /> },
                    { path: 'venues', element: <OrganizationVenues /> },
                    { path: 'team', element: <OrganizationTeam /> },
                    { path: 'settings', element: <OrganizationSettings /> },
                    { path: 'analytics', element: <ComingSoon feature="Organization Analytics" /> },
                  ],
                },
              ],
            },

            {
              path: '/venues/:slug',
              element: <Dashboard />,
              errorElement: <ErrorPage />,
              children: [
                // KYC Setup Required Page (shown when KYC verification is needed)
                {
                  path: 'kyc-required',
                  element: <KYCSetupRequired />,
                },

                // Home Dashboard (requires home:read permission)
                {
                  element: <PermissionProtectedRoute permission="home:read" />,
                  children: [
                    { index: true, element: <Home /> },
                    { path: 'home', element: <Home /> },
                  ],
                },
                { path: 'account', element: <Account /> },

                // Menu Management (requires menu:read permission)
                {
                  path: 'menumaker',
                  element: <PermissionProtectedRoute permission="menu:read" />,
                  children: [
                    {
                      element: <MenuMakerLayout />,
                      children: [
                        {
                          index: true,
                          element: <MenuOverview />,
                        },
                        {
                          path: 'overview',
                          element: <MenuOverview />,
                        },
                        {
                          path: 'menus',
                          element: <Menus />,
                        },
                        {
                          path: 'menus/:menuId',
                          element: <MenuId />,
                        },
                        {
                          path: 'menus/create',
                          element: <CreateMenu />,
                        },
                        {
                          path: 'categories',
                          element: <Categories />,
                        },
                        {
                          path: 'categories/:categoryId',
                          element: <CategoryId />,
                        },
                        {
                          path: 'categories/create',
                          element: <CreateCategory />,
                        },
                        { path: 'products', element: <Products /> },
                        {
                          path: 'products/:productId',
                          element: <ProductId />,
                        },
                        {
                          path: 'products/create',
                          element: <CreateProduct />,
                        },
                        { path: 'modifier-groups', element: <ModifierGroups /> },
                        {
                          path: 'modifier-groups/:modifierGroupId',
                          element: <ModifierGroupId />,
                        },
                        {
                          path: 'modifier-groups/create',
                          element: <CreateModifierGroup />,
                        },
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

                // Public receipts (no permission required)
                { path: 'receipts/:receiptId', element: <ReceiptViewer /> },

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
                // Analytics nested under venue for dashboard context
                // Requires MANAGER+ or VIEWER role + KYC verification
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
                // Reports (requires specific report permissions + KYC verification)
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
                // Sales Summary Report (requires KYC verification)
                {
                  path: 'reports/sales-summary',
                  element: <KYCProtectedRoute />,
                  children: [{ index: true, element: <SalesSummary /> }],
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
                {
                  path: 'edit',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
                  children: [
                    {
                      element: <VenueEditLayout />,
                      children: [
                        { index: true, element: <Navigate to="basic-info" replace /> }, // Redirect to basic-info by default
                        { path: 'basic-info', element: <BasicInfo /> }, // New: Information básica
                        { path: 'contact-images', element: <ContactImages /> }, // New: Contacto e imágenes
                        { path: 'general', element: <Navigate to="../basic-info" replace /> }, // Legacy redirect
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
                {
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [
                    { path: 'payment-config', element: <VenuePaymentConfig /> },
                    { path: 'merchant-accounts', element: <VenueMerchantAccounts /> },
                    { path: 'ecommerce-merchants', element: <EcommerceMerchants /> },
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

                // { path: 'waiters', element: <Waiters /> },
                // { path: 'waiters/:waiterId', element: <WaiterId /> },

                // Team Management (requires teams:read permission)
                {
                  path: 'teams',
                  element: <PermissionProtectedRoute permission="teams:read" />,
                  children: [
                    { index: true, element: <Teams /> },
                    { path: ':memberId', element: <TeamMemberDetails /> },
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

                { path: 'notifications', element: <Notifications /> },
                { path: 'notifications/preferences', element: <NotificationPreferences /> },

                // Role Permissions Management (OWNER and ADMIN only)
                {
                  path: 'settings/role-permissions',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
                  children: [
                    {
                      index: true,
                      element: <RolePermissions />,
                    },
                  ],
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
                                { path: 'raw-materials', element: <RawMaterials /> },
                                { path: 'product-stock', element: <ProductStock /> },
                                { path: 'recipes', element: <Recipes /> },
                                { path: 'pricing', element: <Pricing /> },
                                { path: 'modifiers', element: <ModifierInventory /> },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },

                // Esta sección pasa a ser parte del nuevo panel de administración
                {
                  path: 'superadmin',
                  element: <SuperProtectedRoute allowedRoles={[StaffRole.OWNER]} />,
                  children: [
                    {
                      index: true,
                      element: <ComingSoon feature="Super Admin Dashboard (Deprecated - use /admin)" />,
                    },
                  ],
                },
              ],
            },
          ],
        },
        // Root route for home page redirects
        {
          path: '/',
          element: <Layout />,
        },
        // Ruta pública para acceder a los recibos digitales
        {
          path: '/receipts/public/:accessKey',
          element: <ReceiptViewer />,
          errorElement: <ErrorPage />,
        },
        {
          path: '*',
          element: <ErrorPage />,
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    } as any,
  },
)

export default router
