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
import Tpv from '@/pages/Tpv/Tpv'
import { ProtectedRoute } from './ProtectedRoute'
import Root from '@/root'
import { Layout } from '@/Layout'

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
              { path: 'account', element: <div>hola</div> },

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

              { path: 'tpv', element: <Tpv /> },
              {
                path: 'tpv/create',
                element: <CreateTpv />,
              },
            ],
          },
        ],
      },
    ],
  },
])

export default router
