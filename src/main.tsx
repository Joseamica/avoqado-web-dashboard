// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
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

const queryClient = new QueryClient()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

const root = ReactDOM.createRoot(rootElement)

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
