import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { getOrgTerminalLocations } from '@/services/terminalLocation.service'
import { LastLocationCell } from '@/components/location/LastLocationCell'

export default function LiveLocation() {
  const { t } = useTranslation(['organization', 'playtelecom'])
  const { orgId } = useCurrentOrganization()
  const { data } = useQuery({
    queryKey: ['org-terminal-locations', orgId],
    queryFn: () => getOrgTerminalLocations(orgId!),
    enabled: !!orgId,
    refetchInterval: 60_000,
  })
  const terminals = data?.terminals ?? []

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('organization:liveLocation.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('playtelecom:location.hint')}</p>
      </div>
      {terminals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('playtelecom:location.empty')}</p>
      ) : (
        <div className="rounded-lg border border-input divide-y divide-input">
          {terminals.map(term => (
            <div key={term.terminalId} className="flex items-center justify-between p-3">
              <div>
                <p className="font-mono text-sm font-semibold">{term.serialNumber ?? term.terminalId}</p>
                <p className="text-xs text-muted-foreground">{(term.promoter?.name ?? '—')} · {(term.venue?.name ?? '—')}</p>
              </div>
              <LastLocationCell latest={term.latest} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
