/**
 * Flujo de «Crear Venue» del asistente del SUPERADMIN, separado del componente para poder probarlo.
 *
 * El alta tiene pasos que NO se deshacen: crear el negocio, activar funciones y configurar la cuenta
 * de cobro. Si el último falla y el superadmin vuelve a darle «Crear», antes se creaba un SEGUNDO
 * negocio. Ahora el negocio creado se recuerda (`alreadyCreated`) y el reintento sólo repite el paso
 * de cobros.
 */

export interface CreatedVenue {
  venueId: string
  venueName: string
}

export interface CreateVenueFlowDeps {
  /** Negocio ya creado en un intento anterior de este mismo asistente (o null en el primero). */
  alreadyCreated: CreatedVenue | null
  /** Crea el negocio y devuelve su id. Sólo se llama si `alreadyCreated` es null. */
  createVenue: () => Promise<CreatedVenue>
  /** Se llama en cuanto el negocio existe, ANTES de los pasos que pueden fallar. */
  onVenueCreated: (venue: CreatedVenue) => void
  /** Activa las funciones elegidas. Sólo en el intento que creó el negocio. */
  applyFeatureGrants: (venueId: string) => Promise<void>
  /** Configura la cuenta de cobro (o nada si no aplica). Se repite en cada reintento. */
  setupPayments: (venueId: string) => Promise<void>
}

export async function runCreateVenueFlow(deps: CreateVenueFlowDeps): Promise<CreatedVenue & { reused: boolean }> {
  let venue = deps.alreadyCreated
  const reused = venue !== null

  if (!venue) {
    venue = await deps.createVenue()
    deps.onVenueCreated(venue)
    await deps.applyFeatureGrants(venue.venueId)
  }

  await deps.setupPayments(venue.venueId)
  return { ...venue, reused }
}
