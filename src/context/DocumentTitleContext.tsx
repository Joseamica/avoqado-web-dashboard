import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { buildDocumentTitle, resolveRouteDocumentTitle } from '@/lib/document-title'
import { DocumentTitleContext, type DocumentTitleContextValue } from './document-title-context'

type PageTitleEntry = {
  ownerId: string
  title: string
} | null

type DocumentTitleProviderProps = {
  children: React.ReactNode
}

export function DocumentTitleProvider({ children }: DocumentTitleProviderProps) {
  const location = useLocation()
  const { t: sidebarT } = useTranslation('sidebar')
  const { t: organizationT } = useTranslation('organization')
  const { t: commonT } = useTranslation('common')
  const { t: playtelecomT } = useTranslation('playtelecom')
  const [pageTitleEntry, setPageTitleEntry] = useState<PageTitleEntry>(null)

  useEffect(() => {
    setPageTitleEntry(null)
  }, [location.pathname])

  const setPageTitle = useCallback((ownerId: string, title: string) => {
    const normalizedTitle = title.replace(/\s+/g, ' ').trim()
    if (!normalizedTitle) return

    setPageTitleEntry({ ownerId, title: normalizedTitle })
  }, [])

  const clearPageTitle = useCallback((ownerId: string) => {
    setPageTitleEntry(currentEntry => {
      if (!currentEntry || currentEntry.ownerId !== ownerId) {
        return currentEntry
      }

      return null
    })
  }, [])

  const routeTitle = useMemo(
    () =>
      resolveRouteDocumentTitle(location.pathname, {
        sidebarT,
        organizationT,
        commonT,
        playtelecomT,
      }),
    [location.pathname, sidebarT, organizationT, commonT, playtelecomT],
  )

  const activeTitle = pageTitleEntry?.title ?? routeTitle

  useEffect(() => {
    document.title = buildDocumentTitle(activeTitle)
  }, [activeTitle])

  const value = useMemo<DocumentTitleContextValue>(
    () => ({
      setPageTitle,
      clearPageTitle,
    }),
    [setPageTitle, clearPageTitle],
  )

  return <DocumentTitleContext.Provider value={value}>{children}</DocumentTitleContext.Provider>
}
