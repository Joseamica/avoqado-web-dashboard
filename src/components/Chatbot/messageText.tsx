import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g
const TRAILING_URL_PUNCTUATION_PATTERN = /[.,!?;:]+$/

function renderPlainTextWithLinks(text: string, isUserMessage: boolean, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const matchIndex = match.index ?? 0

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex))
    }

    const href = rawUrl.replace(TRAILING_URL_PUNCTUATION_PATTERN, '')
    const trailingText = rawUrl.slice(href.length)

    nodes.push(
      <a
        key={`${keyPrefix}-url-${matchIndex}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'underline underline-offset-2 break-all',
          isUserMessage ? 'text-primary-foreground' : 'text-primary hover:text-primary/80',
        )}
      >
        {href}
      </a>,
    )

    if (trailingText) {
      nodes.push(trailingText)
    }

    lastIndex = matchIndex + rawUrl.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

// Parses lightweight assistant formatting while keeping text escaped by React.
export function parseMessageText(text: string, isUserMessage: boolean): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  if (parts.length === 1) {
    return renderPlainTextWithLinks(text, isUserMessage, 'message')
  }

  return parts.flatMap((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return (
        <Badge key={index} variant={isUserMessage ? 'secondary' : 'default'} className="mx-0.5 text-xs py-0.5 px-1.5">
          {content}
        </Badge>
      )
    }

    return renderPlainTextWithLinks(part, isUserMessage, `message-${index}`)
  })
}
