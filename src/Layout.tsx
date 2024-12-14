// src/Layout.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Toaster } from './components/ui/toaster'

const Layout: React.FC = () => {
  return (
    <AuthProvider>
      <Toaster />
      <Outlet /> {/* Renders the matched child route */}
    </AuthProvider>
  )
}

export default Layout
