// src/Layout.tsx
import React, { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SocketProvider } from './context/SocketContext'
import { NotificationProvider } from './context/NotificationContext'
import { DocumentTitleProvider } from './context/DocumentTitleContext'
import { Toaster } from './components/ui/toaster'
import { OfflineBanner } from './components/OfflineBanner'
import { LoadingScreen } from './components/spinner'
import { useTranslation } from 'react-i18next'

const Root: React.FC = () => {
  const { t } = useTranslation()
  return (
    <ThemeProvider>
      <OfflineBanner />
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <Toaster />
            <Suspense fallback={<LoadingScreen message={t('loading')} />}>
              <DocumentTitleProvider>
                <Outlet />
                <ScrollRestoration />
              </DocumentTitleProvider>
            </Suspense>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default Root
