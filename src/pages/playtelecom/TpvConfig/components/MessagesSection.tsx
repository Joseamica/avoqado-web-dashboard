/**
 * MessagesSection - Send and manage messages to TPV terminals
 * Used within TpvConfiguration page for venue-level messaging
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquarePlus, Megaphone } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'
import { useAuth } from '@/context/AuthContext'
import { TpvMessagesList } from '@/pages/Tpv/components/TpvMessagesList'
import { CreateMessageDialog } from '@/pages/Tpv/components/CreateMessageDialog'

export function MessagesSection() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const venueId = activeVenue?.id
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  if (!venueId) return null

  return (
    <>
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t('playtelecom:tpvConfig.messages.title', { defaultValue: 'Mensajes a terminales' })}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:tpvConfig.messages.subtitle', { defaultValue: 'Envia anuncios, encuestas y acciones a las terminales TPV' })}
              </p>
            </div>
          </div>
          <PermissionGate permission="tpv-messages:send">
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              {t('playtelecom:tpvConfig.messages.newMessage', { defaultValue: 'Nuevo mensaje' })}
            </Button>
          </PermissionGate>
        </div>

        <TpvMessagesList venueId={venueId} />
      </GlassCard>

      <CreateMessageDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        venueId={venueId}
      />
    </>
  )
}
