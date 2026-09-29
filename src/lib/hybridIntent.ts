/** Recommendation only: no price, access or payment authorization survives here. */
const OFFER_KEY = 'avq_hybrid_offer_v1'
const attemptKey = (venueId: string) => `avq_hybrid_attempt_v1:${venueId}`
export function captureHybridOffer(search = window.location.search, now = Date.now()) {
  const slug = new URLSearchParams(search).get('hybridOffer')
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return
  try {
    localStorage.setItem(OFFER_KEY, JSON.stringify({ slug, savedAt: now }))
  } catch {
    /* recommendations never block signup */
  }
}
export function readHybridOffer(now = Date.now()): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(OFFER_KEY) ?? 'null')
    return value &&
      /^[a-z0-9][a-z0-9-]{0,99}$/.test(value.slug) &&
      typeof value.savedAt === 'number' &&
      value.savedAt <= now &&
      now - value.savedAt < 86400000
      ? value.slug
      : null
  } catch {
    return null
  }
}
export type HybridAttempt = { id: string; clientKey: string }
export function saveHybridAttempt(venueId: string, attempt: HybridAttempt) {
  localStorage.setItem(attemptKey(venueId), JSON.stringify(attempt))
}
export function readHybridAttempt(venueId: string): HybridAttempt | null {
  try {
    const value = JSON.parse(localStorage.getItem(attemptKey(venueId)) ?? 'null')
    return value && typeof value.id === 'string' && typeof value.clientKey === 'string' ? value : null
  } catch {
    return null
  }
}
export function clearHybridAttempt(venueId: string, id: string) {
  if (readHybridAttempt(venueId)?.id === id) localStorage.removeItem(attemptKey(venueId))
}

export type HybridDraft = { lines: { id: string; slug: string; codes: string[] }[]; replace: string[]; drop: string[] }
const draftKey = (venueId: string) => `avq_hybrid_draft_v1:${venueId}`
export function saveHybridDraft(venueId: string, draft: HybridDraft, now = Date.now()) {
  localStorage.setItem(draftKey(venueId), JSON.stringify({ ...draft, savedAt: now }))
}
export function clearHybridDraft(venueId: string) {
  localStorage.removeItem(draftKey(venueId))
}
export function readHybridDraft(venueId: string, now = Date.now()): HybridDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(venueId)) ?? 'null')
    const strings = (items: unknown): items is string[] =>
      Array.isArray(items) && items.length <= 100 && items.every(item => typeof item === 'string' && item.length > 0 && item.length <= 100)
    if (
      !value ||
      typeof value.savedAt !== 'number' ||
      value.savedAt > now ||
      now - value.savedAt >= 86400000 ||
      !Array.isArray(value.lines) ||
      value.lines.length > 8 ||
      !strings(value.replace) ||
      !strings(value.drop)
    )
      return null
    if (
      value.lines.some(
        (line: HybridDraft['lines'][number]) =>
          !line ||
          typeof line.id !== 'string' ||
          !line.id ||
          line.id.length > 100 ||
          typeof line.slug !== 'string' ||
          !/^[a-z0-9][a-z0-9-]{0,99}$/.test(line.slug) ||
          !strings(line.codes),
      )
    )
      return null
    return {
      lines: value.lines.map(({ id, slug, codes }: HybridDraft['lines'][number]) => ({ id, slug, codes })),
      replace: value.replace,
      drop: value.drop,
    }
  } catch {
    return null
  }
}
