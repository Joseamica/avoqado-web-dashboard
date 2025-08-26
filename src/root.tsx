// src/Layout.tsx
import React, { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SocketProvider } from './context/SocketContext'
import { NotificationProvider } from './context/NotificationContext'
import { Toaster } from './components/ui/toaster'
import { LoadingScreen } from './components/spinner'

const Root: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <Toaster />
            <Suspense fallback={<LoadingScreen message="Partiendo la cuenta y el aguacate…" />}>
              <Outlet />
            </Suspense>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default Root
