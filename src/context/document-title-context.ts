import { createContext } from 'react'

export type DocumentTitleContextValue = {
  setPageTitle: (ownerId: string, title: string) => void
  clearPageTitle: (ownerId: string) => void
}

export const DocumentTitleContext = createContext<DocumentTitleContextValue | null>(null)

