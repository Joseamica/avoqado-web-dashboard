// src/Layout.tsx
import React, { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from './components/ui/toaster'
import { LoadingScreen } from './components/spinner'

const Root: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster />
        <Suspense fallback={<LoadingScreen message="Partiendo la cuenta y el aguacate…" />}>
          <Outlet />
        </Suspense>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default Root
