import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface BreadcrumbContextType {
  customSegments: Record<string, string>
  setCustomSegment: (segmentId: string, displayName: string) => void
  clearCustomSegment: (segmentId: string) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [customSegments, setCustomSegments] = useState<Record<string, string>>({})

  const setCustomSegment = useCallback((segmentId: string, displayName: string) => {
    setCustomSegments(prev => ({ ...prev, [segmentId]: displayName }))
  }, [])

  const clearCustomSegment = useCallback((segmentId: string) => {
    setCustomSegments(prev => {
      const newSegments = { ...prev }
      delete newSegments[segmentId]
      return newSegments
    })
  }, [])

  return (
    <BreadcrumbContext.Provider value={{ customSegments, setCustomSegment, clearCustomSegment }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext)
  if (context === undefined) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider')
  }
  return context
}
