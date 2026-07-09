import api from '@/api'

/**
 * Device-centric terminal location — the latest known position of each TPV,
 * refreshed hourly by the terminal's periodic geolocation ping (11:00–18:00
 * venue-local). Consumed by the Supervisor "Ubicación de TPVs" tab (venue-scoped,
 * custody-filtered) and the org white-label "Ubicación de TPVs" section (all
 * terminals in the org).
 */
export interface TerminalLocation {
  terminalId: string
  serialNumber: string | null
  venue: { id: string; name: string } | null
  promoter: { staffId: string; name: string } | null
  latest: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string; source: string } | null
}

/** Terminals of the requesting supervisor's custody promoters (MANAGER) or all venue terminals (ADMIN+). */
export async function getSupervisorTerminalLocations(
  venueId: string,
): Promise<{ terminals: TerminalLocation[]; trackingEnabled: boolean }> {
  const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/supervisor/terminals-locations`)
  return data.data
}

/** All terminals across the org's venues with their latest known location (OWNER). */
export async function getOrgTerminalLocations(orgId: string): Promise<{ terminals: TerminalLocation[] }> {
  const { data } = await api.get(`/api/v1/dashboard/organizations/${orgId}/terminals-locations`)
  return data.data
}
