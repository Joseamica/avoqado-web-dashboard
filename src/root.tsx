// src/Layout.tsx
import React, { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SocketProvider } from './context/SocketContext'
import { NotificationProvider } from './context/NotificationContext'
import { Toaster } from './components/ui/toaster'
import { LoadingScreen } from './components/spinner'
import { useTranslation } from 'react-i18next'

const Root: React.FC = () => {
  const { t } = useTranslation()
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <Toaster />
            <Suspense fallback={<LoadingScreen message={t('common.loading')} />}>
              <Outlet />
              <ScrollRestoration />
            </Suspense>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default Root
