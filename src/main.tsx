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

// ── book.avoqado.io subdomain rewrite ─────────────────────────────────────
// Customers reserve via clean URLs like book.avoqado.io/<venueSlug>, but the
// SPA's existing public routes are under /book/<venueSlug>. Rewriting the path
// in window.history BEFORE React Router mounts lets both work without
// duplicating route definitions: the address bar stays clean, but React Router
// reads /book/<venueSlug> and matches the existing PublicBookingPage.
//
// Runs only on the dedicated booking subdomain — dashboard.avoqado.io users
// never enter this branch. The replaceState call is synchronous and finishes
// before React Router reads window.location on first render, so there is no
// flash of a wrong route.
if (window.location.hostname === 'book.avoqado.io') {
  const path = window.location.pathname
  if (path === '/' || path === '/book' || path === '/book/') {
    // Visitor with no slug — send them to marketing rather than show 404.
    window.location.replace('https://avoqado.io')
  } else if (!path.startsWith('/book/')) {
    window.history.replaceState(
      null,
      '',
      `/book${path}${window.location.search}${window.location.hash}`,
    )
  }
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
