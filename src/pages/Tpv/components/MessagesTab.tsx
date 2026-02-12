import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/PermissionGate'

import { CreateMessageDialog } from './CreateMessageDialog'
import { TpvMessagesList } from './TpvMessagesList'

interface MessagesTabProps {
  venueId: string
}

export function MessagesTab({ venueId }: MessagesTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Mensajes a terminales</h3>
          <p className="text-xs text-muted-foreground">Envia anuncios, encuestas y acciones a las terminales TPV</p>
        </div>
        <PermissionGate permission="tpv-messages:send">
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Nuevo mensaje
          </Button>
        </PermissionGate>
      </div>

      {/* Messages List */}
      <TpvMessagesList venueId={venueId} />

      {/* Create Dialog */}
      <CreateMessageDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} venueId={venueId} />
    </div>
  )
}
