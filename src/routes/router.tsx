// src/router.tsx
import { createBrowserRouter } from 'react-router-dom'

import {
  Login,
  Home,
  Categories,
  CategoryId,
  CreateCategory,
  MenuMakerLayout,
  CreateMenu,
  Menus,
  Modifiers,
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
  Dashboard,
  ErrorPage,
  ShiftId,
} from '@/pages/index'
import { ProtectedRoute } from './ProtectedRoute'
import Root from '@/root'
import { Layout } from '@/Layout'
import { SuperProtectedRoute } from './SuperProtectedRoute'

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
        element: <ProtectedRoute />, // Protected routes
        children: [
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
                ],
              },
              { path: 'shifts', element: <Shifts /> },
              { path: 'shifts/:shiftId', element: <ShiftId /> },
              { path: 'payments', element: <Payments /> },
              { path: 'payments/:paymentId', element: <PaymentId /> },
              { path: 'editVenue', element: <EditVenue /> },
              { path: 'tpv', element: <Tpv /> },
              { path: 'tpv/create', element: <CreateTpv /> },
              { path: 'tpv/:tpvId', element: <TpvId /> },
              { path: 'waiters', element: <Waiters /> },
              { path: 'waiters/:waiterId', element: <WaiterId /> },
              { path: 'reviews', element: <Reviews /> },

              {
                path: 'superadmin',
                element: <SuperProtectedRoute allowedRoles={['SUPERADMIN']} />,
                children: [
                  {
                    index: true,
                    element: <div>Super Admin Dashboard</div>,
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
