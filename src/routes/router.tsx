// src/router.tsx

import { createBrowserRouter } from 'react-router-dom'
import { StaffRole } from '@/types'
import { ComingSoon } from '@/components/ComingSoon'

import {
  Dashboard,
  ErrorPage,
  Login,
  GoogleOAuthCallback,
  Home,
  Categories,
  CategoryId,
  CreateCategory,
  MenuMakerLayout,
  CreateMenu,
  Menus,
  ModifierGroups,
  CreateModifierGroup,
  MenuOverview,
  CreateProduct,
  ProductId,
  Products,
  CreateTpv,
  Tpv,
  TpvId,
  Account,
  VenuePaymentConfig,
  Payments,
  PaymentId,
  ReceiptViewer,
  MenuId,
  Reviews,
  // Waiters,
  EditVenue,
  Shifts,
  // WaiterId,
  ShiftId,
  Orders,
  OrderId,
  Teams,
  TeamMemberDetails,
  AdminDashboard,
  UserManagement,
  SystemSettings,
  VenueManagement,
  GlobalConfig,
  SuperAdminManagement,
  SuperAdminVenueEdit,
  Venues,
  Notifications,
  NotificationPreferences,
  AcceptAdminInvitation,
  InviteAccept,
  ModifierGroupId,
  SuperadminLayout,
  SuperadminDashboard,
  SuperadminFeatureManagement,
  SuperadminVenueManagement,
  RevenueDashboard,
  ProfitAnalyticsDashboard,
  TestingPayments,
  PaymentProviders,
  MerchantAccounts,
  PaymentAnalytics,
  CostStructures,
  VenuePricing,
  Terms,
  Privacy,
  AnalyticsLayout,
  AnalyticsOverview,
  InventoryLayout,
  RawMaterials,
  Recipes,
  Pricing,
  RolePermissions,
} from './lazyComponents'

import { ProtectedRoute } from './ProtectedRoute'
import Root from '@/root'

import { SuperProtectedRoute } from './SuperProtectedRoute'
import { AdminProtectedRoute, AdminAccessLevel } from './AdminProtectedRoute'
import { ManagerProtectedRoute } from './ManagerProtectedRoute'
import { PermissionProtectedRoute } from './PermissionProtectedRoute'
import { Layout } from '@/Layout'

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
                  children: [
                    { index: true, element: <AnalyticsOverview /> },
                  ],
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
                      path: 'payment-analytics',
                      element: <PaymentAnalytics />,
                    },
                    {
                      path: 'cost-structures',
                      element: <CostStructures />,
                    },
                    {
                      path: 'venue-pricing',
                      element: <VenuePricing />,
                    },
                    {
                      path: 'testing',
                      element: <TestingPayments />,
                    },
                  ],
                },
              ],
            },

            {
              path: '/venues/:slug',
              element: <Dashboard />,
              errorElement: <ErrorPage />,
              children: [
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

                // Shifts Management (requires shifts:read permission)
                {
                  element: <PermissionProtectedRoute permission="shifts:read" />,
                  children: [
                    { path: 'shifts', element: <Shifts /> },
                    { path: 'shifts/:shiftId', element: <ShiftId /> },
                  ],
                },

                // Payments (requires payments:read permission)
                {
                  element: <PermissionProtectedRoute permission="payments:read" />,
                  children: [
                    { path: 'payments', element: <Payments /> },
                    { path: 'payments/:paymentId', element: <PaymentId /> },
                  ],
                },

                // Public receipts (no permission required)
                { path: 'receipts/:receiptId', element: <ReceiptViewer /> },

                // Orders (requires orders:read permission)
                {
                  element: <PermissionProtectedRoute permission="orders:read" />,
                  children: [
                    { path: 'orders', element: <Orders /> },
                    { path: 'orders/:orderId', element: <OrderId /> },
                  ],
                },
                // Analytics nested under venue for dashboard context
                // Requires MANAGER+ or VIEWER role
                {
                  path: 'analytics',
                  element: <ManagerProtectedRoute allowViewer={true} />,
                  children: [
                    {
                      element: <AnalyticsLayout />,
                      children: [
                        { index: true, element: <AnalyticsOverview /> },
                      ],
                    },
                  ],
                },

                // Edit Venue (requires ADMIN role + venues:read permission)
                {
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
                  children: [
                    {
                      element: <PermissionProtectedRoute permission="venues:read" />,
                      children: [{ path: 'editVenue', element: <EditVenue /> }],
                    },
                  ],
                },

                {
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [{ path: 'payment-config', element: <VenuePaymentConfig /> }],
                },

                // TPV Management (requires tpv:read permission)
                {
                  element: <PermissionProtectedRoute permission="tpv:read" />,
                  children: [
                    { path: 'tpv', element: <Tpv /> },
                    { path: 'tpv/create', element: <CreateTpv /> },
                    { path: 'tpv/:tpvId', element: <TpvId /> },
                  ],
                },

                // Reviews (requires reviews:read permission)
                {
                  element: <PermissionProtectedRoute permission="reviews:read" />,
                  children: [
                    { path: 'reviews', element: <Reviews /> },
                  ],
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

                // Inventory Management (ADMIN access + inventory:read permission)
                {
                  path: 'inventory',
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />,
                  children: [
                    {
                      element: <PermissionProtectedRoute permission="inventory:read" />,
                      children: [
                        {
                          element: <InventoryLayout />,
                          children: [
                            { path: 'raw-materials', element: <RawMaterials /> },
                            { path: 'recipes', element: <Recipes /> },
                            { path: 'pricing', element: <Pricing /> },
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
