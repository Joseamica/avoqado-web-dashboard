export interface DireccionCapturada {
  address: string
  city: string
  state: string
  zipCode: string
  country?: string
}

/**
 * 🔴 Fusiona lo que llega del autocompletado con lo que el usuario YA tenía escrito.
 *
 * `AddressAutocomplete` llama a `onAddressSelect` en dos situaciones muy distintas:
 *
 *  · el usuario ELIGIÓ una sugerencia de Google  → vienen ciudad, estado y CP, y deben ganar;
 *  · Google no cargó y el componente cae a un input pelón → llama en CADA TECLA con
 *    `city: '', state: '', country: '', zipCode: ''`.
 *
 * Un `setDireccion(place)` a secas no distingue los dos casos, así que en el segundo BORRA la
 * ciudad, el estado y el código postal que la persona acababa de teclear — sin aviso, mientras
 * escribe la calle. Aquí un campo vacío nunca pisa uno lleno.
 */
export function fusionarDireccion(previa: DireccionCapturada, lugar: Partial<DireccionCapturada>): DireccionCapturada {
  const preferir = (nuevo: string | undefined, viejo: string | undefined) => (nuevo?.trim() ? nuevo : (viejo ?? ''))
  return {
    address: preferir(lugar.address, previa.address),
    city: preferir(lugar.city, previa.city),
    state: preferir(lugar.state, previa.state),
    zipCode: preferir(lugar.zipCode, previa.zipCode),
    country: preferir(lugar.country, previa.country),
  }
}
