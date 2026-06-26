// Brand favicon is a single vector logo (favicon.svg) across ALL environments.
// The environment (DEV / STAGING / prod) is indicated in the page <title>, not the
// favicon — the old per-environment letter badges were retired so the tab always
// shows the crisp Avoqado mark. ?v=3 busts the browser's favicon cache.
const LOGO_FAVICON = '/favicon.svg?v=3'

export const resolveFaviconHref = (pathname: string): string => {
  void pathname
  return LOGO_FAVICON
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
