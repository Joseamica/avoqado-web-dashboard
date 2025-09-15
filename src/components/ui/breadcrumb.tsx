import { ChevronRight, MoreHorizontal } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => {
  const { t } = useTranslation()
  return <nav ref={ref} aria-label={t('common.breadcrumb')} {...props} />
})
Breadcrumb.displayName = 'Breadcrumb'

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<'ol'>>(({ className, ...props }, ref) => (
  <ol ref={ref} className={cn('flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5', className)} {...props} />
))
BreadcrumbList.displayName = 'BreadcrumbList'

const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('inline-flex items-center gap-1.5', className)} {...props} />
))
BreadcrumbItem.displayName = 'BreadcrumbItem'

interface BreadcrumbLinkProps extends React.ComponentPropsWithoutRef<'a'> {
  as?: React.ElementType
  to?: string // Required when using the default Link
}

const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(({ as: Component = Link, className, ...props }, ref) => {
  return <Component ref={ref} className={cn('transition-colors hover:text-foreground', className)} {...props} />
})

BreadcrumbLink.displayName = 'BreadcrumbLink'

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<'span'>>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn('font-normal text-foreground', className)}
    {...props}
  />
))
BreadcrumbPage.displayName = 'BreadcrumbPage'

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<'li'>) => (
  <span role="presentation" aria-hidden="true" className={cn('[&>svg]:w-3.5 [&>svg]:h-3.5', className)} {...props}>
    {children ?? <ChevronRight />}
  </span>
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => {
  const { t } = useTranslation()
  return (
    <span role="presentation" aria-hidden="true" className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
      <MoreHorizontal className="w-4 h-4" />
      <span className="sr-only">{t('common.more')}</span>
    </span>
  )
}
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis'

export { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator }
