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
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { getCommonSupportedRemoteCommands } from '@/pages/Tpv/deviceCapabilities'
import {
  bulkCommandOrgTerminals,
  ORG_TERMINAL_BULK_COMMANDS,
  ORG_TERMINAL_BULK_COMMAND_MAX,
  type OrgBulkCommandResponse,
  type OrgTerminal,
  type OrgTerminalBulkCommand,
} from '@/services/organizationDashboard.service'
import { useMutation } from '@tanstack/react-query'
import { Lock, Menu, RefreshCcw, RefreshCw, Unlock, Download, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TpvCommandType } from '@/types/tpv-commands'

interface OrgTerminalsBulkBarProps {
  orgId: string
  selected: OrgTerminal[]
  onClear: () => void
  onComplete: (result: OrgBulkCommandResponse) => void
}

const ACTION_ICON: Record<OrgTerminalBulkCommand, React.ComponentType<{ className?: string }>> = {
  RESTART: RefreshCw,
  SYNC_DATA: RefreshCcw,
  REFRESH_MENU: Menu,
  FORCE_UPDATE: Download,
  LOCK: Lock,
  UNLOCK: Unlock,
}

function supportsBulkCommandForSelection(selected: OrgTerminal[], command: OrgTerminalBulkCommand): boolean {
  if (selected.length === 0) return false
  const common = getCommonSupportedRemoteCommands(selected.map(device => device.capabilities))
  if (!common.includes(command as TpvCommandType)) return false
  if (command === TpvCommandType.LOCK) return selected.every(device => !device.isLocked)
  if (command === TpvCommandType.UNLOCK) return selected.every(device => device.isLocked)
  return true
}

export function OrgTerminalsBulkBar({ orgId, selected, onClear, onComplete }: OrgTerminalsBulkBarProps) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [pending, setPending] = useState<OrgTerminalBulkCommand | null>(null)
  const supportedCommands = useMemo(
    () => ORG_TERMINAL_BULK_COMMANDS.filter(command => supportsBulkCommandForSelection(selected, command)),
    [selected],
  )
  const supportsPending = pending !== null && supportedCommands.includes(pending)

  useEffect(() => {
    if (pending && !supportedCommands.includes(pending)) setPending(null)
  }, [pending, supportedCommands])

  const overCap = selected.length > ORG_TERMINAL_BULK_COMMAND_MAX

  const mutation = useMutation({
    mutationFn: ({ command }: { command: OrgTerminalBulkCommand }) => {
      if (!supportsBulkCommandForSelection(selected, command)) {
        throw new Error(t('terminals.bulk.unsupportedSelection'))
      }
      return bulkCommandOrgTerminals(
        orgId,
        selected.map(s => s.id),
        command,
      )
    },
    onSuccess: result => {
      if (result.failed === 0) {
        toast({ title: t('terminals.bulk.allSucceeded', { count: result.succeeded }) })
      } else if (result.succeeded === 0) {
        toast({
          variant: 'destructive',
          title: t('terminals.bulk.allFailed'),
          description: firstFewErrors(result, selected),
        })
      } else {
        toast({
          title: t('terminals.bulk.partial', {
            succeeded: result.succeeded,
            failed: result.failed,
            total: result.total,
          }),
          description: firstFewErrors(result, selected),
        })
      }
      onComplete(result)
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.bulk.allFailed'),
        description: err?.response?.data?.message ?? err?.message,
      })
    },
    onSettled: () => setPending(null),
  })

  if (selected.length === 0) return null

  const labelForCommand = (c: OrgTerminalBulkCommand) => t(`terminals.bulk.action.${c}`)

  const sampleNames = selected.slice(0, 5).map(s => s.name).join(', ')
  const moreCount = Math.max(0, selected.length - 5)

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background/95 backdrop-blur-sm shadow-lg px-3 py-2 max-w-[min(96vw,860px)]">
          <span className="text-sm font-medium text-foreground whitespace-nowrap px-2">
            {t('terminals.bulk.selected', { count: selected.length })}
          </span>
          {overCap && (
            <span className="text-xs text-destructive whitespace-nowrap">
              {t('terminals.bulk.max', { max: ORG_TERMINAL_BULK_COMMAND_MAX })}
            </span>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <div className="flex flex-wrap items-center gap-1">
            {supportedCommands.map(cmd => {
              const Icon = ACTION_ICON[cmd]
              return (
                <Button
                  key={cmd}
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 cursor-pointer"
                  onClick={() => setPending(cmd)}
                  disabled={overCap || mutation.isPending}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{labelForCommand(cmd)}</span>
                </Button>
              )
            })}
            {supportedCommands.length === 0 && (
              <span className="px-2 text-xs text-muted-foreground">{t('terminals.bulk.noCommonActions')}</span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label={t('terminals.bulk.clearSelection')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={supportsPending} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending && t('terminals.bulk.confirmTitle', { action: labelForCommand(pending), count: selected.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending && t('terminals.bulk.confirmDescription', { action: labelForCommand(pending) })}
              <span className="mt-2 block text-foreground">
                {sampleNames}
                {moreCount > 0 && (
                  <span className="text-muted-foreground"> {t('terminals.bulk.moreTerminals', { count: moreCount })}</span>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('terminals.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending && supportedCommands.includes(pending)) mutation.mutate({ command: pending })
              }}
            >
              {pending && labelForCommand(pending)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function firstFewErrors(result: OrgBulkCommandResponse, selected: OrgTerminal[]) {
  const map = new Map(selected.map(s => [s.id, s.name]))
  return result.results
    .filter(r => !r.success)
    .slice(0, 3)
    .map(r => `${map.get(r.terminalId) ?? r.terminalId}: ${r.error ?? 'error'}`)
    .join(' · ')
}
