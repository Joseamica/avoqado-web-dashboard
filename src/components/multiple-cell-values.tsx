import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export const ItemsCell = ({ cell, max_visible_items }) => {
  const items = cell.getValue() // Assuming AvoqadoMenu[] type
  const visibleItems = items.slice(0, max_visible_items)
  const remainingCount = items.length - max_visible_items
  if (items.length === 0) {
    return <span className="text-gray-500">-</span>
  }
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
            {remainingCount > 0 && <span className="text-gray-500"> +{remainingCount} más</span>}
          </span>
        </div>
      </TooltipTrigger>
      {items.length > max_visible_items && (
        <TooltipContent className="p-2 border border-gray-200 rounded shadow-lg">
          <span>{joinWithCommas(items)}</span>
        </TooltipContent>
      )}
    </Tooltip>
  )
}
