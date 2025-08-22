import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export const ItemsCell = ({ cell, max_visible_items = 3 }) => {
  const raw = typeof cell?.getValue === 'function' ? cell.getValue() : cell?.value
  const items = Array.isArray(raw) ? raw.filter(Boolean) : [] // Ensure array to avoid runtime errors
  const limit = typeof max_visible_items === 'number' && max_visible_items > 0 ? max_visible_items : 3
  if (items.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }
  const visibleItems = items.slice(0, limit)
  const remainingCount = Math.max(0, items.length - limit)
  // Function to join category names with commas
  const joinWithCommas = items => {
    return items.map((item, index) => (
      <span key={item.id}>
        {item.name}
        {index < items.length - 1 && ', '}
      </span>
    ))
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="max-w-sm truncate cursor-pointer">
          <span>
            {joinWithCommas(visibleItems)}
            {remainingCount > 0 && <span className="text-muted-foreground"> +{remainingCount} más</span>}
          </span>
        </div>
      </TooltipTrigger>
      {items.length > limit && (
        <TooltipContent className="p-2 border border-muted rounded shadow-lg">
          <span>{joinWithCommas(items)}</span>
        </TooltipContent>
      )}
    </Tooltip>
  )
}
