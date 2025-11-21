import * as React from 'react'
import { Button, ButtonProps } from './button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, isLoading = false, disabled, className, ...props }, ref) => {
    return (
      <Button ref={ref} disabled={isLoading || disabled} className={cn(className)} {...props}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    )
  },
)

LoadingButton.displayName = 'LoadingButton'

export { LoadingButton }
