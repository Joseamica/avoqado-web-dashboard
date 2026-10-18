// Keep the private document entry free of dashboard auth and analytics imports.
if (/^\/documentos(?:\/|$)/.test(window.location.pathname)) {
  void import('./pages/PublicDocuments/main')
} else {
  void import('./dashboard-main')
}
