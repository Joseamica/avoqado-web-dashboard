// src/router.tsx
import { createBrowserRouter } from 'react-router-dom'

import Dashboard from '@/dashboard'
import ErrorPage from '@/error-page'
import Layout from '@/Layout'
import Login from '@/pages/Auth/Login'
import Home from '@/pages/Home'
import Categories from '@/pages/Menu/Categories/Categories'
import CategoryId from '@/pages/Menu/Categories/categoryId'
import MenuMakerLayout from '@/pages/Menu/MenuMakerLayout'
import Modifiers from '@/pages/Menu/Modifiers'
import Overview from '@/pages/Menu/Overview'
import Products from '@/pages/Menu/Products/Products'
import { Test } from '@/pages/Test/Test'
import { ProtectedRoute } from './ProtectedRoute'
import Menus from '@/pages/Menu/Menus/Menus'
import ProductId from '@/pages/Menu/Products/productId'
import CreateProduct from '@/pages/Menu/Products/createProduct'
import CreateMenu from '@/pages/Menu/Menus/createMenu'
import CreateCategory from '@/pages/Menu/Categories/createCategory'
import Tpv from '@/pages/Tpv/Tpv'
import CreateTpv from '@/pages/Tpv/createTpv'

const router = createBrowserRouter([
  {
    element: <Layout />, // Root element wraps all routes
    children: [
      {
        path: '/',
        element: <Test />,
      },
      {
        path: '/testing',
        element: <Test />,
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
              // { path: 'menus/categories', element: <Categories /> },
              // { path: 'products', element: <Products /> },
              { path: 'tpv', element: <Tpv /> },
              {
                path: 'tpv/create',
                element: <CreateTpv />,
              },

              // { path: 'modifiers', element: <Modifiers /> },
            ],
          },
        ],
      },
    ],
  },
])

export default router
