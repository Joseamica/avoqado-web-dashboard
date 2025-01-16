// src/Layout.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Toaster } from './components/ui/toaster'

const Root: React.FC = () => {
  return (
    <AuthProvider>
      <Toaster />
      <Outlet /> {/* Renders the matched child route */}
    </AuthProvider>
  )
}

export default Root
