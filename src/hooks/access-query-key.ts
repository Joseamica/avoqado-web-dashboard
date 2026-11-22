/**
 * Query key for access data. Vive en su propio módulo, sin dependencias, para que lo puedan importar pantallas cuyas pruebas
 * simulan `use-access` (encargo 27fd34: la recomendación de «Nuevo producto» cuelga de esta clave).
 */
export const accessQueryKey = (venueId: string | null) => ['user-access', venueId]
