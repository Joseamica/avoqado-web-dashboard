import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTrigger,
} from './ui/alert-dialog'

interface AlertDialogWrapperProps {
  triggerTitle: string
  title: string
  description?: string
  message?: string
  rightButtonLabel?: string
  rightButtonVariant?: 'default' | 'outline' | 'destructive'
  onRightButtonClick?: () => void
}

const AlertDialogWrapper: React.FC<AlertDialogWrapperProps> = ({
  triggerTitle,
  title,
  description,
  message,
  rightButtonLabel,
  rightButtonVariant = 'default',
  onRightButtonClick,
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <button className={cn(buttonVariants({ variant: 'outline' }), 'trigger-button')}>{triggerTitle}</button>
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogPrimitive.AlertDialogTitle>{title}</AlertDialogPrimitive.AlertDialogTitle>
          {description && <AlertDialogPrimitive.AlertDialogDescription>{description}</AlertDialogPrimitive.AlertDialogDescription>}
        </AlertDialogHeader>
        {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
        <AlertDialogFooter className="flex space-x-5">
          {/* Left Button - Always appears */}
          <AlertDialogPrimitive.AlertDialogCancel className={cn(buttonVariants({ variant: 'outline' }))}>
            Cancelar
          </AlertDialogPrimitive.AlertDialogCancel>

          {/* Right Button - Appears only if rightButtonLabel is provided */}
          {rightButtonLabel && onRightButtonClick && (
            <AlertDialogPrimitive.AlertDialogAction
              onClick={onRightButtonClick}
              className={cn(buttonVariants({ variant: rightButtonVariant }))}
            >
              {rightButtonLabel}
            </AlertDialogPrimitive.AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialog>
)

export default AlertDialogWrapper
