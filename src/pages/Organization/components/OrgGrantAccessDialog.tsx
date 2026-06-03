import { useTranslation } from 'react-i18next'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import OrgStaffAccessStep from './OrgStaffAccessStep'
import type { OrgTerminal } from '@/services/organizationDashboard.service'

/**
 * Standalone "Dar acceso a una persona" action. Wraps {@link OrgStaffAccessStep}
 * in a FullScreenModal so the OWNER can grant venue access (role + PIN) at the
 * terminal's CURRENT venue at any time — independent of a migration.
 *
 * No `sourceVenueId` here (we're not moving a terminal), so no one is
 * pre-selected; the OWNER searches and adds people explicitly.
 *
 * Authorization: NOT wrapped in <PermissionGate> — the org dashboard has no
 * active venue, so `useAccess().can()` is always false there. The org route
 * (OrganizationLayout: SUPERADMIN or OWNER-in-this-org) and the backend
 * (requireOrgOwner) already enforce access.
 */
interface OrgGrantAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  terminal: OrgTerminal | null
}

export default function OrgGrantAccessDialog({ open, onOpenChange, orgId, terminal }: OrgGrantAccessDialogProps) {
  const { t } = useTranslation('organization')
  const close = () => onOpenChange(false)

  if (!terminal) return null

  return (
    <FullScreenModal
      open={open}
      onClose={close}
      title={t('terminals.staffAccess.standaloneTitle')}
      subtitle={terminal.venue?.name ?? undefined}
      contentClassName="bg-muted/30"
    >
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <div className="rounded-2xl border border-input bg-card p-6">
          <OrgStaffAccessStep
            orgId={orgId}
            destVenueId={terminal.venue.id}
            destVenueName={terminal.venue?.name}
            onDone={close}
            onSkip={close}
          />
        </div>
      </div>
    </FullScreenModal>
  )
}
