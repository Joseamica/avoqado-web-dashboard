import { useEffect, useRef } from 'react'

interface GoogleOneTapConfig {
  clientId: string
  onSuccess: (credential: string) => void | Promise<void>
  onError?: (error: any) => void
  autoSelect?: boolean
  cancelOnTapOutside?: boolean
  disabled?: boolean
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          cancel: () => void
        }
      }
    }
  }
}

/**
 * Hook for Google One Tap Sign-In
 * Automatically shows the Google One Tap prompt when the user visits the page
 *
 * @example
 * ```tsx
 * useGoogleOneTap({
 *   clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
 *   onSuccess: async (credential) => {
 *     await loginWithOneTap(credential)
 *   },
 *   disabled: isAuthenticated
 * })
 * ```
 */
export const useGoogleOneTap = ({
  clientId,
  onSuccess,
  onError,
  autoSelect = true,
  cancelOnTapOutside = false,
  disabled = false,
}: GoogleOneTapConfig) => {
  const isInitialized = useRef(false)

  useEffect(() => {
    // Don't initialize if disabled or already initialized
    if (disabled || isInitialized.current) {
      return
    }

    // Load Google Identity Services script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    script.onload = () => {
      if (!window.google) {
        console.error('Google Identity Services failed to load')
        return
      }

      try {
        // Initialize Google One Tap
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response.credential) {
              onSuccess(response.credential)
            } else if (onError) {
              onError(new Error('No credential received from Google One Tap'))
            }
          },
          auto_select: autoSelect,
          cancel_on_tap_outside: cancelOnTapOutside,
          itp_support: true, // Better Safari support
        })

        // Show the One Tap prompt
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // One Tap was not displayed - user may have dismissed it before
            // or cookies are disabled
            if (onError) {
              onError({
                reason: notification.getNotDisplayedReason?.() || notification.getSkippedReason?.(),
              })
            }
          }
        })

        isInitialized.current = true
      } catch (error) {
        console.error('Error initializing Google One Tap:', error)
        if (onError) {
          onError(error)
        }
      }
    }

    script.onerror = () => {
      console.error('Failed to load Google Identity Services script')
      if (onError) {
        onError(new Error('Failed to load Google Identity Services'))
      }
    }

    document.body.appendChild(script)

    // Cleanup
    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }

      // Remove script if it exists
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [clientId, onSuccess, onError, autoSelect, cancelOnTapOutside, disabled])
}
