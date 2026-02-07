const DEFAULT_FAVICON = '/favicon.ico'
const DEVELOPMENT_FAVICON = '/favicon-development.svg'
const STAGING_FAVICON = '/favicon-staging.svg'
const SUPERADMIN_FAVICON = '/favicon-superadmin.svg'

export const getEnvironmentFaviconHref = (): string => {
  if (typeof document === 'undefined') {
    return DEFAULT_FAVICON
  }

  const env = document.documentElement.getAttribute('data-env')

  if (env === 'development') return DEVELOPMENT_FAVICON
  if (env === 'staging') return STAGING_FAVICON

  return DEFAULT_FAVICON
}

export const resolveFaviconHref = (pathname: string): string => {
  if (pathname.startsWith('/superadmin')) {
    return SUPERADMIN_FAVICON
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

