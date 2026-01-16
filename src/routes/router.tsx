// src/router.tsx

import { ComingSoon } from '@/components/ComingSoon'
import { StaffRole } from '@/types'
import { createBrowserRouter } from 'react-router-dom'

import {
  AcceptAdminInvitation,
  AdminDashboard,
  AnalyticsLayout,
  AnalyticsOverview,
  CostStructures,
  CreditAssessment,
  Dashboard,
  EcommerceMerchants,
  EmailVerification,
  ErrorPage,
  ForgotPassword,
  GlobalConfig,
  GoogleOAuthCallback,
  InviteAccept,
  KYCReview,
  Login,
  MasterTotpSetup,
  MerchantAccounts,
  ModuleManagement,
  OrganizationManagement,
  OnboardingWizard,
  OrganizationDashboard,
  OrganizationLayout,
  OrganizationSettings,
  OrganizationTeam,
  OrganizationVenues,
  PaymentAnalytics,
  PaymentProviders,
  PlayTelecomCommandCenter,
  // PlayTelecom (Serialized Inventory Dashboard)
  PlayTelecomLayout,
  PlayTelecomManagers,
  PlayTelecomPromoters,
  PlayTelecomSales,
  PlayTelecomStock,
  PlayTelecomStores,
  PlayTelecomTpvConfig,
  PlayTelecomUsers,
  Privacy,
  ProfitAnalyticsDashboard,
  ReceiptViewer,
  ResetPassword,
  RevenueDashboard,
  SerializedSalesDemo,
  SettlementConfigurations,
  Signup,
  SuperadminDashboard,
  SuperadminFeatureManagement,
  SuperadminLayout,
  SuperAdminManagement,
  SuperAdminVenueEdit,
  SuperadminVenueManagement,
  SystemSettings,
  Terminals,
  Terms,
  TestingPayments,
  UserManagement,
  VenueManagement,
  VenueMerchantAccounts,
  VenuePaymentConfig,
  VenuePricing,
  Venues,
  Webhooks,
  // White-Label Organization pages
  WLOrganizationLayout,
  WLVisionGlobal,
  WLTiendasList,
  WLManagersDashboard,
} from './lazyComponents'

import Root from '@/root'
import { EmailVerifiedRoute } from './EmailVerifiedRoute'
import { ProtectedRoute } from './ProtectedRoute'
import { createVenueRoutes } from './venueRoutes'

