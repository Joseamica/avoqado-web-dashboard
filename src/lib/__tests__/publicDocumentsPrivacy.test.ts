import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const html = readFileSync('index.html', 'utf8')
const privacyScript = readFileSync('public/document-privacy.js', 'utf8')
const headScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(script => /googletagmanager|oaiq/.test(script))
function browser(pathname = '/documentos/request', hash = '#token=' + 'a'.repeat(64)) {
  const location = {
    pathname,
    hostname: 'dashboard.avoqado.io',
    search: '',
    hash,
    href: `https://dashboard.avoqado.io${pathname}${hash}`,
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  }
  const pushState = vi.fn()
  const replaceState = vi.fn()
  const w = {
    location,
    history: { pushState, replaceState, state: {} },
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    sessionStorage: { setItem: vi.fn(), removeItem: vi.fn() },
  }
  const document = { createElement: vi.fn((tagName: string) => ({ tagName })), head: { appendChild: vi.fn() } }
  const context = { window: w, document, URL, URLSearchParams, Event }
  return { ...context, pushState, replaceState }
}
describe('document privacy before any analytics SDK', () => {
  it('statically declares noindex/no-referrer before scripts', () => {
    expect(readFileSync('public/_headers', 'utf8')).toContain(
      '/documentos/*\n  ! Referrer-Policy\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow',
    )
    expect(html).not.toContain('name="robots"')
    expect(html.indexOf('/document-privacy.js')).toBeLessThan(html.indexOf('googletagmanager'))
  })
  it('never loads Google or OpenAI Ads on a private initial route, even on production domain', () => {
    const env = browser()
    runInNewContext(privacyScript, env)
    for (const script of headScripts) runInNewContext(script, env)
    expect(env.document.head.appendChild.mock.calls.map(call => call[0])).toEqual([
      { tagName: 'meta', name: 'referrer', content: 'no-referrer' },
      { tagName: 'meta', name: 'robots', content: 'noindex, nofollow' },
    ])
    expect(env.document.createElement.mock.calls.some(call => call[0] === 'script')).toBe(false)
  })
  it('turns an SPA push into a fresh private navigation before history/SDK observers receive the secret', () => {
    const env = browser('/login', '')
    runInNewContext(privacyScript, env)
    env.window.history.pushState({}, '', '/documentos/request#token=' + 'a'.repeat(64))
    expect(env.pushState).not.toHaveBeenCalled()
    expect(env.window.location.assign).toHaveBeenCalledWith('https://dashboard.avoqado.io/documentos/request#token=' + 'a'.repeat(64))
  })
  it('keeps analytics disabled even if the external privacy bootstrap fails to load', () => {
    const env = browser()
    for (const script of headScripts) runInNewContext(script, env)
    expect(env.document.head.appendChild).not.toHaveBeenCalled()
  })
  it('does not import dashboard/auth/analytics on the public entry', () => {
    const entry = readFileSync('src/main.tsx', 'utf8')
    expect(entry).toContain("import('./pages/PublicDocuments/main')")
    expect(entry).not.toMatch(/^import .*App|^import .*posthog|^import .*ErrorBoundary/m)
  })
})
