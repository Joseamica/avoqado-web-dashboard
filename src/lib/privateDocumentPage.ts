export function isPrivateDocumentPage(): boolean {
  if (typeof window === 'undefined') return false
  return (
    /^\/documentos(?:\/|$)/.test(window.location.pathname) ||
    Boolean((window as Window & { __AVOQADO_PRIVATE_DOCUMENTS__?: boolean }).__AVOQADO_PRIVATE_DOCUMENTS__)
  )
}
