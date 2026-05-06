// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './i18n'
import './index.css'
import './theme.css'

// Handle Vite preload errors (CSS/JS chunks missing after deploy)
// Vite emits this event when a dynamic import's preloaded dependency fails to load
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reload-attempted')) {
    sessionStorage.setItem('chunk-reload-attempted', 'true')
    window.location.reload()
  }
})

// ── book.avoqado.io: redirect bare root to marketing ──────────────────────
// The dedicated booking subdomain is for /<venueSlug> URLs only. If a visitor
// lands on the bare root (no slug), send them to the marketing site instead
// of showing 404. Runs before React mounts.
if (
  window.location.hostname === 'book.avoqado.io' &&
  (window.location.pathname === '/' || window.location.pathname === '')
) {
  window.location.replace('https://avoqado.io')
}

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
