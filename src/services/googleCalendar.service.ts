import api from '@/api'

// -----------------------------------------------------------------------------
// Google Calendar Sync — frontend service wrapper.
//
// Hits the backend's `/api/v1/google-calendar/*` endpoints (mounted in
// `avoqado-server/src/routes/google-calendar.routes.ts`). Two distinct flows
// share these endpoints, differentiated by `intent`:
//   - `venue_master`  — venue-level master calendar (admin permission).
//   - `staff_personal` — the caller's own calendar across venues they staff.
//
// Authentication: cookie-based — the shared `api` axios instance already sends
// `withCredentials: true`. The OAuth callback endpoint is the only unauthenticated
// route; the dashboard's role is to redirect to Google, then handle the picker
// session token Google's redirect brings back.
// -----------------------------------------------------------------------------

export type ConnectionScope = 'VENUE' | 'STAFF_PERSONAL'

export type ConnectionStatus = 'CONNECTED' | 'TOKEN_REVOKED' | 'CALENDAR_LOST' | 'WATCH_FAILED' | 'DISCONNECTED'

export interface GoogleCalendarConnection {
  id: string
  scope: ConnectionScope
  venueId: string | null
  staffId: string | null
  googleAccountEmail: string
  selectedCalendarId: string
  selectedCalendarSummary: string
  selectedCalendarTimeZone: string
  status: ConnectionStatus
  statusReason?: string | null
  lastSyncedAt: string | null
  connectedAt: string
  disconnectedAt?: string | null
}

export interface CalendarPickerItem {
  id: string
  summary: string
  timeZone: string
  accessRole: string
  primary?: boolean
}

export type OAuthIntent = 'venue_master' | 'staff_personal'

// ----------------------------------------------------------------------------
// Phase 3 types — overlay, dead-letter, connection detail.
// Mirrors the response shapes produced by the backend endpoints documented in
// `docs/superpowers/plans/2026-05-16-google-calendar-sync-phase3.md` (Subagent A).
// ----------------------------------------------------------------------------

export interface ExternalBusyBlock {
  id: string
  startsAt: string
  endsAt: string
  allDay: boolean
  /** Server forces `null` when `isPrivate === true` — UI renders "Ocupado" then. */
  title: string | null
  isPrivate: boolean
  source: 'GOOGLE'
  connection: {
    id: string
    googleAccountEmail: string
    scope: ConnectionScope
  }
}

export type GoogleCalendarOutboxOperation = 'CREATE' | 'UPDATE' | 'CANCEL' | 'UPDATE_ROSTER'

export type DeadLetterSource =
  | {
      kind: 'reservation'
      id: string
      confirmationCode: string
      displayName: string | null
      startsAt: string
    }
  | {
      kind: 'classSession'
      id: string
      title: string
      startsAt: string
    }
  | {
      kind: 'unknown'
      id: string
    }

export interface DeadLetterRow {
  id: string
  operation: GoogleCalendarOutboxOperation
  createdAt: string
  attempts: number
  lastError: string | null
  source: DeadLetterSource
  target: {
    connectionId: string
    googleAccountEmail: string
    scope: ConnectionScope
  }
}

export interface ConnectionDetail {
  id: string
  scope: ConnectionScope
  status: ConnectionStatus
  statusReason: string | null
  googleAccountEmail: string
  selectedCalendarId: string
  selectedCalendarSummary: string
  selectedCalendarTimeZone: string
  lastSyncedAt: string | null
  lastHorizonEnd: string | null
  connectedAt: string
  disconnectedAt: string | null
  channel: { expiresAt: string; status: string } | null
  pendingCount: number
  deadLetterCount: number
}

const BASE = '/api/v1/google-calendar'

