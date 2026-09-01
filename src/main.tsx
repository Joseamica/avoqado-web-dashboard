// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { LoadingScreen } from './components/spinner'
import './i18n'
import './index.css'
import './theme.css'
import { captureDemoTourParams } from './lib/demo-tour-capture'
import { initPostHog } from './lib/posthog'

// Avoqado Tour handoff (?demoTour=...): stash + strip BEFORE the router mounts —
// the auth/venue redirects would drop the query string before any hook sees it.
captureDemoTourParams()

// PostHog product analytics — no-op unless VITE_POSTHOG_KEY is set
initPostHog()

// Handle Vite preload errors (CSS/JS chunks missing after deploy)
// Vite emits this event when a dynamic import's preloaded dependency fails to load
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reload-attempted')) {
    sessionStorage.setItem('chunk-reload-attempted', 'true')
    window.location.reload()
  }
})

// Las consultas pesadas configuran staleTime/retry/focus localmente. Mantener
// estos defaults evita cambiar de golpe la frescura del resto del dashboard.
// 🔴 Defaults ANTI-ESTAMPIDA (incidente del server 2026-09-01, auditado por Codex el
// mismo día): el QueryClient pelón traía retry: 3 con backoff y staleTime: 0 — con el
// server lento, cada pantalla (el menú monta 4-6 queries) disparaba 4 intentos por query
// y refetch completo en cada montaje, AMPLIFICANDO la caída en vez de dejarla respirar.
// - staleTime 30 s: navegar entre pantallas pinta la caché al instante (menos spinners);
//   lo "vivo" no depende de esto — tiene sus refetchInterval y sus eventos de socket.
// - retry 1: un fallo real avisa en segundos en vez de girar por 3 reintentos.
// - refetchOnWindowFocus se queda en su default (true) A PROPÓSITO — hallazgo P2 de la
//   auditoría: apagarlo quitaba la recuperación automática al volver a la pestaña tras
//   un error (p.ej. BasicInfo pinta "venue no encontrado" sin botón de reintentar). Con
//   staleTime 30 s el focus sólo refire lo rancio: una petición por dato, sin ráfaga.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
const showLoaderPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('loaderPreview') === '1'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

const root = ReactDOM.createRoot(rootElement)

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {showLoaderPreview ? <LoadingScreen /> : <App />}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
