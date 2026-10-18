;(function () {
  var isPrivate = function (pathname) {
    return /^\/documentos(?:\/|$)/.test(pathname)
  }
  // Set before analytics scripts execute, including after back/forward navigation.
  function blockAnalytics() {
    if (!window.__AVOQADO_PRIVATE_DOCUMENTS__) {
      ;[
        ['referrer', 'no-referrer'],
        ['robots', 'noindex, nofollow'],
      ].forEach(function (item) {
        var meta = document.createElement('meta')
        meta.name = item[0]
        meta.content = item[1]
        document.head.appendChild(meta)
      })
    }
    window.__AVOQADO_PRIVATE_DOCUMENTS__ = true
    window['ga-disable-G-RHVHM6V578'] = true
    window['ga-disable-G-F6JCDF9K3P'] = true
    window['ga-disable-AW-18201754401'] = true
    window.dispatchEvent(new Event('avoqado:private-documents'))
  }
  if (isPrivate(window.location.pathname)) {
    blockAnalytics()
  }

  // A document form always gets a clean page without already-running SDKs/auth providers.
  ;['pushState', 'replaceState'].forEach(function (method) {
    var original = window.history[method]
    window.history[method] = function (state, unused, url) {
      var destination = url == null ? null : new URL(url, window.location.href)
      if (destination && isPrivate(destination.pathname) && !isPrivate(window.location.pathname)) {
        blockAnalytics()
        window.location.assign(destination.href)
        return
      }
      return original.apply(window.history, arguments)
    }
  })
  window.addEventListener(
    'popstate',
    function (event) {
      if (!isPrivate(window.location.pathname)) return
      blockAnalytics()
      // Strip any restored fragment before existing SDK page-leave handlers can inspect it.
      var params = new URLSearchParams(window.location.hash.slice(1))
      if (params.has('token')) {
        var token = params.get('token') || ''
        var key = 'document-token:' + window.location.pathname.split('/')[2]
        try {
          if (/^[a-f0-9]{64}$/.test(token)) window.sessionStorage.setItem(key, token)
          else window.sessionStorage.removeItem(key)
        } catch (error) {
          /* Storage may be disabled; reopen the original link. */
        }
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      }
      event.stopImmediatePropagation()
      window.location.reload()
    },
    true,
  )
})()
