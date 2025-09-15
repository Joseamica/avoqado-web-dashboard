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
    const isLocal =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local')
    const isStaging = hostname.includes('staging') || hostname.includes('develop')
    const favicon = document.getElementById('favicon')
    const pageTitle = document.getElementById('page-title')

    if (isLocal) {
      if (favicon) favicon.href = '/favicon-development.svg'
      if (pageTitle) pageTitle.textContent = 'Avoqado | Dashboard (DEV)'
      document.documentElement.setAttribute('data-env', 'development')
    } else if (isStaging) {
      if (favicon) favicon.href = '/favicon-staging.svg'
      if (pageTitle) pageTitle.textContent = 'Avoqado | Dashboard (STAGING)'
      document.documentElement.setAttribute('data-env', 'staging')
    } else {
      if (favicon) favicon.href = '/favicon.ico'
      if (pageTitle) pageTitle.textContent = 'Avoqado | Dashboard'
      document.documentElement.setAttribute('data-env', 'production')
    }
  } catch (e) {
    // ignore DOM errors
  }
})()

