// src/router.tsx
import { createBrowserRouter } from 'react-router-dom'

import Dashboard from '@/dashboard'
import ErrorPage from '@/error-page'
import Layout from '@/Layout'
import Login from '@/pages/Auth/Login'
import Home from '@/pages/Home'
import Categories from '@/pages/Menu/Categories'
import CategoryId from '@/pages/Menu/categoryId'
import MenuMakerLayout from '@/pages/Menu/MenuMakerLayout'
import Modifiers from '@/pages/Menu/Modifiers'
import Overview from '@/pages/Menu/Overview'
import Products from '@/pages/Menu/Products'
import { Test } from '@/pages/Test/Test'
import { ProtectedRoute } from './ProtectedRoute'
import Menus from '@/pages/Menu/Menus'

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
                    path: 'categories',
                    element: <Categories />,
                  },
                  {
                    path: 'categories/:categoryId',
                    element: <CategoryId />,
                  },
                  { path: 'products', element: <Products /> },
                  { path: 'modifiers', element: <Modifiers /> },
                ],
              },
              // { path: 'menus/categories', element: <Categories /> },
              // { path: 'products', element: <Products /> },
              // { path: 'modifiers', element: <Modifiers /> },
            ],
          },
        ],
      },
    ],
  },
])

export default router