import { Layout } from '@/Layout'
import { KYCSetupRequired } from '@/pages/KYCSetupRequired'
import { AdminAccessLevel, AdminProtectedRoute } from './AdminProtectedRoute'
import { ManagerProtectedRoute } from './ManagerProtectedRoute'
import { ModuleProtectedRoute } from './ModuleProtectedRoute'
import { OwnerProtectedRoute } from './OwnerProtectedRoute'
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
                    {
                      path: 'organizations',
                      element: <OrganizationManagement />,
                    },
                    {
                      path: 'master-totp',
                      element: <MasterTotpSetup />,
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
                { path: 'kyc-required', element: <KYCSetupRequired /> },

                // ========== SHARED ROUTES (from createVenueRoutes) ==========
                // These routes are shared with /wl/:slug
                ...createVenueRoutes(),

                // ========== VENUE-ONLY ROUTES ==========
                // Public receipts (no permission required)
                { path: 'receipts/:receiptId', element: <ReceiptViewer /> },

                // Demo: Serialized Inventory Sales (hidden route - temporary)
                { path: 'serialized-sales-demo', element: <SerializedSalesDemo /> },

                // PlayTelecom Dashboard (requires SERIALIZED_INVENTORY module)
                // Custom dashboard for venues selling serialized products (SIMs, etc.)
                {
                  path: 'playtelecom',
                  element: <ModuleProtectedRoute requiredModule="SERIALIZED_INVENTORY" />,
                  children: [
                    {
                      element: <PlayTelecomLayout />,
                      children: [
                        { index: true, element: <PlayTelecomCommandCenter /> },
                        { path: 'stock', element: <PlayTelecomStock /> },
                        { path: 'sales', element: <PlayTelecomSales /> },
                        {
                          path: 'stores',
                          element: (
                            <ModuleProtectedRoute
                              requiredModule="SERIALIZED_INVENTORY"
                              allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                            />
                          ),
                          children: [{ index: true, element: <PlayTelecomStores /> }],
                        },
                        {
                          path: 'promoters',
                          element: (
                            <ModuleProtectedRoute
                              requiredModule="SERIALIZED_INVENTORY"
                              allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                            />
                          ),
                          children: [{ index: true, element: <PlayTelecomPromoters /> }],
                        },
                        {
                          path: 'managers',
                          element: (
                            <ModuleProtectedRoute
                              requiredModule="SERIALIZED_INVENTORY"
                              allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                            />
                          ),
                          children: [{ index: true, element: <PlayTelecomManagers /> }],
                        },
                        {
                          path: 'users',
                          element: (
                            <ModuleProtectedRoute
                              requiredModule="SERIALIZED_INVENTORY"
                              allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                            />
                          ),
                          children: [{ index: true, element: <PlayTelecomUsers /> }],
                        },
                        {
                          path: 'tpv-config',
                          element: (
                            <ModuleProtectedRoute
                              requiredModule="SERIALIZED_INVENTORY"
                              allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                            />
                          ),
                          children: [{ index: true, element: <PlayTelecomTpvConfig /> }],
                        },
                      ],
                    },
                  ],
                },

                // White-Label Module-Specific Features (accessed via /venues/:slug)
                {
                  path: 'command-center',
                  element: <ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" />,
                  children: [{ index: true, element: <PlayTelecomCommandCenter /> }],
                },
                {
                  path: 'stock',
                  element: <ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" />,
                  children: [{ index: true, element: <PlayTelecomStock /> }],
                },
                {
                  path: 'promoters',
                  element: (
                    <ModuleProtectedRoute
                      requiredModule="WHITE_LABEL_DASHBOARD"
                      allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                    />
                  ),
                  children: [{ index: true, element: <PlayTelecomPromoters /> }],
                },
                {
                  path: 'stores',
                  element: (
                    <ModuleProtectedRoute
                      requiredModule="WHITE_LABEL_DASHBOARD"
                      allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                    />
                  ),
                  children: [{ index: true, element: <PlayTelecomStores /> }],
                },

                // Superadmin-only routes
                {
                  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.SUPERADMIN} />,
                  children: [
                    { path: 'payment-config', element: <VenuePaymentConfig /> },
                    { path: 'merchant-accounts', element: <VenueMerchantAccounts /> },
                    { path: 'ecommerce-merchants', element: <EcommerceMerchants /> },
                  ],
                },

                // Legacy superadmin route
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

            // ========================================================
            // WHITE-LABEL ORGANIZATION ROUTES (/wl/organizations/:orgSlug)
            // Organization-level dashboard for multi-venue management
            // Uses orgSlug for URL-friendly routing
            // ========================================================
            {
              path: '/wl/organizations/:orgSlug',
              element: <OwnerProtectedRoute />,
              errorElement: <ErrorPage />,
              children: [
                {
                  element: <WLOrganizationLayout />,
                  children: [
                    { index: true, element: <WLVisionGlobal /> },
                    { path: 'venues', element: <WLTiendasList /> },
                    { path: 'managers', element: <WLManagersDashboard /> },
                    { path: 'reports', element: <ComingSoon feature="Cross-Store Reports" /> },
                  ],
                },
              ],
            },

            // ========================================================
            // WHITE-LABEL VENUE ROUTES (/wl/venues/:slug)
            // Venue-level dashboard with white-label mode active
            // Uses venue slug for URL routing
            // ========================================================
            {
              path: '/wl/venues/:slug',
              element: <ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" />,
              errorElement: <ErrorPage />,
              children: [
                {
                  element: <Dashboard />,
                  children: [
                    // ========== SHARED ROUTES (from createVenueRoutes) ==========
                    ...createVenueRoutes(),

                    // ========== WHITE-LABEL SPECIFIC ROUTES ==========
                    // Parent already requires WHITE_LABEL_DASHBOARD module
                    { path: 'command-center', element: <PlayTelecomCommandCenter /> },
                    { path: 'stock', element: <PlayTelecomStock /> },
                    { path: 'sales', element: <PlayTelecomSales /> },
                    {
                      path: 'promoters',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomPromoters /> }],
                    },
                    {
                      path: 'stores',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomStores /> }],
                    },
                    {
                      path: 'managers',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomManagers /> }],
                    },
                    {
                      path: 'users',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomUsers /> }],
                    },
                    {
                      path: 'tpv-config',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomTpvConfig /> }],
                    },
                  ],
                },
              ],
            },

            // ========================================================
            // LEGACY WHITE-LABEL ROUTES (/wl/:slug)
            // DEPRECATED: Use /wl/venues/:slug instead
            // Kept for backwards compatibility
            // ========================================================
            {
              path: '/wl/:slug',
              element: <ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" />,
              errorElement: <ErrorPage />,
              children: [
                {
                  element: <Dashboard />,
                  children: [
                    // ========== SHARED ROUTES (from createVenueRoutes) ==========
                    ...createVenueRoutes(),

                    // ========== WHITE-LABEL SPECIFIC ROUTES ==========
                    // Parent already requires WHITE_LABEL_DASHBOARD module
                    { path: 'command-center', element: <PlayTelecomCommandCenter /> },
                    { path: 'stock', element: <PlayTelecomStock /> },
                    { path: 'sales', element: <PlayTelecomSales /> },
                    {
                      path: 'promoters',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomPromoters /> }],
                    },
                    {
                      path: 'stores',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomStores /> }],
                    },
                    {
                      path: 'managers',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomManagers /> }],
                    },
                    {
                      path: 'users',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomUsers /> }],
                    },
                    {
                      path: 'tpv-config',
                      element: (
                        <ModuleProtectedRoute
                          requiredModule="WHITE_LABEL_DASHBOARD"
                          allowedRoles={[StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]}
                        />
                      ),
                      children: [{ index: true, element: <PlayTelecomTpvConfig /> }],
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
