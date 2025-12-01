import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import {
  type ChatReference,
  type ChatReferencesContextType,
  MAX_CHAT_REFERENCES,
  getChatReferencesStorageKey,
} from '@/types/chat-references'

// Create context with undefined default
export const ChatReferencesContext = createContext<ChatReferencesContextType | undefined>(undefined)

interface ChatReferencesProviderProps {
  children: ReactNode
}

export function ChatReferencesProvider({ children }: ChatReferencesProviderProps) {
  const { t } = useTranslation()
  const { venueSlug } = useCurrentVenue()
  const { user } = useAuth()
  const userId = user?.id

  // Load initial state from localStorage
  const [references, setReferences] = useState<ChatReference[]>(() => {
    if (!venueSlug) return []
    try {
      const key = getChatReferencesStorageKey(venueSlug, userId)
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Restore Date objects
        return parsed.map((ref: ChatReference) => ({
          ...ref,
          addedAt: new Date(ref.addedAt),
        }))
      }
    } catch (error) {
      console.warn('Error loading chat references from localStorage:', error)
    }
    return []
  })

  // Persist to localStorage when references change
  useEffect(() => {
    if (!venueSlug) return
    try {
      const key = getChatReferencesStorageKey(venueSlug, userId)
      if (references.length > 0) {
        localStorage.setItem(key, JSON.stringify(references))
      } else {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn('Error saving chat references to localStorage:', error)
    }
  }, [references, venueSlug, userId])

  // Clear references when venue changes
  useEffect(() => {
    if (venueSlug) {
      // Reload from storage for new venue
      try {
        const key = getChatReferencesStorageKey(venueSlug, userId)
        const stored = localStorage.getItem(key)
        if (stored) {
          const parsed = JSON.parse(stored)
          setReferences(
            parsed.map((ref: ChatReference) => ({
              ...ref,
              addedAt: new Date(ref.addedAt),
            })),
          )
        } else {
          setReferences([])
        }
      } catch {
        setReferences([])
      }
    }
  }, [venueSlug, userId])

  const addReference = useCallback((ref: ChatReference) => {
    setReferences(prev => {
      // Don't add if already exists
      if (prev.some(r => r.id === ref.id && r.type === ref.type)) {
        return prev
      }
      // Limit to MAX_CHAT_REFERENCES
      const newRefs = [ref, ...prev].slice(0, MAX_CHAT_REFERENCES)
      return newRefs
    })
  }, [])

  const removeReference = useCallback((id: string) => {
    setReferences(prev => prev.filter(r => r.id !== id))
  }, [])

  const clearReferences = useCallback(() => {
    setReferences([])
  }, [])

  const hasReference = useCallback(
    (id: string) => {
      return references.some(r => r.id === id)
    },
    [references],
  )

  // Generate structured context prompt for AI
  const getContextPrompt = useCallback(() => {
    if (references.length === 0) return ''

    const header = t('chat.references.contextHeader', {
      defaultValue: '[REFERENCIAS SELECCIONADAS POR EL USUARIO]\nEl usuario ha seleccionado los siguientes elementos para su consulta:',
    })

    const footer = t('chat.references.contextFooter', {
      defaultValue: '\nResponde las preguntas del usuario considerando estos datos específicos.\n[FIN DE REFERENCIAS]',
    })

    const items = references.map((ref, index) => {
      return `\n${index + 1}. ${ref.summary}`
    })

    return `${header}${items.join('')}${footer}`
  }, [references, t])

  const referenceCount = useMemo(() => references.length, [references])

  const contextValue = useMemo<ChatReferencesContextType>(
    () => ({
      references,
      addReference,
      removeReference,
      clearReferences,
      hasReference,
      getContextPrompt,
      referenceCount,
    }),
    [references, addReference, removeReference, clearReferences, hasReference, getContextPrompt, referenceCount],
  )

  return <ChatReferencesContext.Provider value={contextValue}>{children}</ChatReferencesContext.Provider>
}
