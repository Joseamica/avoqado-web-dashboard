import { useContext } from 'react'
import { DocumentTitleContext } from '@/context/document-title-context'

export function useDocumentTitleContext() {
  return useContext(DocumentTitleContext)
}

