// src/router.tsx

import { createBrowserRouter } from 'react-router-dom'

import {
  Dashboard,
  ErrorPage,
  Login,
  Home,
  Categories,
  CategoryId,
  CreateCategory,
  MenuMakerLayout,
  CreateMenu,
  Menus,
  Modifiers,
  CreateModifierGroup,
  Overview,
  CreateProduct,
  ProductId,
  Products,
  CreateTpv,
  Tpv,
  TpvId,
  Account,
  Payments,
  PaymentId,
  MenuId,
  Reviews,
  Waiters,
  EditVenue,
  Shifts,
  WaiterId,
  ShiftId,
  Bills,
  BillId,
  Teams,
  AdminDashboard,
  UserManagement,
  SystemSettings,
  VenueManagement,
  GlobalConfig,
  SuperAdminManagement,
  SuperAdminVenueEdit,
  Venues,
  AcceptAdminInvitation,
  ModifierGroupId,
} from './lazyComponents'

import { ProtectedRoute } from './ProtectedRoute'
import Root from '@/root'
import { Layout } from '@/Layout'
import { SuperProtectedRoute } from './SuperProtectedRoute'
import { AdminProtectedRoute, AdminAccessLevel } from './AdminProtectedRoute'

const router = createBrowserRouter([
  {
    element: <Root />, // Root element wraps all routes
    children: [
      {
        path: '/',
        element: <Layout />,
        index: true,
      },

      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/admin/accept-invitation',
        element: <AcceptAdminInvitation />,
      },
      {
        element: <ProtectedRoute />, // Protected routes
        children: [
          // Add venues route before venues/:venueId
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
                    path: ':venueId',
                    element: <SuperAdminVenueEdit />,
                  },
                ],
              },
              {
                path: 'settings',
                element: <div>Configuración de cuenta de admin (en desarrollo)</div>,
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

          {
            path: '/venues/:venueId',
            element: <Dashboard />,
            errorElement: <ErrorPage />,
            children: [
              { index: true, element: <Home /> },
              { path: 'home', element: <Home /> },
              { path: 'account', element: <Account /> },

              {
                path: 'menumaker',
                element: <MenuMakerLayout />,
                children: [
                  {
                    index: true,
                    element: <Overview />,
                  },
                  {
                    path: 'overview',
                    element: <Overview />,
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
                  { path: 'modifiers', element: <Modifiers /> },
                  {
                    path: 'modifiers/:modifierGroupId',
                    element: <ModifierGroupId />,
                  },
                  {
                    path: 'modifiers/create',
                    element: <CreateModifierGroup />,
                  },
                ],
              },
              { path: 'shifts', element: <Shifts /> },
              { path: 'shifts/:shiftId', element: <ShiftId /> },
              { path: 'payments', element: <Payments /> },
              { path: 'payments/:paymentId', element: <PaymentId /> },
              { path: 'bills', element: <Bills /> },
              { path: 'bills/:billId', element: <BillId /> },
              { path: 'editVenue', element: <EditVenue /> },
              { path: 'tpv', element: <Tpv /> },
              { path: 'tpv/create', element: <CreateTpv /> },
              { path: 'tpv/:tpvId', element: <TpvId /> },
              { path: 'waiters', element: <Waiters /> },
              { path: 'waiters/:waiterId', element: <WaiterId /> },
              { path: 'reviews', element: <Reviews /> },
              { path: 'teams', element: <Teams /> },

              // Esta sección pasa a ser parte del nuevo panel de administración
              {
                path: 'superadmin',
                element: <SuperProtectedRoute allowedRoles={['SUPERADMIN']} />,
                children: [
                  {
                    index: true,
                    element: <div>Super Admin Dashboard (Obsoleto, usar /admin)</div>,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <ErrorPage />,
      },
    ],
  },
])

export default router