const googleCalendarService = {
  /**
   * Step 1 of the connection flow — exchange the user's intent for a Google
   * authorization URL. The caller MUST then `window.location.href = url` to
   * complete the OAuth dance; Google redirects back to the picker route with
   * `?session=<token>` after consent.
   */
  initOAuth(intent: OAuthIntent): Promise<{ url: string }> {
    return api.get<{ url: string }>(`${BASE}/oauth/init`, { params: { intent } }).then(r => r.data)
  },

  /**
   * Step 2 — after the OAuth callback redirects back with a session token,
   * fetch the user's writable calendars (filtered server-side per intent).
   */
  listCalendars(sessionToken: string): Promise<{ calendars: CalendarPickerItem[]; intent: OAuthIntent }> {
    return api
      .get<{ calendars: CalendarPickerItem[]; intent: OAuthIntent }>(`${BASE}/oauth/calendars`, {
        params: { session: sessionToken },
      })
      .then(r => r.data)
  },

  /**
   * Step 3 — atomically commit the connection: server consumes the session,
   * creates the GoogleCalendarConnection row, and subscribes to the
   * events.watch channel inside a single transaction.
   */
  createConnection(sessionToken: string, selectedCalendarId: string): Promise<{ connection: GoogleCalendarConnection }> {
    return api
      .post<{ connection: GoogleCalendarConnection }>(`${BASE}/connections`, {
        session: sessionToken,
        selectedCalendarId,
      })
      .then(r => r.data)
  },

  /**
   * Lists every connection the caller can see — all VENUE connections in their
   * current venue, plus their own STAFF_PERSONAL connection across venues. The
   * cards in Reservation Settings and Mi Cuenta filter this single list rather
   * than maintaining separate queries.
   */
  listConnections(): Promise<{ connections: GoogleCalendarConnection[] }> {
    return api.get<{ connections: GoogleCalendarConnection[] }>(`${BASE}/connections`).then(r => r.data)
  },

  /**
   * Tears down a connection: stops the events.watch channel, drops
   * ExternalBusyBlock rows, and marks the row DISCONNECTED. The backend does
   * the heavy lifting — the UI just refreshes its query afterward.
   */
  disconnectConnection(id: string): Promise<void> {
    return api.delete(`${BASE}/connections/${id}`).then(() => undefined)
  },

  // --------------------------------------------------------------------------
  // Phase 3 wrappers — read-side overlay + dead-letter triage + status detail.
  //
  // The first three are dashboard-scoped (under /api/v1/dashboard/venues/...)
  // because they require the venue context for tenant isolation. The detail
  // lookup is connection-scoped and falls back to the global `/google-calendar`
  // prefix (owner of the staff connection OR `calendar:view_status` in venue
  // context can read it).
  // --------------------------------------------------------------------------

  /**
   * Fetch external Google Calendar busy blocks overlapping the requested range
   * for the visible week/day in the dashboard reservation calendar.
   * The backend forces `title: null` when the source event is marked private —
   * render those as "Ocupado" / "Busy" in the UI.
   */
  listBusyBlocks(venueId: string, args: { from: string; to: string; staffId?: string }): Promise<{ blocks: ExternalBusyBlock[] }> {
    return api
      .get<{ blocks: ExternalBusyBlock[] }>(`/api/v1/dashboard/venues/${venueId}/google-calendar/busy-blocks`, { params: args })
      .then(r => r.data)
  },

  /**
   * Paginated list of outbox rows in DEAD_LETTER status for the venue — what
   * the operator sees in the "Sincronizaciones fallidas" modal.
   */
  listDeadLetter(
    venueId: string,
    args: { limit?: number; cursor?: string } = {},
  ): Promise<{ rows: DeadLetterRow[]; nextCursor: string | null }> {
    return api
      .get<{
        rows: DeadLetterRow[]
        nextCursor: string | null
      }>(`/api/v1/dashboard/venues/${venueId}/google-calendar/outbox/dead-letter`, { params: args })
      .then(r => r.data)
  },

  /**
   * Manually retry a single dead-letter outbox row. Backend returns 409 if the
   * row's status has changed between the user reading the modal and clicking
   * Reintentar — the caller surfaces a "Estado cambió, recarga la lista" toast.
   */
  retryDeadLetterRow(
    venueId: string,
    rowId: string,
  ): Promise<{
    row: { id: string; status: string; attempts: number; scheduledAt: string; lastError: string | null }
  }> {
    return api
      .post<{
        row: { id: string; status: string; attempts: number; scheduledAt: string; lastError: string | null }
      }>(`/api/v1/dashboard/venues/${venueId}/google-calendar/outbox/${rowId}/retry`)
      .then(r => r.data)
  },

  /**
   * Detailed status payload for a single connection — used by the connection
   * card to show pending/dead-letter counts, channel renewal date, and the
   * structured statusReason banner.
   */
  getConnectionDetail(id: string): Promise<{ connection: ConnectionDetail }> {
    return api.get<{ connection: ConnectionDetail }>(`${BASE}/connections/${id}`).then(r => r.data)
  },
}

export default googleCalendarService
