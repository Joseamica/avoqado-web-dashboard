// src/Layout.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from './components/ui/toaster'

const Root: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster />
        <Outlet /> {/* Renders the matched child route */}
      </AuthProvider>
    </ThemeProvider>
  )
}

export default Root
