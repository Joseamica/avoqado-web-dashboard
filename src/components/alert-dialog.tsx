import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogDescription,
  AlertDialogTrigger,
} from './ui/alert-dialog'

interface AlertDialogWrapperProps {
  triggerTitle: React.ReactNode
  title: string
  description?: string
  message?: string
  rightButtonLabel?: string
  rightButtonVariant?: 'default' | 'outline' | 'destructive'
  onRightButtonClick?: () => void
  triggerVariant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'link'
}

const AlertDialogWrapper: React.FC<AlertDialogWrapperProps> = ({
  triggerTitle,
  title,
  description,
  message,
  rightButtonLabel,
  rightButtonVariant = 'default',
  onRightButtonClick,
}) => {
  const { t } = useTranslation('common')
  const fallbackDescription = description ?? message ?? title

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className={cn(buttonVariants({ variant: 'outline' }), 'trigger-button')}>{triggerTitle}</button>
      </AlertDialogTrigger>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogPrimitive.AlertDialogTitle>{title}</AlertDialogPrimitive.AlertDialogTitle>
            {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
          </AlertDialogHeader>
          {!description && (
            <AlertDialogDescription className={cn('text-sm text-zinc-600 dark:text-zinc-400', !message && 'sr-only')}>
              {fallbackDescription}
            </AlertDialogDescription>
          )}
          {description && message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
          <AlertDialogFooter className="flex space-x-5">
            <AlertDialogPrimitive.AlertDialogCancel className={cn(buttonVariants({ variant: 'outline' }))}>
              {t('cancel')}
            </AlertDialogPrimitive.AlertDialogCancel>

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
}

export default AlertDialogWrapper
