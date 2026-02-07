;(function () {
  // Theme detection
  try {
    const storageKey = 'vite-ui-theme'
    const getSystemTheme = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    const setting = localStorage.getItem(storageKey) || 'system'
    const theme = setting === 'system' ? getSystemTheme() : setting
    if (theme === 'dark') document.documentElement.classList.add('dark')
  } catch (e) {
    // ignore storage errors
  }

  // Environment detection and favicon/title setting
  try {
    const hostname = window.location.hostname
    const pathname = window.location.pathname
    const isLocal =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local')
    const isStaging = hostname.includes('staging') || hostname.includes('develop')
    const isSuperadminRoute = pathname.startsWith('/superadmin')
    const favicon = document.getElementById('favicon')
    const pageTitle = document.getElementById('page-title')
    let baseFaviconHref = '/favicon.ico'

    if (isLocal) {
      baseFaviconHref = '/favicon-development.svg'
      if (pageTitle) pageTitle.textContent = 'Avoqado | Dashboard (DEV)'
      document.documentElement.setAttribute('data-env', 'development')
    } else if (isStaging) {
      baseFaviconHref = '/favicon-staging.svg'
      if (pageTitle) pageTitle.textContent = 'Avoqado | Dashboard (STAGING)'
      document.documentElement.setAttribute('data-env', 'staging')
    } else {
      if (pageTitle) pageTitle.textContent = 'Avoqado | Dashboard'
      document.documentElement.setAttribute('data-env', 'production')
    }

    if (favicon) {
      favicon.href = isSuperadminRoute ? '/favicon-superadmin.svg' : baseFaviconHref
    }
  } catch (e) {
    // ignore DOM errors
  }
})()
