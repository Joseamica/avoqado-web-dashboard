const DEFAULT_FAVICON = '/favicon.ico'
const DEVELOPMENT_FAVICON = '/favicon-development.svg'
const STAGING_FAVICON = '/favicon-staging.svg'
const SUPERADMIN_FAVICON = '/favicon-superadmin.svg'
const SUPERADMIN_PRODUCTION_FAVICON = '/favicon-superadmin-production.svg'

const getEnv = (): string | null => {
  if (typeof document === 'undefined') return null
  return document.documentElement.getAttribute('data-env')
}

export const getEnvironmentFaviconHref = (): string => {
  const env = getEnv()

  if (env === 'development') return DEVELOPMENT_FAVICON
  if (env === 'staging') return STAGING_FAVICON

  return DEFAULT_FAVICON
}

export const resolveFaviconHref = (pathname: string): string => {
  if (pathname.startsWith('/superadmin')) {
    const env = getEnv()
    // Green in production, amber-pink in dev/staging
    if (env === 'development' || env === 'staging') return SUPERADMIN_FAVICON
    return SUPERADMIN_PRODUCTION_FAVICON
  }

  return getEnvironmentFaviconHref()
}

export const applyFaviconHref = (href: string): void => {
  if (typeof document === 'undefined') {
    return
  }

  const faviconElement =
    (document.getElementById('favicon') as HTMLLinkElement | null) ??
    (document.querySelector('link[rel="icon"]') as HTMLLinkElement | null)

  if (!faviconElement) {
    return
  }

  if (faviconElement.getAttribute('href') !== href) {
    faviconElement.setAttribute('href', href)
  }
}

