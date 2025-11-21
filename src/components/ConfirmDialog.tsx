import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertCircle, Trash2, XCircle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  variant?: 'default' | 'destructive' | 'warning'
  icon?: 'alert' | 'delete' | 'deactivate' | null
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'default',
  icon = 'alert',
}) => {
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  const getIcon = () => {
    if (icon === null) return null

    const iconClass = variant === 'destructive'
      ? 'h-5 w-5 text-destructive'
      : variant === 'warning'
      ? 'h-5 w-5 text-orange-600'
      : 'h-5 w-5 text-muted-foreground'

    switch (icon) {
      case 'delete':
        return <Trash2 className={iconClass} />
      case 'deactivate':
        return <XCircle className={iconClass} />
      case 'alert':
      default:
        return <AlertCircle className={iconClass} />
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-background">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              variant === 'destructive'
                ? 'bg-destructive hover:bg-destructive/90'
                : variant === 'warning'
                ? 'bg-orange-600 hover:bg-orange-700'
                : ''
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
