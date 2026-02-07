import { isValidElement, useEffect, useId, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentTitleContext } from '@/hooks/useDocumentTitleContext'
import { buildDocumentTitle } from '@/lib/document-title'
import { cn } from '@/lib/utils'

type PageTitleWithInfoProps = {
  title: ReactNode
  tooltip?: string
  className?: string
  iconClassName?: string
}

function extractTitleText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node
      .map(extractTitleText)
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  if (isValidElement(node)) {
    return extractTitleText(node.props.children)
  }

  return ''
}

export function PageTitleWithInfo({ title, tooltip, className, iconClassName }: PageTitleWithInfoProps) {
  const resolvedTitle = extractTitleText(title).replace(/\s+/g, ' ').trim()
  const titleOwnerId = useId()
  const documentTitleContext = useDocumentTitleContext()

  useEffect(() => {
    if (!resolvedTitle) return

    if (documentTitleContext) {
      documentTitleContext.setPageTitle(titleOwnerId, resolvedTitle)

      return () => {
        documentTitleContext.clearPageTitle(titleOwnerId)
      }
    }

    document.title = buildDocumentTitle(resolvedTitle)
  }, [documentTitleContext, resolvedTitle, titleOwnerId])

  return (
    <div className="flex items-center gap-2">
      <h1 className={className}>{title}</h1>
      {tooltip ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={tooltip} className="cursor-pointer text-muted-foreground/70 hover:text-foreground">
                <Info className={cn('h-4 w-4', iconClassName)} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-relaxed">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  )
}
