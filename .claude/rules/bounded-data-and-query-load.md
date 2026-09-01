# Bounded Data Without UX Loss

This rule is mandatory for every new or changed component, hook, page, report, or export that reads a
tenant-sized collection. Design the interaction for 10× and 100× today's largest customer.

## Data shape

- Cards, counters, and charts consume exact aggregate endpoints. Do not download detail rows to
  calculate a summary in the browser.
- Tables, feeds, selectors, and histories use server pagination or infinite loading. Search, filters,
  and sorting are server-side; debounce interactive search (normally 300 ms).
- Never request a huge `limit` as a substitute for pagination and never fetch the complete tenant
  dataset during mount.
- Preserve access to all matching records: show the total plus pagination/`Cargar más`, and preserve
  active filters across pages. Distinguish loading, empty dataset, no matches, and request failure.
- Deduplicate by stable item/event id when merging infinite pages, and reset to page one when the
  scope, search, filter, or ordering changes.

## Query behavior

- Heavy-query safeguards are local to the query; do not weaken real-time behavior globally in the
  shared `QueryClient`.
- Unless the product explicitly requires fresher data, start with `staleTime >= 30_000`, `retry: 1`,
  and `refetchOnWindowFocus: false` for a heavy list. Document real-time exceptions.
- Use `enabled` so hidden tabs, closed dialogs, missing venue/org context, and inaccessible features
  do not fetch. Avoid mounting duplicate consumers for the same heavy query.
- Mutations invalidate only the affected keys. Do not trigger a refetch storm across unrelated
  organization and venue views.

## Exports and compatibility

- A full export starts only after an explicit click and then walks bounded pages, streams, or polls a
  server-side export job. Never preload all rows “in case” the user exports.
- Backend ships first. During rollout, accept optional pagination fields/defaults and do not require a
  response shape that an older deployed server cannot provide unless deployment order is controlled.
- A page cap must be visible and navigable. Silent truncation is a user-experience regression even if
  it protects the server.

## Required verification

- Test initial page, next page/`Cargar más`, reset after search/filter changes, empty/no-match/error
  states, and that the legacy unbounded endpoint is not called.
- Test that summaries remain exact when detail has more than one page.
- Run targeted UI/service tests and project typecheck/build. After backend-first deployment, canary
  with a large tenant and check the browser network panel plus Better Stack/query-guard telemetry.
