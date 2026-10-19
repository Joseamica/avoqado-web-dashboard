/**
 * Todo cuelga de ['products', venueId]: las ~40 invalidaciones que ya existen (lista, asistente, sockets del menú) refrescan
 * también las familias, y una mutación de familia refresca la lista con una sola llamada.
 */
export const productGroupKeys = {
  all: (venueId: string) => ['products', venueId, 'groups'] as const,
  detail: (venueId: string, groupId: string) => ['products', venueId, 'groups', 'detail', groupId] as const,
  archived: (venueId: string, groupId: string) => ['products', venueId, 'groups', 'archived', groupId] as const,
  suggestions: (venueId: string) => ['products', venueId, 'groups', 'suggestions'] as const,
  optionLibrary: (venueId: string) => ['products', venueId, 'option-library'] as const,
}
