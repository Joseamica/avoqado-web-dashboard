import { useState, useEffect } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

let configured = false
let loadPromise: Promise<google.maps.PlacesLibrary> | null = null

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      setIsLoaded(false)
      return
    }

    if (!configured) {
      setOptions({ key: apiKey })
      configured = true
    }

    if (!loadPromise) {
      loadPromise = importLibrary('places')
    }

    loadPromise
      .then(() => setIsLoaded(true))
      .catch((err) => setLoadError(err))
  }, [])

  return { isLoaded, loadError }
}
