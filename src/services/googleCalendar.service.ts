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
  listCalendars(sessionToken: string): Promise<{ calendars: CalendarPickerItem[] }> {
    return api
      .get<{ calendars: CalendarPickerItem[] }>(`${BASE}/oauth/calendars`, {
        params: { session: sessionToken },
      })
      .then(r => r.data)
  },

  /**
   * Step 3 — atomically commit the connection: server consumes the session,
   * creates the GoogleCalendarConnection row, and subscribes to the
   * events.watch channel inside a single transaction.
   */
  createConnection(
    sessionToken: string,
    selectedCalendarId: string,
  ): Promise<{ connection: GoogleCalendarConnection }> {
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
}

export default googleCalendarService
