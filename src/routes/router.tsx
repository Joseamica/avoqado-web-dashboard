// src/router.tsx
import { createBrowserRouter } from 'react-router-dom'

import Dashboard from '@/dashboard'
import ErrorPage from '@/error-page'

import Login from '@/pages/Auth/Login'
import Home from '@/pages/Home'
import Categories from '@/pages/Menu/Categories/Categories'
import CategoryId from '@/pages/Menu/Categories/categoryId'
import CreateCategory from '@/pages/Menu/Categories/createCategory'
import MenuMakerLayout from '@/pages/Menu/MenuMakerLayout'
import CreateMenu from '@/pages/Menu/Menus/createMenu'
import Menus from '@/pages/Menu/Menus/Menus'
import Modifiers from '@/pages/Menu/Modifiers'
import Overview from '@/pages/Menu/Overview'
import CreateProduct from '@/pages/Menu/Products/createProduct'
import ProductId from '@/pages/Menu/Products/productId'
import Products from '@/pages/Menu/Products/Products'
import CreateTpv from '@/pages/Tpv/createTpv'
import Tpv from '@/pages/Tpv/Tpvs'
import { ProtectedRoute } from './ProtectedRoute'
import Root from '@/root'
import { Layout } from '@/Layout'
import Account from '@/pages/Account/Account'
import Payments from '@/pages/Payment/Payments'
import MenuId from '@/pages/Menu/Menus/menuId'
import Reviews from '@/pages/Review/Reviews'
import { SuperProtectedRoute } from './SuperProtectedRoute'
import Waiters from '@/pages/Waiter/Waiters'
import EditVenue from '@/pages/Venue/Venue.edit'
import Shifts from '@/pages/Shift/Shifts'
import WaiterId from '@/pages/Waiter/waiterId'
import ShiftId from '@/pages/Shift/ShiftId'

const router = createBrowserRouter([
  {
    element: <Root />, // Root element wraps all routes
    children: [
      {
        path: '/',
        element: <Layout />,
      },

      {
        path: '/login',
        element: <Login />,
      },
      {
        element: <ProtectedRoute />, // Protected routes
        children: [
          // {
          //   path: '/dashboard',
          //   element: <div></div>,
          //   errorElement: <ErrorPage />,
          //   children: [{}, { path: 'create-new-venue', element: <CreateVenue /> }],
          // },
          {
            path: '/venues/:venueId',
            element: <Dashboard />,
            errorElement: <ErrorPage />,
            children: [
              { path: 'home', element: <Home /> },
              { path: 'account', element: <Account /> },

              {
                path: 'menumaker',
                element: <MenuMakerLayout />,
                children: [
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
              { path: 'editVenue', element: <EditVenue /> },
              { path: 'tpv', element: <Tpv /> },
              { path: 'waiters', element: <Waiters /> },
              { path: 'waiters/:waiterId', element: <WaiterId /> },
              { path: 'reviews', element: <Reviews /> },

              {
                path: 'tpv/create',
                element: <CreateTpv />,
              },
              {
                path: 'superadmin',
                element: <SuperProtectedRoute allowedRoles={['SUPERADMIN']} />,
                children: [{ path: '', element: <div>a</div> }],
              },
            ],
          },
        ],
      },
    ],
  },
])

export default router
