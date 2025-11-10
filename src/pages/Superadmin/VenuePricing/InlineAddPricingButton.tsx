import React from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface InlineAddPricingButtonProps {
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  onClick: () => void
  disabled?: boolean
  disabledReason?: string
}

export const InlineAddPricingButton: React.FC<InlineAddPricingButtonProps> = ({
  accountType,
  onClick,
  disabled = false,
  disabledReason = 'Configure merchant account first',
}) => {
  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="justify-start h-7 text-xs border-dashed hover:border-solid"
    >
      <Plus className="w-3 h-3 mr-1" />
      Add {accountType}
    </Button>
  )

  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
